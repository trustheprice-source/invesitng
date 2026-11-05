# UniCredit Research Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a runnable, audited historical research and paper-workflow project for Codex, without claiming a trading edge.

**Architecture:** Immutable canonical inputs feed causal five-minute features, fixed rules/numerical challengers and a deterministic long/cash simulator. Chronological evaluation writes an append-only experiment record; frozen final tests and paper artifacts remain explicitly distinct from live authorization.

**Tech Stack:** Python 3.11+, numpy, pandas, scikit-learn, SQLite, unittest; optional LightGBM; local HTML reports.

**Spec:** `PROJECT.md` and exact interfaces in `docs/CONTRACTS.md`.

## Global Constraints

- Python 3.11+, numpy, pandas, scikit-learn. Optional LightGBM. Standard-library unittest, no pytest required.
- Synthetic data is permanently marked synthetic in all reports and handoffs and can never qualify a strategy for live trading.
- No live broker path is implemented or authorized.
- Preserve UTC-aware timestamps and the interval-start contract.
- Record every attempt before evaluation and consume a frozen final holdout once.
- No data purchases, unauthorized access, paid AI calls, fabricated data or automatic installation of external agent skills.

## Review Focus

- A future price/news mutation must not change earlier features or trained predictions.
- Missing bars, timezone errors and zero-volume execution cannot create profitable fills.
- Minimum commissions and whole-share rounding cannot make cash negative or misstate net profit.
- Many correlated signals must not inflate trade count, day/week coverage or confidence.
- Repeated or modified holdout commands and synthetic data cannot produce live eligibility.

## Task A: Data and causal features

Files: `ucg_lab/data.py`, `ucg_lab/features.py`, `tests/test_data.py`, `tests/test_features.py`.

Interfaces: all Dataset/data/feature definitions in `docs/CONTRACTS.md`.

- [x] Write failing tests for duplicate/missing bars, offset-naive timestamps, path escape, same-clock historical volume, cumulative volume, future mutation, event availability and opening-range completion.
- [x] Run `python -m unittest discover -s tests -p 'test_data.py' -v` and corresponding feature tests; observe missing behavior.
- [x] Implement data validation/audit and feature transforms under the exact contract.
- [x] Run owned tests and available full suite. Report red/green commands and any unrelated failures.

## Task B: Rules, execution and labels

Files: `ucg_lab/strategies.py`, `ucg_lab/backtest.py`, `tests/test_backtest.py`, `tests/test_strategies.py`.

Interfaces: strategy/backtest/label contracts in `docs/CONTRACTS.md`; no imports from root orchestration.

- [x] Write failing literal financial fixtures: delayed entry, commission minimum, zero-volume skip, spread once, affordability, stop gap, same-day liquidation and one entry per signal episode.
- [x] Run owned tests and observe missing behavior.
- [x] Implement the deterministic simulator, fixed rule family and future labels.
- [x] Verify net P&L against hand-calculated amounts and run available full suite.

## Task C: Models, uncertainty and evidence

Files: `ucg_lab/models.py`, `ucg_lab/validation.py`, `tests/test_models.py`, `tests/test_validation.py`.

Interfaces: numerical/evidence/analog contracts in `docs/CONTRACTS.md`.

- [x] Write failing tests for chronology/purging, train-only imputation, unavailable optional model, future-safe analogs, zero-trade week coverage, initial-equity drawdown, dependent-block CI and synthetic nonqualification.
- [x] Observe failing owned tests.
- [x] Implement model fitting and finite, JSON-safe evidence diagnostics.
- [x] Run owned and available full suite, recording exact results.

## Task D: Workflow and user handoff

Files: root-owned modules `config.py`, `demo.py`, `ledger.py`, `workflow.py`, `reporting.py`, `cli.py`, `paper.py`, package entry points; corresponding tests; config/schema/examples/docs.

- [x] Write behavior tests for configuration validation, duplicate experiment refusal, bounded search, one-use holdout, artifact hashing, demo labels, paper idempotency, stale/future data and output escaping.
- [x] Observe failures; implement using module contracts.
- [x] Execute a synthetic audit -> research -> freeze -> holdout -> paper export workflow and a second-holdout refusal.
- [x] Write README, starter prompt, input instructions, evidence protocol, costs/risk assumptions, OpenClaw paper contract and honest continuation backlog.
- [x] Have independent reviewers assess each domain and the integrated workflow, fix concrete findings and rerun affected checks plus the final suite.
- [x] Package a deterministic ZIP, inspect its contents, verify extracted execution, and save the deliverable.
