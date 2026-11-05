"""Explicit research assumptions with conservative input validation."""

from __future__ import annotations

import copy
import hashlib
import json
import math
from pathlib import Path


DEFAULT_CONFIG = {
    "schema_version": 1,
    "study_id": "ucg_intraday_v1",
    "features": {
        "bar_minutes": 5,
        "volume_lookback_sessions": 20,
        "min_volume_history_sessions": 10,
        "context_max_age_minutes": 15,
    },
    "execution": {
        "initial_cash": 10000.0,
        "allocation_fraction": 0.25,
        "commission_rate": 0.0005,
        "minimum_commission": 3.0,
        "round_trip_spread_bps": 10.0,
        "slippage_bps_per_side": 2.0,
        "execution_mode": "bar_proxy",
        "latency_minutes": 1,
        "holding_minutes": 30,
        "stop_loss_pct": 0.01,
        "daily_loss_limit_pct": 0.02,
        "score_threshold": 0.0,
        "cooldown_minutes": 5,
    },
    "research": {
        "train_sessions": 60,
        "test_sessions": 20,
        "holdout_sessions": 30,
        "max_trials": 12,
        "bootstrap_samples": 5000,
        "block_length": 5,
        "alpha": 0.05,
        "seed": 17,
    },
    "criteria": {
        "min_evaluation_sessions": 60,
        "min_trades": 30,
        "min_active_week_fraction": 0.6,
        "max_drawdown": 0.1,
        "min_mean_daily_return": 0.0,
    },
    "assumptions": {
        "broker_costs_verified": False,
        "risk_mandate_approved": False,
        "notes": "Illustrative research assumptions; ordinary matched same-day share round trips only. Personal tax, data fees and operating costs excluded.",
    },
    "candidates": [
        {"id": "pullback_v1", "kind": "rule", "name": "trend_pullback", "parameters": {}, "score_threshold": 0.0},
        {"id": "breakout_v1", "kind": "rule", "name": "opening_breakout", "parameters": {}, "score_threshold": 0.0},
        {"id": "reversion_v1", "kind": "rule", "name": "mean_reversion", "parameters": {}, "score_threshold": 0.0},
        {"id": "ridge_v1", "kind": "model", "name": "ridge", "parameters": {"alpha": 10.0}, "score_threshold": 0.0005},
    ],
}


def canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def content_hash(value: object) -> str:
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


def _number(value: object, name: str, low: float, high: float | None = None, integer: bool = False) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be finite numeric")
    if integer and type(value) is not int:
        raise ValueError(f"{name} must be an integer")
    if value < low or (high is not None and value > high):
        raise ValueError(f"{name} outside allowed range")


def validate_config(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("Configuration must be an object")
    unknown = set(raw) - set(DEFAULT_CONFIG)
    if unknown:
        raise ValueError(f"Unknown config fields: {sorted(unknown)}")
    result = copy.deepcopy(DEFAULT_CONFIG)
    for key, value in raw.items():
        if key in {"features", "execution", "research", "criteria", "assumptions"}:
            if not isinstance(value, dict) or set(value) - set(DEFAULT_CONFIG[key]):
                raise ValueError(f"Invalid or unknown {key} fields")
            result[key].update(value)
        else:
            result[key] = copy.deepcopy(value)
    if type(result["schema_version"]) is not int or result["schema_version"] != 1:
        raise ValueError("Unsupported configuration schema")
    study_id = result["study_id"]
    if not isinstance(study_id, str) or not study_id or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for c in study_id):
        raise ValueError("study_id must contain only letters, numbers, underscores or hyphens")
    f, e, r, c = (result[k] for k in ("features", "execution", "research", "criteria"))
    if type(f["bar_minutes"]) is not int or f["bar_minutes"] != 5:
        raise ValueError("Only completed five-minute signal bars supported")
    for key in ("volume_lookback_sessions", "min_volume_history_sessions", "context_max_age_minutes"):
        _number(f[key], key, 1, integer=True)
    if f["min_volume_history_sessions"] > f["volume_lookback_sessions"]:
        raise ValueError("Minimum volume history exceeds lookback")
    _number(e["initial_cash"], "initial_cash", 1)
    _number(e["allocation_fraction"], "allocation_fraction", 0.000001, 1)
    for key in ("commission_rate", "minimum_commission", "round_trip_spread_bps", "slippage_bps_per_side"):
        _number(e[key], key, 0)
    _number(e["commission_rate"], "commission_rate", 0, 0.1)
    _number(e["round_trip_spread_bps"], "round_trip_spread_bps", 0, 1000)
    _number(e["slippage_bps_per_side"], "slippage_bps_per_side", 0, 1000)
    for key in ("latency_minutes", "holding_minutes"):
        _number(e[key], key, 1, 1440, integer=True)
    _number(e["cooldown_minutes"], "cooldown_minutes", 0, 1440, integer=True)
    for key in ("stop_loss_pct", "daily_loss_limit_pct"):
        _number(e[key], key, 0.000001, 1)
    if e["stop_loss_pct"] >= 1:
        raise ValueError("stop_loss_pct must be strictly less than 1")
    _number(e["score_threshold"], "score_threshold", -1, 1)
    if e["execution_mode"] not in {"bar_proxy", "quote_snapshot"}:
        raise ValueError("Unknown execution mode")
    for key in ("train_sessions", "test_sessions", "holdout_sessions", "max_trials", "block_length"):
        _number(r[key], key, 1, integer=True)
    _number(r["bootstrap_samples"], "bootstrap_samples", 200, 100000, integer=True)
    _number(r["alpha"], "alpha", 0.000001, 0.2)
    _number(r["seed"], "seed", 0, 2**32 - 1, integer=True)
    for key in ("min_evaluation_sessions", "min_trades"):
        _number(c[key], key, 1, integer=True)
    for key in ("min_active_week_fraction", "max_drawdown"):
        _number(c[key], key, 0, 1)
    _number(c["min_mean_daily_return"], "min_mean_daily_return", 0, 1)
    for key in ("broker_costs_verified", "risk_mandate_approved"):
        if type(result["assumptions"][key]) is not bool:
            raise ValueError(f"{key} must be boolean")
    candidates = result["candidates"]
    if not isinstance(candidates, list) or not candidates or len(candidates) > r["max_trials"]:
        raise ValueError("Candidate count must fit the predeclared search budget")
    ids = set()
    for candidate in candidates:
        if not isinstance(candidate, dict) or set(candidate) != {"id", "kind", "name", "parameters", "score_threshold"}:
            raise ValueError("Candidate fields must be id, kind, name, parameters, score_threshold")
        cid = candidate["id"]
        if not isinstance(cid, str) or not cid or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for ch in cid) or cid in ids:
            raise ValueError("Candidate IDs must be unique safe identifiers")
        ids.add(cid)
        names = {"rule": {"trend_pullback", "opening_breakout", "mean_reversion"}, "model": {"ridge", "lightgbm"}}
        if candidate["kind"] not in names or candidate["name"] not in names[candidate["kind"]]:
            raise ValueError("Unknown candidate kind or model")
        if not isinstance(candidate["parameters"], dict):
            raise ValueError("Candidate parameters must be an object")
        _number(candidate["score_threshold"], "candidate threshold", -1, 1)
    canonical_json(result)  # Reject NaN/infinity anywhere, including model parameters.
    return result


def load_config(path: str | Path) -> dict:
    return validate_config(json.loads(Path(path).read_text()))
