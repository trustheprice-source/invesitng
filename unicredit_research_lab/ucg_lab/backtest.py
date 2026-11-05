"""Deterministic long/cash minute replay; deliberately has no broker interface.

Bars are interval starts; decisions describe completed five-minute intervals.
The optional quote mode models snapshots, not historical order-book liquidity.
"""
from dataclasses import dataclass
from math import floor
import math
import pandas as pd


DEFAULTS = dict(initial_cash=10000., allocation_fraction=.25, commission_rate=.0005,
                minimum_commission=3., round_trip_spread_bps=10., slippage_bps_per_side=2.,
                execution_mode='bar_proxy', latency_minutes=1, holding_minutes=30,
                stop_loss_pct=.01, daily_loss_limit_pct=.02, score_threshold=0., cooldown_minutes=5)
TRADE_COLUMNS = ['entry_time','exit_time','session_date','quantity','entry_price','exit_price',
                 'entry_fee','exit_fee','gross_pnl','net_pnl','net_return','exit_reason']
EQUITY_COLUMNS = ['session_date','equity','daily_return','net_pnl','trade_count']
LABEL_COLUMNS = ['decision_time','target_return','label_end']


@dataclass
class BacktestResult:
    trades: pd.DataFrame
    equity: pd.DataFrame
    events: list[dict]


def _config(config):
    c = dict(DEFAULTS)
    c.update(config or {})
    for key in DEFAULTS:
        if key == 'execution_mode':
            continue
        value = c[key]
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
            raise ValueError(f'{key} must be finite numeric')
    if c['initial_cash'] <= 0 or not 0 < c['allocation_fraction'] <= 1:
        raise ValueError('initial_cash positive; allocation_fraction in (0,1] required')
    for key in ('commission_rate','minimum_commission','round_trip_spread_bps','slippage_bps_per_side','latency_minutes','cooldown_minutes'):
        if c[key] < 0:
            raise ValueError(f'{key} must be nonnegative')
    if c['holding_minutes'] <= 0 or not 0 < c['stop_loss_pct'] < 1 or not 0 < c['daily_loss_limit_pct'] <= 1:
        raise ValueError('holding_minutes positive; stop_loss_pct in (0,1); daily_loss_limit_pct in (0,1] required')
    for key in ('latency_minutes','holding_minutes','cooldown_minutes'):
        if c[key] != int(c[key]):
            raise ValueError(f'{key} must be whole minutes')
    if c['execution_mode'] not in ('bar_proxy','quote_snapshot'):
        raise ValueError('unknown execution_mode')
    friction = c['slippage_bps_per_side'] + (c['round_trip_spread_bps'] / 2 if c['execution_mode'] == 'bar_proxy' else 0)
    if friction >= 10000:
        raise ValueError('sell friction must be less than 10000 bps')
    return c


def commission(notional, config):
    """Per-side fee, charged only for a positive executed notional."""
    if not math.isfinite(notional) or notional < 0:
        raise ValueError('notional must be finite and nonnegative')
    rate = config.get('commission_rate', DEFAULTS['commission_rate'])
    minimum = config.get('minimum_commission', DEFAULTS['minimum_commission'])
    if not math.isfinite(rate) or not math.isfinite(minimum) or rate < 0 or minimum < 0:
        raise ValueError('commission assumptions must be finite and nonnegative')
    return float(max(minimum, notional * rate)) if notional else 0.


def _utc(series, name):
    for value in series:
        timestamp = pd.Timestamp(value)
        if pd.isna(timestamp) or timestamp.tzinfo is None:
            raise ValueError(f'{name} requires timezone-aware timestamps')
    return pd.to_datetime(series, utc=True)


def _inputs(bars, sessions, decisions, c, scores=False):
    b, s, d = bars.copy(deep=True), sessions.copy(deep=True), decisions.copy(deep=True)
    needed = {'timestamp','open','high','low','close','volume'}
    if needed - set(b.columns) or {'session_date','open','close'} - set(s.columns) or 'decision_time' not in d:
        raise ValueError('missing canonical bar/session/decision columns')
    b['timestamp'] = _utc(b.timestamp, 'timestamp')
    s['open'], s['close'] = _utc(s.open, 'session open'), _utc(s.close, 'session close')
    d['decision_time'] = _utc(d.decision_time, 'decision_time')
    s['session_date'] = s.session_date.astype(str)
    for frame, column in ((b,'timestamp'), (s,'open'), (d,'decision_time')):
        if frame[column].duplicated().any() or not frame[column].is_monotonic_increasing:
            raise ValueError(f'{column} must be unique and chronological')
    if s.session_date.duplicated().any() or (s.open >= s.close).any():
        raise ValueError('sessions must be unique and open before close')
    if len(s) > 1 and (s.open.iloc[1:].reset_index(drop=True) < s.close.iloc[:-1].reset_index(drop=True)).any():
        raise ValueError('sessions must not overlap')
    numeric = ['open','high','low','close','volume']
    if c['execution_mode'] == 'quote_snapshot':
        if not {'bid_open','ask_open'} <= set(b.columns):
            raise ValueError('quote_snapshot requires paired bid_open/ask_open quotes')
        numeric += ['bid_open','ask_open']
    for col in numeric:
        b[col] = pd.to_numeric(b[col], errors='raise')
        if not b[col].map(math.isfinite).all() or (b[col] < 0).any() or (col != 'volume' and (b[col] == 0).any()):
            raise ValueError(f'invalid finite positive prices/nonnegative volume: {col}')
    if (b.low > b[['open','close']].min(axis=1)).any() or (b.high < b[['open','close']].max(axis=1)).any() or (b.low > b.high).any():
        raise ValueError('invalid OHLC ordering')
    if c['execution_mode'] == 'quote_snapshot' and (b.bid_open > b.ask_open).any():
        raise ValueError('bid_open must not exceed ask_open')
    if scores:
        if 'score' not in d or not pd.to_numeric(d.score, errors='raise').map(math.isfinite).all():
            raise ValueError('score must be present and finite')
        d['score'] = pd.to_numeric(d.score)
    groups = []
    consumed_bars = 0
    consumed_decisions = 0
    for session in s.itertuples(index=False):
        day_b = b[(b.timestamp >= session.open) & (b.timestamp < session.close)].reset_index(drop=True)
        expected = pd.date_range(session.open, session.close, freq='min', inclusive='left')
        if not pd.DatetimeIndex(day_b.timestamp).equals(expected):
            raise ValueError('session must contain every interval-start minute with no missing bars')
        day_d = d[(d.decision_time >= session.open) & (d.decision_time <= session.close)].reset_index(drop=True)
        consumed_bars += len(day_b)
        consumed_decisions += len(day_d)
        groups.append((session, day_b, day_d))
    if consumed_bars != len(b) or consumed_decisions != len(d):
        raise ValueError('bars and decisions must belong to supplied sessions')
    return groups


def _price(bar, c, side, raw_reference=None):
    slip = c['slippage_bps_per_side'] / 10000
    if raw_reference is not None:
        # For quote stops OHLC is the disclosed proxy; do not add synthetic spread.
        friction = slip + (c['round_trip_spread_bps'] / 20000 if c['execution_mode'] == 'bar_proxy' else 0)
        return float(raw_reference * (1 - friction))
    if c['execution_mode'] == 'quote_snapshot':
        return float(bar.ask_open * (1 + slip) if side == 'buy' else bar.bid_open * (1 - slip))
    friction = slip + c['round_trip_spread_bps'] / 20000
    return float(bar.open * (1 + friction if side == 'buy' else 1 - friction))


def _quantity(cash, price, c):
    # The allocation ceiling is notional; affordability additionally includes fees.
    cap = min(c['allocation_fraction'] * cash, cash - c['minimum_commission'], cash / (1 + c['commission_rate']))
    q = max(0, floor(cap / price))
    while q and (q * price + commission(q * price, c) > cash or q * price > c['allocation_fraction'] * cash):
        q -= 1
    return q


def _trade(position, timestamp, price, reason, c):
    quantity = position['quantity']
    entry_notional = quantity * position['entry_price']
    exit_notional = quantity * price
    exit_fee = commission(exit_notional, c)
    gross = exit_notional - entry_notional
    net = gross - position['entry_fee'] - exit_fee
    return dict(entry_time=position['entry_time'], exit_time=timestamp,
                session_date=position['session_date'], quantity=quantity,
                entry_price=position['entry_price'], exit_price=price,
                entry_fee=position['entry_fee'], exit_fee=exit_fee,
                gross_pnl=gross, net_pnl=net,
                net_return=net / (entry_notional + position['entry_fee']), exit_reason=reason)


def run_backtest(bars, sessions, signals, config=None):
    """Replay a predetermined minute timeline; no signal gets a same-close fill.

    Daily brake observes liquidation equity at minute opens and realized exits.
    Once latched it blocks entries until the next supplied session, and does not
    force liquidation. It cannot bound unknown intrabar losses. A zero-volume
    stop touch queues the next available open; its actual fill may recover or gap.
    Exhausted zero-equity sessions remain zero with daily_return=0 by convention,
    without recapitalization. An exit fee creating negative equity raises because
    this version has no debt-account model.
    """
    c = _config(config)
    groups = _inputs(bars, sessions, signals, c, scores=True)
    cash = float(c['initial_cash'])
    trades, equity, events = [], [], []
    latency = pd.Timedelta(minutes=c['latency_minutes'])
    holding = pd.Timedelta(minutes=c['holding_minutes'])
    cooldown = pd.Timedelta(minutes=c['cooldown_minutes'])

    def event(kind, timestamp, **details):
        events.append(dict(type=kind, timestamp=pd.Timestamp(timestamp).isoformat(), **details))

    for session, day, decisions in groups:
        if cash == 0:
            event('account_exhausted', session.open, session_date=session.session_date,
                  reason='zero equity; trading disabled without recapitalization',
                  daily_return_convention='unchanged zero equity records zero daily return')
            equity.append(dict(session_date=session.session_date, equity=0., daily_return=0.,
                               net_pnl=0., trade_count=0))
            continue
        start_equity = cash
        count_before = len(trades)
        position, pending, pending_exit = None, None, None
        was_true, braked, last_exit = False, False, None
        decision_rows = list(decisions.itertuples(index=False))
        cursor = 0
        final_minute = session.close - pd.Timedelta(minutes=1)

        def brake(timestamp, value):
            nonlocal braked, pending
            if not braked and value <= start_equity * (1 - c['daily_loss_limit_pct']):
                braked, pending = True, None
                event('daily_loss_brake', timestamp, session_date=session.session_date,
                      liquidation_equity=float(value), start_equity=float(start_equity))

        def close_position(bar, reason, raw_reference=None):
            nonlocal cash, position, pending_exit, last_exit
            price = _price(bar, c, 'sell', raw_reference)
            trade = _trade(position, bar.timestamp, price, reason, c)
            trades.append(trade)
            cash += position['quantity'] * price - trade['exit_fee']
            if cash < 0:
                raise ValueError(
                    f'insolvent account at {bar.timestamp.isoformat()}: exit fee liability exceeds account equity; '
                    f'exit_fee={trade["exit_fee"]:.12g}, closing_equity={cash:.12g}; '
                    'negative-cash debt accounts are not supported')
            event('exit', bar.timestamp, reason=reason, quantity=int(position['quantity']))
            if reason == 'stop_loss':
                event('stop_execution_proxy', bar.timestamp, execution_mode=c['execution_mode'],
                      description='OHLC touch/gap approximation; no guaranteed stop price')
            position, pending_exit, last_exit = None, None, bar.timestamp
            brake(bar.timestamp, cash)

        for bar in day.itertuples(index=False):
            timestamp = bar.timestamp
            while cursor < len(decision_rows) and decision_rows[cursor].decision_time <= timestamp:
                signal = decision_rows[cursor]
                cursor += 1
                qualifies = signal.score > c['score_threshold']
                if not qualifies:
                    if pending is not None:
                        event('pending_entry_cancelled', signal.decision_time, reason='later_false_signal')
                    pending = None
                elif not was_true:
                    reason = None
                    if position is not None:
                        reason = 'position_open'
                    elif braked:
                        reason = 'daily_loss_brake'
                    elif last_exit is not None and signal.decision_time < last_exit + cooldown:
                        reason = 'cooldown'
                    if reason:
                        event('signal_skipped', signal.decision_time, reason=reason)
                    else:
                        pending = signal.decision_time + latency
                        event('entry_scheduled', signal.decision_time, eligible_at=pending.isoformat())
                was_true = qualifies

            # Equity marking uses the contemporaneous raw open/quote, never close.
            mark = cash
            if position is not None:
                liquidation = position['quantity'] * _price(bar, c, 'sell')
                mark += liquidation - commission(liquidation, c)
            brake(timestamp, mark)
            exited = False
            if position is not None:
                if timestamp >= final_minute:
                    reason = 'session_close'
                elif pending_exit is not None:
                    reason = pending_exit
                elif bar.open <= position['stop_price']:
                    reason = 'stop_loss'
                elif timestamp >= position['entry_time'] + holding:
                    reason = 'holding_period'
                else:
                    reason = None
                if reason:
                    if bar.volume > 0:
                        reference = min(bar.open, position['stop_price']) if reason == 'stop_loss' and pending_exit is None else None
                        close_position(bar, reason, reference)
                        exited = True
                    else:
                        pending_exit = reason
                        event('exit_skipped', timestamp, reason='zero_volume', exit_reason=reason)

            if pending is not None and timestamp >= pending:
                if timestamp >= final_minute:
                    event('entry_skipped', timestamp, reason='final_session_minute')
                    pending = None
                elif exited or position is not None:
                    pending = None
                elif braked:
                    event('entry_skipped', timestamp, reason='daily_loss_brake')
                    pending = None
                elif bar.volume <= 0:
                    event('entry_skipped', timestamp, reason='zero_volume')
                else:
                    price = _price(bar, c, 'buy')
                    quantity = _quantity(cash, price, c)
                    pending = None
                    if not quantity:
                        event('entry_skipped', timestamp, reason='whole_share_unaffordable')
                    else:
                        fee = commission(quantity * price, c)
                        position = dict(entry_time=timestamp, entry_price=price, quantity=quantity,
                                        entry_fee=fee, stop_price=price * (1 - c['stop_loss_pct']),
                                        session_date=session.session_date)
                        cash -= quantity * price + fee
                        event('entry', timestamp, quantity=int(quantity), price=price, fee=fee)

            # Intrabar low is used only after open actions, including an entry.
            if position is not None and pending_exit is None and bar.low <= position['stop_price']:
                if bar.volume > 0:
                    close_position(bar, 'stop_loss', min(bar.open, position['stop_price']))
                else:
                    pending_exit = 'stop_loss'
                    event('exit_skipped', timestamp, reason='zero_volume', exit_reason='stop_loss')
        if position is not None:
            raise ValueError(f'cannot liquidate session {session.session_date}: no closing liquidity; overnight positions forbidden')
        equity.append(dict(session_date=session.session_date, equity=cash, daily_return=cash / start_equity - 1,
                           net_pnl=cash - start_equity, trade_count=len(trades) - count_before))
    return BacktestResult(pd.DataFrame(trades, columns=TRADE_COLUMNS),
                          pd.DataFrame(equity, columns=EQUITY_COLUMNS), events)


def build_forward_labels(features, bars, sessions, config=None):
    """Hypothetical net trade returns: fixed holding, costs, initial allocation.

    No stop, cooldown, daily brake or EOD-shortened return enters this regression
    target. Labels are outcomes only. Each uses fresh initial cash independently.
    Zero-volume minutes delay fills; both entry and full holding fit the session.
    """
    c = _config(config)
    groups = _inputs(bars, sessions, features, c)
    labels = []
    latency = pd.Timedelta(minutes=c['latency_minutes'])
    holding = pd.Timedelta(minutes=c['holding_minutes'])
    for session, day, decisions in groups:
        valid = day.loc[day.volume > 0].reset_index(drop=True)
        times = pd.DatetimeIndex(valid.timestamp)
        rows = list(valid.itertuples(index=False))
        final_minute = session.close - pd.Timedelta(minutes=1)
        for decision in decisions.itertuples(index=False):
            entry_index = times.searchsorted(decision.decision_time + latency)
            if entry_index >= len(rows):
                continue
            entry = rows[entry_index]
            if entry.timestamp >= final_minute:
                continue
            exit_index = times.searchsorted(entry.timestamp + holding)
            if exit_index >= len(rows):
                continue
            exit_bar = rows[exit_index]
            if exit_bar.timestamp > final_minute:
                continue
            price = _price(entry, c, 'buy')
            q = _quantity(c['initial_cash'], price, c)
            if not q:
                continue
            position = dict(entry_time=entry.timestamp, entry_price=price, quantity=q,
                            entry_fee=commission(q * price, c), session_date=session.session_date)
            trade = _trade(position, exit_bar.timestamp, _price(exit_bar, c, 'sell'), 'holding_period', c)
            labels.append(dict(decision_time=decision.decision_time, target_return=trade['net_return'], label_end=exit_bar.timestamp))
    return pd.DataFrame(labels, columns=LABEL_COLUMNS)
