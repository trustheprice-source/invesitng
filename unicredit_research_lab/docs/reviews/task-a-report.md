# Task A implementation report

Task scope: canonical data loading/auditing and causal five-minute features. Only `ucg_lab/data.py`, `ucg_lab/features.py`, `tests/test_data.py`, `tests/test_features.py` and this report were changed by this task owner. No Git index operations, commits, data purchases, external requests, credentials, or order actions were used.

## Delivered behavior

`Dataset`, `load_dataset`, and `audit_dataset` implement the shared contracts. Ingestion requires declared source, acquisition, licensing, adjustment and timestamp metadata. It hashes exact manifest bytes and every referenced CSV, including optional context/news. Referenced paths must resolve inside the manifest directory; absolute and symlink escapes fail. Original input bytes are untouched.

Validation rejects empty/missing required data, duplicate CSV headers, nonfinite and negative volume, nonpositive prices, inconsistent OHLC, unpaired/crossed quotes, naive timestamps, off-minute interval boundaries, unsorted/duplicated minutes, local session dates inconsistent with Europe/Rome, overlapping/inverted sessions, missing minutes, and observations outside supplied sessions. Zero-volume observations are accepted and explicitly distinguished from execution opportunities. Context must have finite values and unique chronological availability times. News availability cannot precede publication; IDs are deduplicated by earliest available observation. Event IDs retain string identity, including leading zeroes and the literal `NA`.

Five-minute buckets are anchored to each supplied session open and appear only after all five constituent minutes finish. A session's incomplete final bucket is excluded from decisions. The eventual previous session closing minute is used only for the next session's gap return. Earlier rows are invariant under mutations to subsequent prices, volume, context values and event IDs.

Volume ratios compare each bucket against the same bucket from earlier supplied sessions inside the configured session window. The cumulative ratio compares sums through that bucket only. No current eventual day total enters a denominator. Both ratios remain unavailable until enough valid positive historical denominators exist. A valid current zero-volume bucket can have a zero ratio; an all-zero historical denominator is unavailable.

Opening range uses the first 30 minutes, is unavailable through minute 25, appears at minute 30, and remains frozen afterward. Missing numerical market features stay NaN; absent/stale context is zero plus `context_available=0`. An absent news file yields zero count plus `news_available=0`; a supplied empty feed has `news_available=1`, which describes supplied observations rather than proof no event existed.

## Explicit numerical conventions

- `return_5m`, `return_15m`, `return_60m`: completed close divided by the completed close 1, 3 or 12 buckets earlier, minus one. Initial windows are NaN and do not cross sessions.
- `day_return`: latest completed bucket close / session first minute open - 1.
- `gap_return`: session first minute open / previous session last minute close - 1; unavailable on the first session.
- `range_5m`: bucket high minus bucket low, divided by last completed close.
- `volatility_30m`: sample standard deviation (`ddof=1`) of the six latest five-minute close returns. It first becomes available after six returns exist, at the seventh completed bucket.
- `vwap_distance`: last completed close / cumulative minute VWAP - 1. VWAP is the explicit approximation sum(minute close * minute volume) / sum(minute volume), through the decision only; no cumulative volume means NaN.
- Context uses the latest row with `available_at <= decision_time`, age at most the configured 15-minute default. Exact age 15 minutes is allowed.
- News counts deduplicated IDs with `available_at` in `(decision_time-60 minutes, decision_time]`. Delayed publication is not retroactively available.
- `FEATURE_COLUMNS` excludes raw prices, timestamps, opening range price levels, readiness booleans and all targets. It includes causal return, volume, context/event counts and their availability indicators.

## Test-first evidence

Commands were run from repository root using the available Python 3.12.14 environment. The requested repository virtual environment did not exist during this task; the supplied runtime already had the needed numerical dependencies.

1. Wrote 11 data tests before `data.py`. Ran `python -m unittest discover -s tests -p test_data.py -v`: red, 1 import error because `ucg_lab.data` did not yet exist. Implemented the module; the same command passed all 11 tests.
2. Wrote 11 feature tests before `features.py`. Ran `python -m unittest discover -s tests -p test_features.py -v`: red, 1 import error because `ucg_lab.features` did not yet exist. Implemented the module; the same command passed all 11 tests.
3. Added two input-preservation regressions after initial implementation. Ran `python -m unittest discover -s tests -p test_data.py -v`: red with 13 tests, one failure (`test_duplicate_csv_header_is_rejected`, expected ValueError not raised) and one error (`test_event_identifiers_preserve_leading_zero_and_na_strings`, `NA` had been treated as missing). Fixed header checking and CSV string-ID preservation. The same command then passed all 13 tests. Re-ran feature tests: all 11 passed.

The original module-absence red runs establish missing API coverage, not independent observed failures of each assertion. The later behavioral red cycle specifically reproduced and fixed concrete ingestion errors. Tests use actual DataFrames/CSV files and literal expected values, without mocked market calculations.

Owned final test outcomes: 13 data + 11 feature tests, all passing. They cover UTC normalization, exact minute coverage, zero volume, duplicates/sorting, nonfinite values, invalid OHLC, session dates/bounds, out-of-session data, path traversal/symlinks, quotes, hashes, event deduplication/identity, metadata, audit failure, bucket timing, historical volume windows, same-clock cumulative arithmetic, future mutation invariance, opening range timing/freeze, session return boundaries, VWAP, context freshness, event availability/window endpoints, no input mutation and config rejection.

## Full available suite outcomes

`python -m unittest discover -s tests -v` was run twice while other task owners were still implementing their modules:

- First run: 62 discovered tests, 59 passed, 3 import errors: `test_config` (`ucg_lab.config` absent), `test_demo` (`ucg_lab.demo` absent), `test_ledger` (`ucg_lab.ledger` absent).
- Most recent run: 89 discovered tests, 87 passed, 2 import errors: `test_reporting` (`ucg_lab.reporting` absent) and `test_workflow` (`ucg_lab.workflow` absent). Previously missing config/demo/ledger tests now passed. All Task A tests passed.

These import errors are concurrent integration work, not a green full-suite claim. The coordinating task must rerun the complete suite and synthetic CLI workflow after integration.

## Limits and remaining inputs

The loader checks consistency of supplied calendars; it cannot establish actual exchange opening days, licensing, corporate action accuracy or feed completeness without independently verified sources. Hashing identifies supplied bytes and does not establish truth. Real data acquisition remains outside this delivery.

News event types are stored without textual sentiment. Availability timestamps are provided evidence, not inferred from publication. Correct historical as-of observations are an external requirement. A supplied event file does not establish complete news coverage.

VWAP and bar execution remain approximations. These modules do not establish a tradable edge, account suitability or live authorization. Synthetic fixtures remain explicitly synthetic.

The public loader validates the complete manifest. Feature construction also supports directly constructed Dataset fixtures without a complete ingestion manifest, while independently requiring coherent complete minute/session inputs. Production callers should use the canonical loader.

No timing, acceptance, profitability or exposure criterion was weakened. No final holdout result was computed by this task. `docs/STATUS.md` and `docs/CONTINUATION.md` were required by AGENTS.md but absent at the initial read; that fact was reported to the coordinator, who owns those shared documents.

## Fix round 1 — independent review A1/A2

The independent review identified two accepted defects, reproduced before fixes:

- **A1, malformed record widths:** the `UNDECLARED,<canonical fields...>` fixture was accepted for bars, sessions, context and news when every data row carried the surplus leading field. Added `test_all_csv_record_widths_match_the_declared_header`, covering surplus and missing fields for all four input types. An initial test-fixture cleanup problem was corrected so each subtest restores its input in `finally`. The corrected red command `python -m unittest discover -s tests -p test_data.py -v` ran 15 tests with eight subtest failures: all four surplus cases were accepted; the four short-record cases failed only later semantic checks instead of record validation. A separate quoted comma/newline regression was already green, preserving valid CSV behavior; unterminated quoting remains rejected.
- **A2, overflow:** added `test_finite_inputs_that_overflow_turnover_are_rejected` using the review's finite `volume=1e307`, constant price 100 fixture. Added `test_large_integer_volume_does_not_wrap_cumulative_sums` using int64 volume 4e18 per minute. The red command `python -m unittest discover -s tests -p test_features.py -v` ran 13 tests with two failures: no ValueError for floating turnover overflow, and false VWAP distance -0.9223372036854776 from integer cumulative-sum wrap.

The shared ingestion loop now parses every CSV record with `csv.reader(strict=True)` and checks exact declared header width before constructing any pandas frame. This handles quoted commas/newlines correctly, rejects extra/missing fields (including blank records), catches CSV syntax errors as ValueError, and explicitly uses `index_col=False`; it does not rely on pandas bad-line handling. Raw bytes and hash behavior are unchanged.

Feature arithmetic converts the copied numeric inputs to float before aggregating to avoid fixed-width integer wrap. Minute turnover multiplication and cumulative turnover/volume run as explicit NumPy operations with floating overflow/invalid checks. Nonfinite cumulative intermediates raise `ValueError('invalid data: numerical overflow in cumulative turnover or volume arithmetic')` instead of a plausible false feature. The integer-volume case now produces the hand-checked zero VWAP distance.

Green commands after the fixes:

- `python -m unittest discover -s tests -p test_data.py -v`: **15 passed**.
- `python -m unittest discover -s tests -p test_features.py -v`: **13 passed**.

Full available suite: `python -m unittest discover -s tests -v` ran **98 tests, 95 passed, one failure and two errors** during other owners' concurrent work. All 28 Task A tests passed. Unrelated failing cases were:

- `test_backtest.BacktestTests.test_exhausted_account_retains_zero_equity_on_later_sessions`: ZeroDivisionError in backtest daily return calculation.
- `test_backtest.BacktestTests.test_exit_fee_liability_exceeding_equity_raises_insolvency_error`: expected ValueError not raised.
- `test_paper` import error: `ucg_lab.paper` did not yet exist.

The three workflow tests passed, with existing `FutureWarning` messages from `ucg_lab/workflow.py:102` concerning concatenation with empty/all-NA frames. Those modules were outside this fix's ownership and were not edited. No commits, index operations or subagents were used.
