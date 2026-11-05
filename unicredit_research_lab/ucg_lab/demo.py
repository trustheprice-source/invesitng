"""Generate invented OHLCV for software testing; never market evidence."""

from __future__ import annotations

import json
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd


def create_demo(out: str | Path, sessions: int = 180, seed: int = 17) -> Path:
    if isinstance(sessions, bool) or not isinstance(sessions, int) or not 2 <= sessions <= 2000:
        raise ValueError('sessions must be an integer between 2 and 2000')
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    if any((out / name).exists() for name in ('manifest.json', 'bars.csv', 'sessions.csv')):
        raise FileExistsError('Refusing to overwrite an existing dataset')
    rng = np.random.default_rng(seed)
    rows, calendar = [], []
    previous = 20.0
    for day in pd.bdate_range('2020-01-06', periods=sessions):
        start = pd.Timestamp(f'{day.date()} 09:00', tz=ZoneInfo('Europe/Rome')).tz_convert('UTC')
        end = start + pd.Timedelta(minutes=180)
        calendar.append({'session_date': str(day.date()), 'open': start.isoformat(), 'close': end.isoformat()})
        price = previous * np.exp(rng.normal(0, 0.003))
        returns = rng.normal(0, 0.0009, 180)
        for minute, change in enumerate(returns):
            opening = price
            close = opening * np.exp(change)
            wick = opening * abs(rng.normal(0.0003, 0.00015))
            volume = int(max(1, rng.lognormal(8.3, 0.4) * (1 + 0.7 * np.cos(np.pi * minute / 179)**2)))
            spread = opening * 0.0004
            rows.append({'timestamp': (start + pd.Timedelta(minutes=minute)).isoformat(),
                         'open': opening, 'high': max(opening, close) + wick,
                         'low': min(opening, close) - wick, 'close': close, 'volume': volume,
                         'bid_open': opening - spread / 2, 'ask_open': opening + spread / 2})
            price = close
        previous = price
    pd.DataFrame(rows).to_csv(out / 'bars.csv', index=False, float_format='%.10f')
    pd.DataFrame(calendar).to_csv(out / 'sessions.csv', index=False)
    manifest = {
        'schema_version': 1, 'symbol': 'UCG', 'currency': 'EUR', 'timezone': 'Europe/Rome',
        'data_kind': 'synthetic', 'bar_minutes': 1, 'timestamp_semantics': 'interval_start',
        'price_basis': 'raw', 'volume_basis': 'primary_continuous',
        'source': 'Invented seeded random process; NOT UniCredit market data',
        'source_reference': f'synthetic-generator-v0.1 seed={seed}',
        'acquired_at': '2026-11-05T00:00:00+00:00',
        'license_note': 'Generated software fixture; contains no licensed market observations',
        'corporate_action_policy': 'Synthetic series has no corporate actions',
        'bars_file': 'bars.csv', 'sessions_file': 'sessions.csv', 'provenance_verified': False,
        'notes': 'Invented weekday 09:00–12:00 sessions; NOT the real Milan calendar or full trading day.',
    }
    path = out / 'manifest.json'
    path.write_text(json.dumps(manifest, indent=2) + '\n')
    return path
