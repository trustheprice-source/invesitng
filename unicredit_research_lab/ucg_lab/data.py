"""Strict canonical CSV ingestion; input bytes are never modified.

Calendar validation checks supplied intervals, not whether an exchange actually
opened. Provenance declarations require independent review outside this loader.
"""
from dataclasses import dataclass
import csv
from io import BytesIO, StringIO
import hashlib
import json
from pathlib import Path
import re
from typing import Any
import numpy as np
import pandas as pd


@dataclass
class Dataset:
    bars: pd.DataFrame
    sessions: pd.DataFrame
    manifest: dict
    dataset_hash: str
    audit: dict
    context: pd.DataFrame | None = None
    news: pd.DataFrame | None = None


_REQUIRED = {'schema_version','symbol','currency','timezone','data_kind','bar_minutes',
    'timestamp_semantics','price_basis','volume_basis','source','source_reference',
    'acquired_at','license_note','corporate_action_policy','bars_file','sessions_file',
    'provenance_verified'}


def _times(values, name):
    parsed = []
    for value in values:
        try:
            stamp = pd.Timestamp(value)
            if pd.isna(stamp) or stamp.tzinfo is None:
                raise ValueError('UTC offset required')
            parsed.append(stamp.tz_convert('UTC'))
        except (ValueError, TypeError, OverflowError) as exc:
            raise ValueError(f'{name}: invalid timestamp with UTC offset required') from exc
    return pd.Series(pd.DatetimeIndex(parsed, tz='UTC'), index=values.index, name=values.name)


def _columns(frame, required, name):
    missing = set(required) - set(frame.columns)
    if missing:
        raise ValueError(f'{name}: missing columns {sorted(missing)}')


def _numeric(frame, columns, name):
    for column in columns:
        try:
            frame[column] = pd.to_numeric(frame[column], errors='raise')
        except (TypeError, ValueError) as exc:
            raise ValueError(f'{name}: {column} must be numeric') from exc
        if not np.isfinite(frame[column].to_numpy(dtype=float)).all():
            raise ValueError(f'{name}: nonfinite {column}')


def _ordered(values, name):
    if values.duplicated().any() or not values.is_monotonic_increasing:
        raise ValueError(f'{name}: must be unique and sorted chronologically')


def _whole_minutes(values, name):
    if not values.eq(values.dt.floor('min')).all():
        raise ValueError(f'{name}: timestamps must lie on whole minutes')


def _manifest_valid(manifest):
    missing = _REQUIRED - set(manifest)
    if missing:
        raise ValueError(f'manifest: missing fields {sorted(missing)}')
    constants = dict(schema_version=1,symbol='UCG',currency='EUR',timezone='Europe/Rome',
        bar_minutes=1,timestamp_semantics='interval_start',price_basis='raw',volume_basis='primary_continuous')
    for name, value in constants.items():
        if manifest[name] != value or isinstance(manifest[name], bool):
            raise ValueError(f'manifest: unsupported {name}')
    if manifest['data_kind'] not in ('synthetic','real'):
        raise ValueError('manifest: invalid data_kind')
    if type(manifest['provenance_verified']) is not bool:
        raise ValueError('manifest: provenance_verified must be boolean')
    for name in ('source','source_reference','license_note','corporate_action_policy'):
        if not isinstance(manifest[name],str) or not manifest[name].strip():
            raise ValueError(f'manifest: {name} must be declared')
    _times(pd.Series([manifest['acquired_at']]), 'acquired_at')
    if pd.Timestamp(manifest['acquired_at']).utcoffset().total_seconds() != 0:
        raise ValueError('manifest: acquired_at must use UTC')


def _validated_frames(dataset):
    _manifest_valid(dataset.manifest)
    bars, sessions = dataset.bars.copy(deep=True), dataset.sessions.copy(deep=True)
    _columns(sessions, ['session_date','open','close'], 'sessions')
    _columns(bars, ['timestamp','open','high','low','close','volume'], 'bars')
    if sessions.empty or bars.empty:
        raise ValueError('sessions and bars must not be empty')
    sessions['session_date'] = sessions.session_date.astype(str)
    if not sessions.session_date.map(lambda x: bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',x))).all():
        raise ValueError('sessions: session_date must be ISO dates')
    _ordered(sessions.session_date,'session dates')
    for column in ('open','close'):
        sessions[column] = _times(sessions[column],f'sessions.{column}')
        _whole_minutes(sessions[column],f'sessions.{column}')
        if not sessions[column].dt.tz_convert('Europe/Rome').dt.strftime('%Y-%m-%d').eq(sessions.session_date).all():
            raise ValueError('sessions: local calendar date inconsistent with Europe/Rome')
    if not sessions.open.lt(sessions.close).all():
        raise ValueError('sessions: open must be before close')
    if len(sessions)>1 and (sessions.open.iloc[1:].reset_index(drop=True) < sessions.close.iloc[:-1].reset_index(drop=True)).any():
        raise ValueError('sessions: overlapping intervals')
    bars['timestamp'] = _times(bars.timestamp,'bars.timestamp')
    _whole_minutes(bars.timestamp,'bars.timestamp')
    _ordered(bars.timestamp,'bars timestamps')
    _numeric(bars,['open','high','low','close','volume'],'bars')
    if not bars[['open','high','low','close']].gt(0).all().all() or bars.volume.lt(0).any():
        raise ValueError('bars: prices must be positive and volume nonnegative')
    if not (bars.low.le(bars.open) & bars.low.le(bars.close) & bars.high.ge(bars.open) & bars.high.ge(bars.close)).all():
        raise ValueError('bars: invalid OHLC ordering')
    quote_columns = {'bid_open','ask_open'} & set(bars.columns)
    if quote_columns and len(quote_columns)!=2:
        raise ValueError('bars: bid_open and ask_open must be paired')
    if quote_columns:
        _numeric(bars,['bid_open','ask_open'],'bars quotes')
        if not (bars.bid_open.gt(0) & bars.ask_open.gt(0) & bars.bid_open.le(bars.ask_open)).all():
            raise ValueError('bars: invalid bid/ask ordering or prices')
    # Concatenation avoids membership guesses and catches missing/outside rows.
    expected_parts = [pd.date_range(row.open,row.close,freq='min',inclusive='left') for row in sessions.itertuples()]
    expected = expected_parts[0].append(expected_parts[1:])
    actual = pd.DatetimeIndex(bars.timestamp)
    if not actual.equals(expected):
        missing, extra = expected.difference(actual), actual.difference(expected)
        raise ValueError(f'bars: session minute coverage mismatch ({len(missing)} missing, {len(extra)} out of session)')
    context = None if dataset.context is None else dataset.context.copy(deep=True)
    if context is not None:
        _columns(context,['available_at','market_return_15m','sector_return_15m'],'context')
        context['available_at'] = _times(context.available_at,'context.available_at')
        _ordered(context.available_at,'context.available_at')
        _numeric(context,['market_return_15m','sector_return_15m'],'context')
    news = None if dataset.news is None else dataset.news.copy(deep=True)
    if news is not None:
        _columns(news,['event_id','published_at','available_at','event_type'],'news')
        for column in ('event_id','event_type'):
            if news[column].isna().any() or news[column].astype(str).str.strip().eq('').any():
                raise ValueError(f'news: empty {column}')
            news[column] = news[column].astype(str)
        for column in ('published_at','available_at'):
            news[column] = _times(news[column],f'news.{column}')
        if news.available_at.lt(news.published_at).any():
            raise ValueError('news: available_at cannot precede published_at')
        news = news.sort_values('available_at',kind='stable').drop_duplicates('event_id',keep='first').reset_index(drop=True)
    return bars.reset_index(drop=True),sessions.reset_index(drop=True),context,news


def _safe_path(directory, name):
    if not isinstance(name,str) or not name or Path(name).is_absolute():
        raise ValueError('input path must be relative to manifest directory')
    path = (directory / name).resolve()
    if not path.is_relative_to(directory):
        raise ValueError('input path escapes manifest directory')
    if not path.is_file():
        raise ValueError(f'input path is not a file: {name}')
    return path


def load_dataset(manifest_path: str | Path) -> Dataset:
    """Read and hash exact manifest/input bytes, then validate without repairs."""
    path = Path(manifest_path).resolve()
    try:
        raw_manifest = path.read_bytes()
        manifest = json.loads(raw_manifest)
        if not isinstance(manifest,dict):
            raise ValueError('manifest must be an object')
        _manifest_valid(manifest)
        digest = hashlib.sha256()
        digest.update(len(raw_manifest).to_bytes(8,'big') + raw_manifest)
        frames = {}
        for key in ('bars_file','sessions_file','context_file','news_file'):
            if key not in manifest:
                continue
            raw = _safe_path(path.parent,manifest[key]).read_bytes()
            digest.update(key.encode()+len(raw).to_bytes(8,'big')+raw)
            records = csv.reader(StringIO(raw.decode('utf-8-sig')), strict=True)
            header = next(records, [])
            if not header or len(header)!=len(set(header)) or any(not name for name in header):
                raise ValueError(f'{key}: empty or duplicate CSV columns')
            for record_number, record in enumerate(records, start=2):
                if len(record)!=len(header):
                    raise ValueError(f'{key}: CSV record {record_number} has {len(record)} fields; expected {len(header)}')
            string_types = {'event_id':str,'event_type':str} if key=='news_file' else None
            frames[key] = pd.read_csv(BytesIO(raw),dtype=string_types,keep_default_na=False,index_col=False)
        data = Dataset(frames['bars_file'],frames['sessions_file'],manifest,digest.hexdigest(),{},frames.get('context_file'),frames.get('news_file'))
        data.bars,data.sessions,data.context,data.news = _validated_frames(data)
        data.audit = audit_dataset(data)
        return data
    except (OSError, UnicodeError, csv.Error, pd.errors.ParserError, pd.errors.EmptyDataError, TypeError, KeyError) as exc:
        raise ValueError(f'invalid dataset: {exc}') from exc


def audit_dataset(dataset: Dataset) -> dict[str, Any]:
    """Validate the in-memory snapshot; does not assert external provenance."""
    errors=[]
    try:
        _validated_frames(dataset)
    except (ValueError,TypeError,KeyError,AttributeError) as exc:
        errors.append(str(exc))
    warnings=['Calendar intervals and provenance declarations require independent verification.',
        'Zero-volume bars are observations, not guaranteed execution opportunities.']
    if dataset.manifest.get('data_kind')=='synthetic':
        warnings.append('SYNTHETIC DATA: invented sessions and prices are demonstration only.')
    if dataset.news is None:
        warnings.append('No event feed supplied; absent observations do not prove absence of events.')
    sessions=dataset.sessions
    dates=sessions.get('session_date',pd.Series(dtype=str))
    return dict(passed=not errors,errors=errors,warnings=warnings,
        data_kind=dataset.manifest.get('data_kind'),dataset_hash=str(dataset.dataset_hash),
        sessions=int(len(sessions)),bars=int(len(dataset.bars)),
        first_session=str(dates.iloc[0]) if len(dates) else None,
        last_session=str(dates.iloc[-1]) if len(dates) else None,
        quote_coverage=float(dataset.bars[['bid_open','ask_open']].notna().all(axis=1).mean())
            if len(dataset.bars) and {'bid_open','ask_open'}<=set(dataset.bars) else 0.)
