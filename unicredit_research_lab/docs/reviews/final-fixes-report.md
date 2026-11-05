# Coordinated final review fixes

Date: 2026-11-05. Scope: final review F1–F5 and user-handoff P2. Changes are uncommitted for coordinator verification and packaging. This report records focused verification performed by the implementer; it does not claim a fresh full-suite or full-demo run.

## Changes and regression evidence

| Finding | Implemented correction | Regression evidence |
| --- | --- | --- |
| F1 — total loss across folds | The orchestrator carries an exhausted account through every later evaluation session with zero equity, subsequent return, P&L and trades. It preserves the actual loss/trade exports and completed trial, skips further signals/model fitting, and never substitutes fresh capital. User starting-capital validation remains positive. | A literal five-session fixture runs through `run_research`, the real loader, features, labels, ledger and backtest. Only signals are supplied by the test. EUR100 buys one share for 97 plus 3 fee and exits for 3 less 3 fee. Three evaluation folds export equity `[0, 0, 0]`, returns `[-1, 0, 0]`, P&L `[-100, 0, 0]`, trade counts `[1, 0, 0]`, the original trade, all fold records and later exhaustion events. The candidate completes with net return -100%. |
| F2 — numerical dependency identity | Environment records now include SciPy, joblib, threadpoolctl and LightGBM, with an explicit `not_installed` state for absent distributions. Existing environment checks protect resume, freezing and holdout before a new attempt or final claim. | Each of the four added package versions is independently varied in tests. Resume and freeze reject the change without new trials or frozen artifacts; holdout rejects it with no holdout claim and unchanged frozen bytes. A separate test verifies the explicit absent-LightGBM state. Version changes are simulated metadata, not evidence of an installed or executed LightGBM adapter. |
| F3 — prospective clock overrides | Both public paper methods resolve receipt time through a mode check. Every non-None `now` override is rejected in prospective mode before account mutation. Simulation retains explicit clock support. | Direct `submit` rejection leaves no order or fill. Direct `on_quote` rejection preserves a legitimate pending order and leaves no fill. Complete snapshots remain unchanged; existing simulation timing, fee and idempotence tests pass. |
| F4 — integer and stop boundaries | Configuration integer fields require actual JSON integers. Integral floats and booleans are rejected, including schema version and fixed bar width. `stop_loss_pct=1` is rejected; the existing daily-loss-limit upper boundary remains 1. | Tests cover all 16 nested integer fields, schema version, the stop boundary, nonpositive starting cash and the supported daily-loss-limit boundary. |
| F5 — lost or unrelated registry | `StudyLedger` defaults to opening an existing registry and validates expected tables, columns, types, nullability and primary keys. Explicit creation reserves a new file exclusively. Only new-study initialization in an empty directory requests creation. Every SQLite connection uses `mode=rw`; no existing open initializes schema. Research resume, `_study_state`, freeze, holdout, handoff, analog inspection and CLI status require the existing registry. | After a completed synthetic holdout, deleting only `ledger.sqlite` causes all existing-study API paths to fail and CLI status to return 2. The file remains absent and all other study file bytes remain unchanged. Empty/unrelated databases are rejected without byte changes. Additional tests verify deletion after constructing a ledger cannot recreate it, and explicit creation cannot overwrite an existing consumed registry. |
| P2 — optional-input wiring | DATA_GUIDE shows the optional `context_file` and `news_file` manifest keys and states that unreferenced CSV files are ignored. It directs coverage checks using availability flags, timestamps and audit warnings, and identifies the current audit's limited optional-feed coverage reporting. The primary template remains usable without optional files. | Documentation checked against `load_dataset`, `audit_dataset` and the feature availability contract. No new input files or market-data claims were introduced. |

## Verification performed

The initial regression run, before implementation, executed 10 test methods and failed with 40 assertion/subtest failures. These reproduced the reported behavior: the exact loss became a FAILED trial, omitted dependency versions allowed progress and holdout consumption, prospective clock overrides were accepted, integer floats and stop=1 passed validation, and absent or unrelated registries were initialized. Later failures in a subtest loop can reflect the earlier erroneous mutation; the corrected run verifies all guards independently against unchanged state.

Final focused command, executed from the project root:

```sh
PYTHONPATH=tests /workspace/scratch/4b21b2e03881/ucg_validation_venv/bin/python -W error -m unittest test_final_regressions test_config test_ledger test_paper test_workflow test_cli -v
```

Result: **35 tests passed**, 8.560 seconds, exit status 0. All warnings were treated as errors. The run includes 12 new final-review regression methods and the existing configuration, ledger, paper, workflow and CLI tests. `git diff --check` also passed.

The actual validation interpreter reports Python 3.12.14, NumPy 2.3.5, pandas 2.2.3, scikit-learn 1.8.0, SciPy 1.17.0, joblib 1.5.3, threadpoolctl 3.6.0 and **LightGBM `not_installed`**. No optional LightGBM fit was performed or claimed.

## Changed files owned by this wave

- `ucg_lab/workflow.py`
- `ucg_lab/ledger.py`
- `ucg_lab/paper.py`
- `ucg_lab/config.py`
- `ucg_lab/cli.py`
- `tests/test_final_regressions.py` (new)
- `tests/test_ledger.py` (explicit creation in test setup)
- `docs/DATA_GUIDE.md`
- `docs/CONTRACTS.md`
- `docs/OPENCLAW_HANDOFF.md`
- `docs/reviews/final-fixes-report.md` (this report)

## Limits and coordinator handoff

The registry guard addresses accidental missing files and incompatible replacements. It does not detect deliberate replacement by another valid-schema registry or provide tamper-proof, cross-study attempt enforcement. The existing constraints on synthetic evidence, hypothetical execution and live eligibility remain applicable. No real market data, live route or unattended trading service was added.

The implementation changes the recorded source identity and expands dependency identity. Pre-fix study artifacts must not be silently resumed or re-frozen as if they matched the new implementation; retain them as prior evidence and generate fresh verification artifacts under the corrected code. Do not reset a missing consumed registry to recover an old study.

The coordinator owns full-suite and full-demo verification, status/verification/build-log updates, README, sample reports and final archives. Those packaging files were not edited by this fix wave. No commit was made.
