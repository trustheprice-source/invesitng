# Final whole-project review

Review date: 2026-11-05. Scope: runnable historical research and paper-account core, not an unattended trading system. This review changes no implementation or tests; this report is its only persistent output.

## Verdict

**Current verdict after the coordinated correction wave: specification compliance and code quality APPROVED for the documented research/paper-core scope. F1–F5 are resolved; no open critical or important finding remains from this review.** The scoped disposition and fresh reviewer verification appear at the end. Final full-suite/demo packaging gates remain coordinator-owned.

The initial review requested changes for F1–F3 and minor F4; the subsequent missing-registry reproduction added important F5. Those original findings and their evidence are retained below as historical details. No critical defect or live broker route was identified. This verdict does not certify market data, profitability, practical fill accuracy, or operational readiness.

Read `PROJECT.md`, `README.md`, `AGENTS.md`, `docs/CONTRACTS.md`, `docs/BUILD_LOG.md`, the three task reviews, relevant protocol/status/continuation/handoff documents, supplied full diff, and current orchestration, ledger, configuration, CLI, reports, paper, model and execution code/tests. The supplied full test output records 112 passing tests; the supplied 180-session CLI demo records a successful synthetic research/freeze/holdout/handoff/paper-init sequence. Those are supplied execution evidence, not suite runs independently repeated by this reviewer. Fresh execution was limited to the concrete reproductions below.

## Important F1 — account exhaustion is not preserved across walk-forward fold boundaries

**Locations:** `ucg_lab/workflow.py:84–98`; `ucg_lab/backtest.py:38–39`.

`_evaluate` passes the last fold's ending equity as the next fold's `initial_cash`. The simulator's corrected exhaustion behavior preserves zero equity inside a single call, but its input validator still rejects `initial_cash <= 0`. Consequently a valid total-loss history at the end of any nonfinal fold becomes a computation failure in the next fold. `run_research` records the candidate as FAILED instead of returning the realized -100% loss and remaining inactive sessions. Since `_evaluate` writes artifacts only after completing every fold, its accumulated trade/equity records are not exported either. No recapitalization occurs, but the complete adverse result is lost.

**Fresh reproduction:** call `_evaluate` with two one-session test folds and literal complete one-minute bars. An earlier session supplies a dummy training date. First test session prices are `[97, 97, 97, 3, 3]`, second test session prices `[3, 3, 3, 3, 3]`; both have positive volume throughout. Use EUR100 initial cash, allocation 1, EUR3 minimum commission, zero proportional commission/spread/slippage, one-minute latency and holding period. Patch only `_signals` to return a true decision at 08:01 of each test session, leaving the real `_evaluate` and `run_backtest` financial paths intact. First fold buys one share at 08:02 for 97+3 and exits at 08:03 for 3−3, leaving zero. Actual second-fold output:

```text
CROSS_FOLD ValueError initial_cash positive; allocation_fraction in (0,1] required
```

**Required correction:** preserve the original loss and zero balance over all later evaluation sessions/folds, with zero subsequent returns/P&L/trades and no injected capital. This can be handled at the orchestrator boundary or by a carefully documented exhausted-account continuation interface. Do not weaken the user's initial-capital validation accidentally. Add an integration regression spanning at least two folds, asserting complete dated equity/trades, net return −1 and no failed-candidate substitution.

## Important F2 — frozen environment identity omits optional LightGBM and numerical solver dependencies

**Locations:** `ucg_lab/workflow.py:44–46`, environment comparisons in `_study_state` and `run_research`; `ucg_lab/models.py:93–104`.

`environment()` returns only Python, NumPy, pandas, scikit-learn and project versions. A declared LightGBM candidate can therefore be developed using one LightGBM version, frozen, and refitted for the final period using another version without any environment mismatch. Source/config/data hashes do not cover the installed LightGBM package. SciPy, used in the numerical stack, is also omitted. This contradicts the documented claim that dependency changes invalidate study identity and weakens reproducibility of the actual fitted model.

**Evidence:** source inspection plus fresh `environment()` output:

```text
{'python': '3.12.14', 'numpy': '2.3.5', 'pandas': '2.2.3',
 'scikit_learn': '1.8.0', 'project': '0.1.0'}
```

No LightGBM installation/version-change experiment was run, and this finding does not imply that its installed adapter was tested. The failure follows directly from the missing identity fields and the fresh final fit in `run_holdout`.

**Required correction:** record and compare the relevant numerical dependency versions, including LightGBM when applicable, with an explicit absent state. Version discovery need not import optional model code. Ensure a changed optional-model or solver version blocks resume/freeze/final evaluation before consuming a final attempt. Preserve explicit unavailable-dependency failure and no fallback. Add focused environment-change tests rather than claiming installed-LightGBM verification.

## Important F3 — the public paper API can mark historical replay as prospective by injecting its clock

**Locations:** `ucg_lab/paper.py:90–95`, `122–133`, fill creation later in `on_quote`.

Both `submit(..., now=...)` and `on_quote(..., now=...)` accept caller-supplied receipt clocks in every mode. A `prospective` account therefore permits old observations to pass freshness checks and records both the old receipt timestamp and `mode='prospective'`. The CLI correctly has no such argument, but the public Python broker core does. Documentation saying clock injection is used only by tests does not enforce the prospective/replay boundary for future Python integrations.

**Fresh reproduction, no source or database tampering:** create `PaperBroker` with `mode='prospective'`, `data_kind='real'`, nonempty frozen hash, zero slippage; submit one buy with decision and `now` equal to `2020-01-02T10:00:00Z`; feed a sufficient-size quote timestamped `2020-01-02T10:01:00Z` with the same injected `now`. Actual returned fill includes:

```json
{"timestamp":"2020-01-02T10:01:00+00:00",
 "received_at":"2020-01-02T10:01:00+00:00",
 "mode":"prospective","data_kind":"real","eligible_for_live":false}
```

**Required correction:** disallow explicit clock overrides in prospective accounts, or unconditionally label any overridden-clock account/record as replay/simulation. Keep deterministic clock injection for simulation tests. Add direct API regressions for both submit and quote ingestion, and verify rejection is transactional and leaves no order/fill behind. This finding concerns truthful paper provenance; it does not create real orders.

## Minor F4 — configuration accepts floating-point session counts that downstream interfaces reject

**Locations:** `ucg_lab/config.py:75–79`; session-count validation in `validate_config`; `ucg_lab/workflow.py` slicing by `holdout_sessions`; `ucg_lab/models.py:111–123`.

The integer predicate checks numerical integrality but does not normalize accepted floats to `int`. Thus JSON `1.0` passes `validate_config` for train/test/holdout session counts, but list slicing requires an integer and `walk_forward_splits` explicitly rejects float counts.

**Fresh reproduction:** `validate_config({'research': {'train_sessions': 1.0, 'test_sessions': 1.0, 'holdout_sessions': 1.0}})` succeeds and retains all three as floats. Passing the resulting train/test values to `walk_forward_splits` raises `ValueError: train_sessions must be a positive integer`; using the holdout count as the workflow's negative slice raises `TypeError: slice indices must be integers or None or have an __index__ method`.

**Suggested correction:** either reject float-typed integral fields during configuration validation or normalize all accepted integer-valued settings consistently. A related boundary to reconcile is `stop_loss_pct=1`, accepted by root configuration but rejected by backtest's strict `<1` check. These fail closed and do not fabricate results, but validated configurations should match downstream contracts.

## Boundaries reviewed without a new finding

- Development excludes final sessions before feature/label construction. The supplied future-price-mutation regression checks unchanged development results. Final model fitting uses the preceding declared training window and fixed parameters; training-label purging is delegated to the reviewed model interface. No final-return feature path was found.
- Candidate registration precedes candidate performance computation; failed/RUNNING records remain counted and are not silently retried. The final period is claimed transactionally before final labels, fit and performance are computed, and errors leave it consumed. These are local workflow safeguards, expressly not tamper-proof or cross-study enforcement.
- Frozen artifact self-hash, source, data and config identity checks detect ordinary modifications. Study metadata references raw canonical inputs; data hashing includes the manifest and referenced feeds. Deliberate rewriting of all hashes/ledgers is outside the stated local guard guarantee.
- Ordinary solvent equity carries across folds. Evaluation dates are contiguous supplied sessions, including inactive days; complete-period equity drives coverage and uncertainty. Costs and candidate score thresholds enter the actual execution call. Fixed-horizon model targets versus stop/EOD execution are disclosed.
- Synthetic results stay `SYNTHETIC_DEMO` and live eligibility stays false. Real evidence additionally requires provenance and declared broker-cost/risk approvals. Statistical screening is described as conditional; no empirical edge, real dataset or installed optional-model success is claimed.
- Paper duplicate checks and state updates occur within SQLite transactions. Quote IDs must advance event time, repeated identical events are idempotent, and conflicting IDs fail. Position/depth/capital restrictions and freshness checks are present, subject to F3's injected-clock boundary.
- Reports escape strings and disclose synthetic prices, daily-close drawdown and hypothetical execution. The demo's ridge candidate has zero trades and zero return; the documentation does not present it as profitable. Missing live feed, scheduler, automatic strategy/exit/risk service and prospective evaluator are explicit continuation work, appropriate to this delivery scope.
- `docs/STATUS.md` still says build in progress and the README anticipates a final verification file. The coordinator should update those at packaging; their current state is not a false finished claim.

## Review limits and follow-up

No full suite or full demonstration was duplicated during the initial review. No data acquisition, live trading, paid service, installed LightGBM run, or real prospective observation was performed. F1/F3/F4 were freshly reproduced with small literal inputs; F2 is a deterministic identity-coverage finding from code and recorded metadata. After corrections, re-review only the changed boundaries and their focused regressions; the coordinator should run the required final delivery gates and refresh any bundled example identities after source changes.

## Important F5 — missing registry silently recreates an unseen holdout and erases search history

This focused follow-up was explicitly requested by the coordinator after the initial review. **The verdict additionally requires correction of F5**, with priority over the other findings because it defeats the core one-shot final-test guarantee through ordinary file loss, without adversarial editing.

**Locations:** `ucg_lab/ledger.py`, `StudyLedger.__init__` and `_connect`; `ucg_lab/workflow.py`, existing-study branches in `run_research` and `run_holdout`; `ucg_lab/cli.py`, `status` branch.

`StudyLedger` always creates the database and missing tables. Existing study metadata and frozen artifacts do not require the prior ledger file to exist. If `ledger.sqlite` is missing, `run_holdout` creates an empty registry, claims the already-consumed period again, evaluates it, and overwrites the holdout report. `run_research` likewise loses recorded trials/holdouts and reruns development despite a preserved frozen artifact. Even `status` creates the replacement registry as a side effect. This is an accidental missing-file recovery failure, distinct from the documented limitation that an operator can deliberately rewrite hashes and records.

**Fresh exact reproduction:** used `shutil.copytree` to copy `workspace/delivery_demo` into a temporary directory, preserving its sibling input/config structure. Confirmed the copied study had one prior holdout record, then deleted only the copied `study/ledger.sqlite`. With unchanged source/config/data/frozen bytes, called `run_holdout` on the copy:

```text
PRIOR_HOLDOUTS 1
REPLAY_SUCCEEDED holdout synthetic
NEW_HOLDOUTS 1
```

On a separate fresh temporary copy, deleted only the copied ledger and called `run_research(copy/data/manifest.json, copy/config.json, copy/study)`:

```text
RESEARCH_REPLAY_SUCCEEDED 4 0
FROZEN_STILL_EXISTS True
NEW_HOLDOUTS 0
```

Both were focused reproductions of the missing-ledger path; the source demo and its registry were untouched. These calls necessarily repeated computation to establish the concrete failure, rather than duplicating test evidence for general verification.

**Bounded fail-closed correction:** distinguish explicit ledger creation from opening an existing ledger. Only new-study initialization may create one. Every command that addresses an established study—including research resume, freeze, holdout, handoff and status—must require the existing registry, using a noncreating SQLite open mode such as `mode=rw` to avoid a check/open race. Missing registry should raise an explanatory error preserving all other artifacts; it must not claim unseen data or synthesize replacement history. Require expected schema when opening, rather than silently constructing missing tables in an established registry. A read-only status command should not recreate evidence storage. Recovery should restore the original registry from backup or remain blocked under the documented recovery process.

**Focused regression:** create and consume a small study, remove its ledger, then assert holdout, research resume and status fail without creating a new database or changing reports/frozen artifacts. Retain a separate ordinary new-study test proving explicit initialization still creates the registry.

## Scoped re-review — coordinated correction wave

**Disposition: F1, F2, F3, F4 and F5 RESOLVED. Specification compliance and code quality approved for the reviewed scope. No new defect was found in the corrections.** This disposition supersedes the historical changes-requested statements above; it does not extend the review to new feature scope or certify final packaging gates.

Reviewed the changes from baseline `9e1298e` in `workflow.py`, `ledger.py`, `config.py`, `paper.py`, `cli.py`, the explicit creation update in `test_ledger.py`, all of `tests/test_final_regressions.py`, changed relevant contracts/handoff documentation, and `docs/reviews/final-fixes-report.md`. Reviewed source identity:

```text
b423f740234ffbf5af61b88fe61c791ce5efa05b476680697a1da853aca2b2a7
```

- **F1 resolved:** zero equity is now an absorbing state across later folds. The orchestrator exports every remaining supplied evaluation session with zero equity, subsequent return, P&L and trades; it retains the original loss/trade and fold metadata. It does not refit models or generate new signals after exhaustion. Positive initial-capital validation remains intact. The regression exercises the real research/loader/label/ledger/backtest path with literal financial amounts and only replaces signal generation. It verifies three evaluation folds, the original EUR100 loss, net return −1, and all later inactive rows/events.
- **F2 resolved:** environment identity now includes SciPy, joblib, threadpoolctl and LightGBM, with explicit `not_installed` metadata. Existing comparisons reject changes before research registration, freezing or a final claim. The regression varies each recorded dependency separately and verifies unchanged trials/frozen bytes and an empty holdout ledger after rejection. This uses mocked package metadata; it does not claim an installed LightGBM fit. Recording even an unused optional package conservatively invalidates identity after installation, which is consistent with the documented immutable environment policy.
- **F3 resolved:** both public paper entry points resolve receipt time through a shared check that rejects every non-None clock override for prospective accounts. Rejection occurs before opening a mutation transaction. The direct API tests verify complete snapshot equality for rejected submission and rejected quote processing with an existing legitimate pending order. Simulation clock injection remains supported. Prospective order and fill records therefore cannot be backdated through the formerly accepted argument.
- **F4 resolved:** all declared integer configuration fields require actual integers, including fixed schema/bar fields. Integral floats and booleans are rejected consistently, and stop loss 1 is rejected at root validation. The daily-loss-limit boundary 1 stays supported. Tests cover every nested integer setting and preserve positive user starting-capital requirements.
- **F5 resolved:** existing registries open through noncreating SQLite `mode=rw`, with expected schema validation on every connection. Missing, zero-byte or unrelated-schema databases cannot be silently initialized; removal after constructing the ledger also fails on the next read. Explicit creation reserves a new file exclusively and cannot overwrite an existing one. Only new-study initialization in an empty directory requests it. Existing research/status and all `_study_state` paths fail closed. The regression deletes a completed study's registry and verifies that research, holdout, freeze, handoff, analog inspection and CLI status leave the ledger absent and every other study file byte unchanged. Separate cases cover empty/unrelated databases and explicit-create collision. This remains a local accidental-loss guard, not detection of deliberate replacement by another valid-schema database.

**Fresh independent verification:**

```sh
python -W error -m unittest discover -s tests -p test_final_regressions.py -v
```

Result: **12 tests passed in 1.505 seconds, exit status 0**, with warnings treated as errors. This covers all five findings and the relevant mutation/no-recreation boundaries. The implementer's report additionally records 35 passing focused tests and the initial red regression results; those broader runs were inspected rather than duplicated. The coordinator's fresh full suite and 180-session demo were still running when this disposition was written, so their success is not asserted here. Old study identities must remain preserved as old evidence; fresh release examples must use the corrected source/environment identity.
