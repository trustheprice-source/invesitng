# Task C implementation and verification report

## Scope and result

Implemented only `ucg_lab/models.py`, `ucg_lab/validation.py`, `tests/test_models.py`, `tests/test_validation.py` and this report. No Git index changes or commits were made by this task. PROJECT.md, AGENTS.md and CONTRACTS.md were read before implementation. STATUS.md and CONTINUATION.md were absent initially and read once the coordinator created them.

The numerical/evidence interfaces match the shared v0.1 contracts. There are 18 Task C tests: eight model/analog tests and ten validation/evidence tests. The latest focused runs passed all 18. No real UniCredit data was used or claimed. No paid API calls, orders or broker integrations were used.

## Implemented behavior

- Ridge regression uses training-only median imputation and StandardScaler, then deterministic SVD fitting with alpha 10 by default. All-missing training columns are imputed with zero. Predictions are numerical, finite and one per evaluation row.
- Training outcomes finishing at or after the earliest evaluation decision are purged. Missing outcomes are discarded. At least 30 completed eligible training rows are required after purging; empty evaluation sets and insufficient training sets raise explicit ValueErrors. Timestamp inputs must be aware, and infinity is rejected. Outcome/timestamp columns cannot be requested as numerical predictors.
- Walk-forward splits require canonical, sorted, unique session dates and positive window sizes. They retain an exact rolling training window, disjoint chronological evaluation blocks and a final partial block.
- The optional LightGBM path imports explicitly and raises a descriptive ImportError when unavailable. It never substitutes ridge. CPU/single-threaded deterministic defaults are set, but the installed-LightGBM path has not been exercised because that dependency is absent.
- Historical neighbors use only cases with both decisions and completed labels strictly before the query. Median imputation and distance normalization are fitted on eligible historical cases. Results include losing outcomes, deterministic chronological tie resolution and at most one case per session. They are explanatory examples, not independent evidence.
- Performance includes initial equity in the drawdown peak, all represented zero-return sessions and all represented ISO weeks. Weekly returns compound within the ISO year/week. Reports include active-day/week fractions, longest idle run, win rate, fees, net P&L, mean trade returns, profit factor, worst day/week, and a small tail/concentration diagnostic. Undefined ratios are null rather than NaN/Infinity.
- Mean daily return intervals use seeded circular contiguous block resampling and include no-trade sessions. Confidence level uses alpha/family_size, with an explicit caveat that this is approximate correction limited to the recorded bounded family. The bootstrap implementation batches draws to limit temporary memory.
- Evidence gates fail closed for missing/nonfinite screening metrics, require verified real provenance for candidates, and always return `eligible_for_live: false`. Synthetic results always remain `SYNTHETIC_DEMO`. Passing development results are only `HISTORICAL_CANDIDATE`; passing reserved holdout results are only `PAPER_CANDIDATE`.

## Test evidence

The initial test files were written before the implementation. Their first runs failed because the requested modules did not exist. A further JSON-safety regression was observed failing for a NumPy integer criterion; integer criteria are now converted to native Python integers, and that regression passes.

Fresh focused commands:

```text
python -m unittest discover -s tests -p 'test_models.py' -v
Ran 8 tests ... OK
python -m unittest discover -s tests -p 'test_validation.py' -v
Ran 10 tests ... OK
```

Tests establish the following independently of the simulator and demo generator:

- Literal rolling windows, short final block and rejection of unsorted/duplicate dates.
- A boundary-ending poisoned label cannot influence a prediction.
- Purging happens before the minimum sample requirement.
- An extreme extra evaluation point cannot alter preprocessing/prediction of the first point.
- Training-median imputation, zero imputation of an all-training-missing column, finite numerical ridge result and unchanged training input.
- Infinity, empty evaluation input, unknown model and target-column predictor rejection.
- Explicit absent-LightGBM failure.
- Future decisions and boundary-ending historical outcomes cannot appear in analogs; future feature mutation cannot alter distances; losing neighbors remain visible and session duplicates collapse.
- Constant-return interval collapse; deterministic seeded output; a literal wrapping block sample `[4,1,2,3]` has mean 2.5.
- Invalid bootstrap parameters and nonfinite observations fail.
- The account path 100 -> 90 -> 90 -> 99 -> 99 has 10% max drawdown, -1% total return, -10% worst week, 50% active days and 100% active weeks.
- Entirely inactive days/weeks remain in denominators, bootstrap sample size and longest idle run.
- Synthetic/permissive metrics cannot gain candidate status; real candidate levels never gain live eligibility; equality at the CI threshold fails; absent metrics, low trade count, nonfinite drawdown and unverified provenance fail.
- Native JSON serialization with `allow_nan=False`, including NumPy integer criteria.

The latest full-repository discovery run during parallel implementation was:

```text
python -m unittest discover -s tests -v
Ran 89 tests ... FAILED (errors=2)
```

All loaded Task C tests passed. The two errors were import failures for unfinished coordinator-owned modules: `test_reporting` could not import `ucg_lab.reporting`, and `test_workflow` could not import `ucg_lab.workflow`. These are not claimed resolved by Task C. The coordinator must rerun discovery after those modules land.

An earlier full run, while other tasks were still implementing, reported 24 errors: missing `test_config`, `test_demo`, `test_features`, `test_ledger` imports and 20 backtest/label test stubs. All those earlier names passed in the latest 89-test run. Earlier stub errors were:

- `test_bar_proxy_spread_and_slippage_applied_per_side`
- `test_commission_uses_larger_of_minimum_or_rate`
- `test_daily_brake_blocks_later_episode`
- `test_entry_allocation_excludes_fee_but_total_must_fit_cash`
- `test_episode_while_open_does_not_queue`
- `test_exit_prevents_reentry_on_same_bar`
- `test_final_minute_open_exit_and_no_new_entry`
- `test_gap_stop_uses_gap_open_not_stop_level`
- `test_hand_derived_fees_whole_shares_and_delayed_open`
- `test_intrabar_stop_uses_stop_reference`
- `test_later_false_cancels_pending_entry`
- `test_no_closing_liquidity_raises_instead_of_overnight_position`
- `test_no_trade_session_in_equity_and_fixed_empty_schema`
- `test_persistent_signal_one_episode_then_false_rearms`
- `test_quote_mode_requires_paired_quotes`
- `test_quote_spread_is_not_double_counted`
- `test_zero_volume_entry_and_exit_skip_to_valid_minute`
- `test_label_ignores_stop_and_zero_volume_uses_actual_fill_time`
- `test_labels_do_not_shorten_holding_at_session_end`
- `test_labels_match_fixed_costed_trade_and_never_span_sessions`

Verification used the supplied Python 3.12 runtime, NumPy 2.3.5, pandas 2.2.3 and scikit-learn 1.8.0. A repository virtual environment did not exist at the time of these runs.

## Remaining statistical and engineering limits

1. Bootstrap percentile intervals are approximate. Their quality depends on return stability, appropriate block length, enough independent information and finite Monte Carlo resolution. Very small adjusted alpha has poor tail resolution with a fixed bootstrap count. A short record with blocks as long as the sample may produce a degenerate interval; this is not strong evidence. Default screening sample minima remain illustrative.
2. Bonferroni alpha/family_size over these approximate intervals does not establish a rigorous guarantee under arbitrary dependence, adaptation or hidden prior experiments. The coordinator's ledger must preserve the complete bounded family and holdout discipline.
3. Ridge and neighbor distances can be sensitive to regimes, correlated variables, outliers and the chosen feature family. No broad tuning or model-ranking claim is made here. The target remains the separately specified costed fixed-horizon label and does not model stop exits.
4. Historical neighbors are selected for proximity, share the source sample with modeling, and may remain dependent across sessions. They must not be counted as independent successful trials.
5. Annualized returns extrapolate a 252-session convention. Historical drawdown is retrospective and cannot cap future loss. Tail diagnostics summarize the sample; they are not stress tests or future-loss bounds.
6. Data coverage, correct full evaluation-session inclusion, actual execution costs, timestamps, verified provenance, bounded search registration and single-use final holdout remain orchestration/data/execution responsibilities. The evidence gate consumes supplied diagnostics and does not independently audit the raw data or ledger.
7. Installed-LightGBM behavior, real-data performance, cost stress, frozen prospective paper evaluation and any live integration remain unverified future work. A valid final research outcome is no qualifying strategy.

## Round 1 review correction — C1 inference validity

Read `docs/reviews/task-c-review.md` and verified the reported mechanism against the implementation: a circular block equal to or longer than the record produces a rotation containing every observed return exactly once. Its mechanically zero-width interval cannot support mean uncertainty claims. The earlier document-only warning was insufficient because the runtime gate could still promote the result.

The coordinator authorized an amendment to reject invalid inference at the evidence gate while retaining diagnostic statistics. No block length, alpha, family size, observation count or bootstrap count is silently changed.

Bootstrap results now include `inference_valid`, `inference_failures`, `expected_samples_per_tail`, `minimum_expected_tail_samples` and an explicit screening-policy explanation. `inference_valid` is false for either:

- `block_length >= n_observations` (`block_length_not_less_than_observations`); or
- fewer than 10 expected bootstrap samples per adjusted tail, calculated as `n_bootstrap * alpha / 2` (`insufficient_bootstrap_tail_samples`). In `summarize_performance`, this alpha is already the family-adjusted `alpha/family_size`.

Summary metrics propagate the validity flag and failure codes. `assess_evidence` now requires explicit true validity flags and empty failure lists from both the summary and nested bootstrap diagnostics. Missing diagnostics fail closed, including older metrics. Invalid inference can only remain research-only for real data; synthetic data still returns `SYNTHETIC_DEMO`, with diagnostics intact. Every status retains `eligible_for_live: false`. The 10-sample threshold is an authorized Monte Carlo resolution screen, not a theorem or proof that passing intervals are accurate. Stability and block suitability remain assumptions.

Test-first red result: the three new regression methods produced two missing-diagnostic errors and one actual gate failure (`PAPER_CANDIDATE` where `RESEARCH_ONLY` was required). After the change, all three pass:

- `test_inference_diagnostics_full_sample_blocks_and_tail_resolution`
- `test_review_fixture_invalid_inference_cannot_promote_real_candidate`
- `test_missing_or_invalid_inference_diagnostics_fail_closed`

The exact reviewer fixture uses 60 chronological business days, initial equity 10,000, returns `[-0.05, 0.06] * 30`, compounded balances, matching daily P&L and one fee-free trade each day. For both block length 60 and 61, and both 200 and 5,000 bootstrap replicates, the numerical lower bound remains approximately 0.005 and net return approximately 0.232775846071273. Both development and holdout real-data assessments now return `RESEARCH_ONLY`. A shorter block of 5 with 200 replicates fails adjusted-tail resolution; with 5,000 replicates it passes these inference-screen checks and produces repeatable diagnostics.

Boundary coverage includes 399 replicates at alpha 0.05 (9.975 expected samples per tail, invalid), 400 replicates (10, accepted by this screen), full-sample/larger blocks, absence of either diagnostic field at either nesting level, and false nested validity. The existing literal circular-block statistics still pass. Constant observed returns with a shorter block and sufficient tail draws may still produce zero-width intervals; variability is not invented.

Fresh verification after the correction:

```text
python -m unittest discover -s tests -p 'test_validation.py' -v
Ran 13 tests ... OK
python -m unittest discover -s tests -p 'test_models.py' -v
Ran 8 tests ... OK
python -m unittest discover -s tests -v
Ran 105 tests ... OK
```

The full run included synthetic end-to-end workflow tests, so the added restrictions preserve synthetic demonstration execution. The full suite emitted existing pandas DataFrame-concatenation FutureWarnings at `ucg_lab/workflow.py:102` in the workflow tests; there were no failures or errors. That coordinator-owned warning was not edited in this task. No model behavior, Git index, commits or files outside the assigned ownership were changed in this correction.
