# UniCredit Research Lab

**A complete Codex handoff project with runnable historical research, a simulated broker core, tests and an autonomous continuation plan.**

It searches for repeatable UCG intraday opportunities using historical price, same-clock volume, optional market context and timestamped events. It compares three fixed rule hypotheses and ridge regression; LightGBM is an optional challenger. A final historical period is reserved, a selected candidate is frozen, and final evaluation is recorded once.

**No profitable UniCredit strategy has been found by this delivery. No real UniCredit dataset is included. All included demonstration prices are invented. The project has no live broker connection.**

## Give it to Codex

1. Unzip this folder into a new project directory on your computer.
2. Open the folder in Codex.
3. Paste the complete contents of `CODEX_START_PROMPT.md`.

Codex should read the project, run the tests/demo, audit data access, and continue the prioritized work. It must preserve failed experiments and cannot promise a profitable result. You do not need to paste the earlier conversation: the requirements and decisions are in this folder.

## Run it yourself

Python **3.11 or later**. Commands below are for macOS/Linux, from this project directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
python -m unittest discover -s tests -v
python scripts/run_demo.py
```

The demo prints its output directory. Open its `study/development/report.html` and `study/holdout/report.html` in a browser. These are local files with no server, analytics or remote assets.

`requirements-tested.txt` records the numerical versions used during delivery validation. The package declares compatible version ranges; every study records its actual environment and refuses silent environment changes on resume/final evaluation. LightGBM is optional:

```bash
python -m pip install -e '.[boosting]'
```

Installing the optional package alone does not add experiments: explicitly declare a LightGBM candidate within the fixed research budget. That adapter was not exercised with a real LightGBM installation in the delivery environment; its unavailable-dependency behavior was tested.

## Individual commands

```bash
python -m ucg_lab demo --out workspace/demo_data --sessions 180
python -m ucg_lab init-config --profile demo --out workspace/demo_config.json
python -m ucg_lab audit --manifest workspace/demo_data/manifest.json
python -m ucg_lab research --manifest workspace/demo_data/manifest.json --config workspace/demo_config.json --out workspace/demo_study
python -m ucg_lab freeze --study workspace/demo_study --candidate ridge_v1
python -m ucg_lab holdout --study workspace/demo_study
python -m ucg_lab handoff --study workspace/demo_study
python -m ucg_lab status --study workspace/demo_study
python -m ucg_lab analogs --study workspace/demo_study --max-cases 10
```

`ridge_v1` is selected here only to exercise the demonstration, not because it has a proven advantage. A repeated holdout command deliberately fails. A repeated unchanged development run resumes from recorded trials; it does not erase failures or generate a new lottery of results. Do not copy/delete the ledger to pretend an already-seen period is unseen.

For authorized real data, create the canonical dataset described in `docs/DATA_GUIDE.md`, then use `init-config --profile real`. The real profile uses 252 training sessions, 63-session development evaluation blocks and 126 reserved final sessions. Those are engineering defaults, not proof that this amount of data is enough. Historical acquisition targets 5–10 years if suitable data is available.

## What is implemented

| Component | Behavior |
|---|---|
| Data audit | Strict CSV field counts, offset-aware UTC timestamps, complete supplied calendar minutes, OHLC consistency, quotes, finite values, source metadata and input hashes. |
| Causal features | Completed five-minute bars, prior-session same-clock interval/cumulative relative volume, recent returns/ranges/volatility, approximate VWAP, opening range, optional context and event counts. |
| Strategy hypotheses | Volume-supported pullback recovery, opening-range breakout and mean reversion; all unproven defaults. |
| Numerical models | Ridge regression with training-only preprocessing, chronological outcome purging; optional LightGBM without silent fallback. |
| Historical execution | Long/cash, whole shares, delayed entries, commission minimums, spread/slippage, one position, signal reset, stops, daily brake and session liquidation. |
| Evidence | Net returns, costs, daily-close drawdown, day/week coverage, inactive stretches, dependent-block bootstrap diagnostics and explicit synthetic/research/candidate states. |
| Research state | SQLite trial registry, fixed search budget, frozen candidate and one-shot final test. Data/code/environment changes invalidate the identity. |
| Reports | Portable HTML, JSON, per-candidate trade/equity/signal CSVs and execution event logs. |
| Paper account core | Local simulated order/quote processing, delayed fills, displayed-size checks, capital limits, duplicate protection, stale/future rejection and persistence. |
| OpenClaw handoff | Versioned paper-only JSON contract and integration instructions; not an installed plugin or live broker adapter. |

## What still requires work and real inputs

- Licensed/authorized historical and live UCG feeds, actual coverage and corporate-action reconciliation.
- Provider-format adapters; canonical CSV ingestion already works.
- Verified broker commissions, account restrictions, executable spreads and proposed notional.
- A personal numerical risk mandate and predeclared statistical acceptance protocol.
- Expanded robustness diagnostics: cost/delay/regime stress, intraday drawdown and exposure-aware benchmark reporting.
- Rich original news/consensus vintages and temporally valid text models; event counts are already supported.
- A live data service that calls the frozen signal logic and schedules paper entries/exits using the real calendar.
- Prospective paper performance. The file-fed paper broker core does not automatically run the historical strategy, enforce exchange sessions, schedule stops/exits or supply market data.
- Any real-money broker integration. There is no switch that turns this version into live trading.

The continuation plan names these gaps. It does not hide them behind placeholder claims.

## Important interpretation limits

The loader checks a supplied calendar, not whether the exchange actually opened. A manifest's `provenance_verified` flag records a review declaration; it cannot prove the source is accurate. Minute-bar stops and quote-snapshot fills are approximations. Reported drawdown is based on **daily closing equity**, not maximum intraday loss. Fixed-horizon model targets differ from the simulator's stop/early-exit policy. Model quality must be measured by the complete executed strategy.

Bootstrap intervals are approximate and rely on dependence/stability assumptions. Search adjustment applies only to the declared family; human/AI research across new studies still needs pooled accounting. Final-holdout protection is a local workflow guard, not tamper-proof or cross-machine enforcement. `HISTORICAL_CANDIDATE` and `PAPER_CANDIDATE` are screening states, never a probability guarantee or live authorization.

No paid language-model API is called by the included numerical pipeline. Data subscriptions, broker market data and your own computing may still have costs.

## Project map

- `CODEX_START_PROMPT.md`: paste into Codex to begin.
- `PROJECT.md`, `AGENTS.md`: binding scope and research integrity rules.
- `docs/CONTRACTS.md`: exact module interfaces and timing conventions.
- `docs/DATA_GUIDE.md`: input formats and acquisition audit.
- `docs/RESEARCH_PROTOCOL.md`: experimental design, statistics and acceptance limits.
- `docs/OPENCLAW_HANDOFF.md`: paper integration contract and commands.
- `docs/STATUS.md`, `docs/CONTINUATION.md`: verified state and remaining queue.
- `docs/VERIFICATION.md`: final delivery checks, environment and verification limits.
- `ucg_lab/`: executable implementation; `tests/`: financial/data/integration regressions.
- `configs/`: explicit demo and real-data research assumptions.
- `examples/`: synthetic report and input templates; no genuine market results.
- `docs/SOURCES.md`: primary-source references used for the design.

This independent research project is not affiliated with UniCredit, Euronext, a broker, OpenAI or OpenClaw.
