# Task A independent review

Reviewed `PROJECT.md`, the canonical-data and causal-feature sections of `docs/CONTRACTS.md`, `docs/reviews/task-a-report.md`, the supplied `review-a.diff`, and the current implementations/tests in `ucg_lab/data.py`, `ucg_lab/features.py`, `tests/test_data.py`, and `tests/test_features.py`. This is a review of synthetic/demo and future historical research software; no live-trading capability is in scope.

## Verdicts

- **Current specification compliance verdict after fix round 1: accepted for the reviewed Task A scope.** A1 is addressed; the core data/feature interfaces and causal calculations follow the written contracts on review.
- **Current code quality verdict after fix round 1: accepted for the reviewed Task A scope.** A1 and A2 are addressed, with focused regression coverage. No new important defect was found in the scoped fix review. The implementation is compact and understandable, copies input frames, documents numerical conventions, and has useful literal-value and future-mutation tests.
- **Critical defects:** none found.
- **Open important defects:** none. One important and one minor finding were confirmed during the initial review and resolved in fix round 1 below.

## Scoped re-review — fix round 1

Reviewed `/workspace/scratch/4b21b2e03881/review-a-fix1.diff`, the matching current source changes, and the appended fix/test evidence in `docs/reviews/task-a-report.md`. This round is limited to A1, A2 and new breakage introduced by those changes.

- **A1: ADDRESSED.** The shared ingestion loop now validates each parsed CSV record's width against its header before pandas sees it. `csv.reader(strict=True)` preserves quoted commas and embedded newlines, and `csv.Error` becomes `ValueError`. Explicit `index_col=False` removes implicit-index interpretation. New tests cover surplus and missing fields for bars, sessions, context and news, plus valid quoted text and malformed quoting. This closes the exact undeclared-leading-field failure identified below. No relevant new breakage was found.
- **A2: ADDRESSED.** Calculations operate on copied float inputs, preventing fixed-width integer aggregation wrap. Explicit NumPy multiplication and cumulative sums raise on floating overflow/invalid operations and are also checked for nonfinite results before VWAP is calculated. The exact `volume=1e307`, price 100 reproduction now has a regression requiring a clear `ValueError`; a separate int64 volume 4e18 regression requires the hand-checked zero VWAP distance. The fix retains zero-volume NaN handling and does not change ordinary-domain formulas or timing. No relevant new breakage was found.

The implementer's appended evidence records 15 passing data tests and 13 passing feature tests, including observed behavioral red failures before these fixes. I inspected that coverage and the fixes rather than duplicating those test runs or the whole suite. The full-suite failures recorded in the implementation report concern other modules and are outside this scoped verdict. Initial findings below are retained as historical defect/reproduction details, not open findings.

## Important defect

### A1 — Surplus CSV fields can be silently discarded while the audit passes

**Location:** `ucg_lab/data.py:186-192`, with the index discarded by `ucg_lab/data.py:155`.

Only the first CSV record is inspected with `csv.reader`; subsequent records are delegated to `pd.read_csv` without checking their width. When every data row has one more field than the header, pandas can infer the first field as the DataFrame index instead of reporting a malformed record. The loader then resets that index and loses the undeclared values. Normalized columns contain plausible canonical observations and `audit['passed']` is true.

**Confirmed reproduction:** A canonical five-minute fixture with this bars header and one record per minute was accepted:

```csv
timestamp,open,high,low,close,volume
UNDECLARED,2025-01-02T08:00:00Z,10,11,9,10,100
```

The remaining four records had the same seven-field shape and timestamps 08:01–08:04; the supplied session was `[08:00,08:05)`. `load_dataset()` returned five bars, the ordinary six canonical columns, and `audit['passed'] == True`. The `UNDECLARED` fields were absent from the normalized data. This is not a missing-minute or zero-volume issue: it is a malformed-record acceptance path before validation. The shared CSV-reading loop exposes all referenced CSV types to the same parser behavior.

**Impact:** Accidental extra source/export columns can be reinterpreted as an implicit index and silently disappear. Hashing the original bytes preserves their identity but does not make the accepted schema valid. The implementation report's statement that ingestion validates without repairs is therefore too strong.

**Suggested correction:** Validate every CSV record against the declared header width before constructing a DataFrame, using a CSV parser that handles quoted fields, and reject malformed CSV syntax/record widths with `ValueError`. Explicitly avoid inferred indexes. Merely using `on_bad_lines='error'` is insufficient for the demonstrated pandas index-inference case.

**Suggested regression:** Write a fully valid canonical fixture, prepend one undeclared field to every bars data record while keeping the header unchanged, and assert `load_dataset()` raises `ValueError`. Cover the shared input loop with analogous sessions/context/news malformed records as appropriate. Include both surplus and missing fields; retain a valid quoted-field fixture to avoid replacing CSV parsing with naive comma splitting.

## Minor findings

### A2 — Finite source values can overflow intermediate turnover into a valid-looking VWAP distance

**Location:** `ucg_lab/features.py:137-138` and `ucg_lab/features.py:154-156`.

The per-value finite checks do not protect multiplication and accumulation. In a targeted five-minute, constant-price fixture with open/close 100, high 101, low 99 and finite volume `1e307` each minute, `build_features()` returned `vwap_distance == -1.0` without a warning. The mathematical VWAP distance is zero; `close * volume` overflows, VWAP becomes infinity, and the final division produces a finite but false -100% distance.

These volumes are far outside plausible UCG data, so this is a numerical robustness issue rather than evidence of an ordinary-domain research error. Still, ingestion currently accepts the values under its stated finite/nonnegative rules. Consider stable weighted calculations or explicit intermediate overflow checks that reject the calculation instead of emitting a plausible finite value. A targeted regression should require either the mathematically correct zero or a clear `ValueError` for this fixture. Similar checks should consider integer volume aggregation overflow.

## Areas reviewed without an identified defect

- Canonical timestamps normalize to UTC; session boundaries are whole minutes and checked against Europe/Rome local dates. Exact expected-minute matching rejects duplicates, missing observations and out-of-session bars. Real exchange/calendar truth and licensing remain external verification requirements, as documented.
- `volume_basis='primary_continuous'` is required as a manifest declaration. Zero-volume observations are retained separately from missing minutes, and audit warnings correctly avoid implying execution availability.
- Buckets are anchored to the supplied session open and only complete five-minute buckets produce decisions at their end. The previous session's actual final minute, including a partial final feature bucket, supplies the next session's gap return.
- Historical interval and cumulative-volume baselines shift by one session before rolling. The lookback counts supplied sessions, including sessions lacking a given completed bucket. Cumulative denominators include historical sums only through the matching bucket. No future total-day volume enters these calculations.
- Session return windows reset, opening range is withheld until minute 30 and then frozen, and VWAP uses minute close times volume through the decision. Initial unavailable numerical features remain NaN. No all-dataset fitted scaling is present in these modules.
- Context uses backward as-of availability with the configured freshness limit. News uses deduplicated event IDs and observed availability in `(decision_time-60 minutes, decision_time]`. Missing feeds have explicit availability flags. A supplied event file is not proof of complete event coverage, as the report explains.
- Manifest/input bytes are hashed, including optional context/news, and directory containment checks reject absolute/parent/symlink path escapes. Declared provenance is not presented as independently established truth.

## Verification performed

Read-only source, contract and test inspection, plus the two targeted reproductions above. I did not rerun the full suite or duplicate the implementation owner's test run; no code or tests were changed. This report is the only file created by this review. The existing test report is useful historical evidence, not a substitute for adding the missing malformed-record regression and rerunning the affected tests after its fix.
