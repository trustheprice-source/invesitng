"""Completed five-minute features with explicit information availability.

Returns compare completed bucket closes within the session, so their initial
windows are NaN. VWAP approximates minute turnover with close * volume. Range is
(high-low)/last_price. Volatility is the sample standard deviation of six
five-minute close returns (unavailable until six returns exist). Event windows
are (decision_time-60 minutes, decision_time] using observed available_at.
"""
import numpy as np
import pandas as pd
from .data import Dataset, _columns, _numeric, _ordered, _times, _whole_minutes

FEATURE_COLUMNS = [
    'rvol','cumulative_rvol','return_5m','return_15m','return_60m',
    'vwap_distance','range_5m','volatility_30m','day_return','gap_return',
    'market_return_15m','sector_return_15m','context_available',
    'news_count_60m','news_available',
]
_OUTPUT_COLUMNS = ['decision_time','session_date','session_open','session_close',
    'last_price','rvol','cumulative_rvol','rvol_ready','return_5m','return_15m',
    'return_60m','vwap_distance','range_5m','volatility_30m','day_return',
    'gap_return','opening_range_high','opening_range_low','opening_range_ready',
    'market_return_15m','sector_return_15m','context_available','news_count_60m','news_available']


def _configuration(config):
    values = dict(bar_minutes=5,volume_lookback_sessions=20,
        min_volume_history_sessions=10,context_max_age_minutes=15)
    if config is not None:
        if not isinstance(config,dict) or set(config)-set(values):
            raise ValueError('unknown feature configuration keys')
        values.update(config)
    for key in ('bar_minutes','volume_lookback_sessions','min_volume_history_sessions'):
        if type(values[key]) is not int or values[key]<=0:
            raise ValueError(f'{key} must be a positive integer')
    if values['bar_minutes']!=5:
        raise ValueError('bar_minutes must be 5')
    if values['min_volume_history_sessions']>values['volume_lookback_sessions']:
        raise ValueError('min_volume_history_sessions exceeds volume_lookback_sessions')
    age=values['context_max_age_minutes']
    if isinstance(age,bool) or not isinstance(age,(int,float)) or not np.isfinite(age) or age<0:
        raise ValueError('context_max_age_minutes must be finite and nonnegative')
    return values


def _feature_inputs(dataset):
    # A directly constructed Dataset need not carry an ingestion manifest, but
    # feature calculations still require complete normalized minute/session data.
    bars=dataset.bars.copy(deep=True)
    sessions=dataset.sessions.copy(deep=True)
    _columns(bars,['timestamp','open','high','low','close','volume'],'bars')
    _columns(sessions,['session_date','open','close'],'sessions')
    if sessions.empty or bars.empty:
        raise ValueError('feature inputs require nonempty sessions and bars')
    bars['timestamp']=_times(bars.timestamp,'bars.timestamp')
    _whole_minutes(bars.timestamp,'bars.timestamp')
    _ordered(bars.timestamp,'bars.timestamp')
    _numeric(bars,['open','high','low','close','volume'],'bars')
    # Float arithmetic prevents fixed-width integer volume sums wrapping.
    bars[['open','high','low','close','volume']]=bars[['open','high','low','close','volume']].astype(float)
    if not bars[['open','high','low','close']].gt(0).all().all() or bars.volume.lt(0).any():
        raise ValueError('invalid feature prices or volume')
    if not (bars.low.le(bars.open)&bars.low.le(bars.close)&bars.high.ge(bars.open)&bars.high.ge(bars.close)).all():
        raise ValueError('invalid feature OHLC ordering')
    sessions['session_date']=sessions.session_date.astype(str)
    _ordered(sessions.session_date,'sessions.session_date')
    for name in ('open','close'):
        sessions[name]=_times(sessions[name],f'sessions.{name}')
        _whole_minutes(sessions[name],f'sessions.{name}')
        if not sessions[name].dt.tz_convert('Europe/Rome').dt.strftime('%Y-%m-%d').eq(sessions.session_date).all():
            raise ValueError('session date differs from Europe/Rome local date')
    if not sessions.open.lt(sessions.close).all():
        raise ValueError('session open must precede close')
    expected_parts=[pd.date_range(row.open,row.close,freq='min',inclusive='left') for row in sessions.itertuples()]
    expected=expected_parts[0].append(expected_parts[1:])
    if expected.has_duplicates or not expected.is_monotonic_increasing or not pd.DatetimeIndex(bars.timestamp).equals(expected):
        raise ValueError('feature inputs require exact complete session minute coverage')
    return bars.reset_index(drop=True),sessions.reset_index(drop=True)


def _add_context(result,dataset,age_minutes):
    result['market_return_15m']=0.
    result['sector_return_15m']=0.
    result['context_available']=0
    if dataset.context is None or dataset.context.empty:
        return result
    context=dataset.context.copy(deep=True)
    _columns(context,['available_at','market_return_15m','sector_return_15m'],'context')
    context['available_at']=_times(context.available_at,'context.available_at')
    _ordered(context.available_at,'context.available_at')
    _numeric(context,['market_return_15m','sector_return_15m'],'context')
    merged=pd.merge_asof(result[['decision_time']],context,on=None,
        left_on='decision_time',right_on='available_at',direction='backward',
        tolerance=pd.Timedelta(minutes=age_minutes))
    available=merged.available_at.notna()
    for name in ('market_return_15m','sector_return_15m'):
        result[name]=merged[name].fillna(0).to_numpy()
    result['context_available']=available.astype(int).to_numpy()
    return result


def _add_news(result,dataset):
    result['news_count_60m']=0
    result['news_available']=int(dataset.news is not None)
    if dataset.news is None or dataset.news.empty:
        return result
    news=dataset.news.copy(deep=True)
    _columns(news,['event_id','published_at','available_at','event_type'],'news')
    for column in ('published_at','available_at'):
        news[column]=_times(news[column],f'news.{column}')
    if news.available_at.lt(news.published_at).any() or news.event_id.isna().any():
        raise ValueError('invalid event availability or event_id')
    news=news.sort_values('available_at',kind='stable').drop_duplicates('event_id',keep='first')
    event_times=pd.DatetimeIndex(news.available_at)
    decisions=pd.DatetimeIndex(result.decision_time)
    # Exclude the lower endpoint; include information becoming available exactly
    # at the decision. Publication alone never makes delayed data observable.
    high=event_times.searchsorted(decisions,side='right')
    low=event_times.searchsorted(decisions-pd.Timedelta(minutes=60),side='right')
    result['news_count_60m']=high-low
    return result


def build_features(dataset: Dataset, config: dict | None = None) -> pd.DataFrame:
    """Return causally available features; no target or future session totals."""
    cfg=_configuration(config)
    bars,sessions=_feature_inputs(dataset)
    frames=[]
    previous_close=np.nan
    cursor=0
    for session_number,session in enumerate(sessions.itertuples()):
        minutes=int((session.close-session.open).total_seconds()//60)
        day=bars.iloc[cursor:cursor+minutes].copy()
        cursor+=minutes
        complete=(minutes//5)*5
        if not complete:
            previous_close=float(day.close.iloc[-1])
            continue
        try:
            with np.errstate(over='raise',invalid='raise'):
                turnover_values=np.cumsum(day.close.to_numpy()*day.volume.to_numpy())
                volume_values=np.cumsum(day.volume.to_numpy())
            if not np.isfinite(turnover_values).all() or not np.isfinite(volume_values).all():
                raise FloatingPointError('nonfinite accumulation')
        except FloatingPointError as exc:
            raise ValueError('invalid data: numerical overflow in cumulative turnover or volume arithmetic') from exc
        minute_turnover=pd.Series(turnover_values,index=day.index)
        cumulative_volume=pd.Series(volume_values,index=day.index)
        day=day.iloc[:complete].copy()
        day['_bucket']=np.arange(complete)//5
        aggregated=day.groupby('_bucket',sort=True).agg(
            first_open=('open','first'),high=('high','max'),low=('low','min'),
            last_price=('close','last'),volume=('volume','sum'))
        aggregated['_bucket']=aggregated.index
        aggregated['_session_number']=session_number
        aggregated['decision_time']=session.open+pd.to_timedelta((aggregated.index+1)*5,unit='min')
        aggregated['session_date']=str(session.session_date)
        aggregated['session_open']=session.open
        aggregated['session_close']=session.close
        aggregated['_cumulative_volume']=aggregated.volume.cumsum()
        for periods,name in ((1,'return_5m'),(3,'return_15m'),(12,'return_60m')):
            aggregated[name]=aggregated.last_price.pct_change(periods=periods,fill_method=None)
        last_indices=np.arange(4,complete,5)
        vwap=(minute_turnover.iloc[last_indices].to_numpy()/
            cumulative_volume.iloc[last_indices].replace(0,np.nan).to_numpy())
        aggregated['vwap_distance']=aggregated.last_price.to_numpy()/vwap-1
        aggregated['range_5m']=(aggregated.high-aggregated.low)/aggregated.last_price
        aggregated['volatility_30m']=aggregated.return_5m.rolling(6,min_periods=6).std(ddof=1)
        aggregated['day_return']=aggregated.last_price/float(day.open.iloc[0])-1
        aggregated['gap_return']=float(day.open.iloc[0])/previous_close-1
        aggregated['opening_range_ready']=aggregated['_bucket']>=5
        aggregated['opening_range_high']=np.nan
        aggregated['opening_range_low']=np.nan
        if len(aggregated)>=6:
            ready=aggregated.opening_range_ready
            aggregated.loc[ready,'opening_range_high']=aggregated.high.iloc[:6].max()
            aggregated.loc[ready,'opening_range_low']=aggregated.low.iloc[:6].min()
        frames.append(aggregated.reset_index(drop=True))
        # A partial last bucket still belongs to the previous session close.
        previous_close=float(bars.iloc[cursor-1].close)
    if not frames:
        result=pd.DataFrame(columns=_OUTPUT_COLUMNS)
        result['decision_time']=pd.Series(dtype='datetime64[ns, UTC]')
        for name in ('rvol_ready','opening_range_ready'):
            result[name]=pd.Series(dtype=bool)
        return result
    result=pd.concat(frames,ignore_index=True)
    lookback=cfg['volume_lookback_sessions']
    minimum=cfg['min_volume_history_sessions']
    denominators=[]
    for column in ('volume','_cumulative_volume'):
        # Reindex to every supplied session, including short sessions without a
        # complete bucket. The lookback is a session window, not N observations.
        pivot=result.pivot(index='_session_number',columns='_bucket',values=column).reindex(range(len(sessions)))
        baseline=pivot.shift(1).rolling(lookback,min_periods=minimum).mean()
        denominator=baseline.to_numpy()[result._session_number.to_numpy(),result._bucket.to_numpy()]
        denominators.append(denominator)
    interval_den,cumulative_den=denominators
    ready=np.isfinite(interval_den)&(interval_den>0)&np.isfinite(cumulative_den)&(cumulative_den>0)
    result['rvol_ready']=ready
    result['rvol']=result.volume.to_numpy()/np.where(ready,interval_den,np.nan)
    result['cumulative_rvol']=result._cumulative_volume.to_numpy()/np.where(ready,cumulative_den,np.nan)
    result=_add_context(result,dataset,cfg['context_max_age_minutes'])
    result=_add_news(result,dataset)
    return result[_OUTPUT_COLUMNS].reset_index(drop=True)
