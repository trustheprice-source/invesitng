# Task C independent review

## Verdicts

- **Specification compliance: PASS for the literal v0.1 Task C interfaces and explicit safety invariants.** The implemented interfaces match `docs/CONTRACTS.md:49–61`. Synthetic observations always produce `SYNTHETIC_DEMO` for valid inputs, and all returned evidence statuses have `eligible_for_live: false`. Numerical scores and confidence intervals are not labeled probabilities of future profit.
- **Code quality and scientific robustness: PASS after round 1 correction.** The important inference-validity finding C1 below is resolved. No new critical or important defect was found in the scoped correction review. These are software/research-screening verdicts, not evidence of a profitable strategy.

Scope: read-only review of `ucg_lab/models.py`, `ucg_lab/validation.py`, their Task C tests, the supplied `review-c.diff`, project/contracts/instructions and `task-c-report.md`; configuration and the evidence call site were inspected to assess reachability. No source/test edits or subagents were used. Only this review document was written.

## Original important finding C1 — resolved in round 1: a full-sample bootstrap block could qualify a candidate with artificial certainty

**Locations:** `ucg_lab/validation.py:51–67,129,182–196`; configuration reachability in `ucg_lab/config.py:123–126`.

The circular bootstrap accepts `block_length >= n_observations`. Each replicate then contains exactly one circular rotation of all observations, so every replicate mean equals the observed mean. This is a correct mechanical consequence of that block construction, but its zero-width interval does not estimate uncertainty about the population mean. No runtime diagnostic identifies that structural degeneracy, and `assess_evidence` tests only the resulting positive lower bound. Valid configuration can therefore produce `PAPER_CANDIDATE` without a meaningful uncertainty estimate. The implementation report acknowledges the boundary, but that document-level limitation does not stop candidate promotion.

**Fresh targeted reproduction:** executed successfully with `python` from the repository root. Construct 60 chronological business-day equity rows from initial cash 10,000 and returns `[-0.05, 0.06] * 30`; derive balances by cumulative compounding, daily P&L by balance differences, and one matching trade per day with zero fees. Call `summarize_performance(..., {'block_length': 60, 'bootstrap_samples': 200})`, followed by `assess_evidence(metrics, 'real', 'holdout', provenance_verified=True)`.

Observed output:

```text
n_observations: 60
block_length: 60
bootstrap lower: 0.005000000000000001
bootstrap upper: 0.005000000000000001
net_return: 0.232775846071273
max_drawdown: 0.050000000000000266
status: PAPER_CANDIDATE
failed_checks: []
eligible_for_live: False
```

This reproduction establishes structural interval degeneracy and candidate promotion. It does not establish the true profitability or true sampling uncertainty of that illustrative return process.

**Recommendation:** preserve the specified circular-block calculation if desired, but explicitly mark inference invalid when `block_length >= n_observations`, propagate the reason into metrics, and prevent either candidate status for that result. Rejecting that configuration before evaluation is another reasonable option. Do not silently select a different block length. Any stronger minimum-effective-block or Monte Carlo tail-resolution policy should be specified prospectively, with its assumptions stated; it should not be invented after seeing performance.

**Regression recommendations:** use an internally consistent account/trade fixture like the reproduction; verify that block lengths equal to and greater than the record length cannot gain candidate status, while remaining synthetic/live restrictions still hold. Keep the existing literal full-sample circular-block test if the numerical helper continues to expose the mechanical result. Ensure a valid shorter-block configuration still produces finite reproducible diagnostics. Avoid asserting that every constant observed return series must have a positive-width interval: the defect here is a known resampling-design degeneracy, not a universal demand for invented variability.

## Verified behavior and review reasoning

### Chronology and model preprocessing

`fit_predict_model` finds the earliest test decision and excludes labels ending at or after that boundary (`models.py:68–81`). It additionally excludes decisions at/after the boundary and rejects outcomes ending before their decisions. Minimum training size is checked after purging. Training medians, the all-missing-column zero fallback, and StandardScaler fit are applied to eligible training rows only (`models.py:45–48,81–84`). Test observations cannot alter that fit. Target/timestamp columns are blocked from requested model features. The default ridge alpha is 10, and output shape/finiteness are checked.

The optional LightGBM import has an explicit error and no fallback (`models.py:92–103`). Single-thread CPU/deterministic defaults are set. The installed-LightGBM branch remains unverified, as the implementation report states; no installed-branch success is inferred from inspection.

Walk-forward windows use the requested exact rolling training length, disjoint contiguous test blocks, and a final partial block (`models.py:111–123`). Canonical sorted unique input dates are required.

### Historical analogs

Analog eligibility requires both the decision and completed label to precede the query strictly (`models.py:137–146`). Normalization and imputation operate after that filter. Distances use features, not realized outcome magnitude; negative outcomes are retained. Selection allows at most one case per session and breaks distance ties chronologically (`models.py:149–164`). These cases remain descriptive, dependent examples rather than independent validation. Input temporal validity of supplied labels remains a caller/data-contract responsibility.

### Performance calculations

The drawdown calculation includes initial cash (`validation.py:97–99`). Weekly returns compound within ISO year/week, and activity uses every week represented in the supplied equity rows (`validation.py:100–110`). All supplied daily returns, including zeros, enter the mean and bootstrap. Net account return uses final balance relative to initial cash; trade win rate, fees, profit factor, and mean trade return use the appropriate trade outcomes. Undefined trade ratios are null. Annualization is labeled an approximate 252-session extrapolation.

This module cannot reconstruct a missing session calendar from equity alone. Complete evaluation-session coverage is correctly identified in the implementation report as an orchestration responsibility. The reported drawdown is based on daily ending equity; it does not measure intraday peaks or losses. The reviewed workflow adds that distinction explicitly.

### Statistical and claim boundaries

The bootstrap implements seeded circular contiguous block sampling and a percentile interval. Bonferroni adjustment applies `alpha/family_size` to the supplied recorded family, with an explicit warning about adaptive or unrecorded searches. The generic assumptions about stability, dependence, regime change and Monte Carlo tail resolution are accurately described as limitations; no numerical interval constitutes a future-profit probability.

Default screening thresholds are labeled illustrative, and real candidate status requires verified provenance. Missing/nonfinite required gate values fail closed. Synthetic results cannot gain a candidate status, including with favorable metrics and verified provenance, and every successful return path hard-codes live eligibility false (`validation.py:188–203`). There is no source-level claim that Task C establishes a profitable UniCredit strategy.

## Verification limits

The fresh execution in this review was the focused C1 reproduction. The entire test suite was not rerun: the task requested targeted reproductions only for concrete issues. The earlier 18 passing Task C tests and full-suite import errors described in `task-c-report.md` are implementation-report evidence, not independently rerun test claims. Statistical validity under real returns, real-data provenance, complete experiment accounting, real costs, final-holdout discipline and prospective paper performance remain outside the conclusions of this review.


## Round 1 scoped re-review

**Verdict: C1 addressed; no new critical or important defect found in the correction.** Literal Task C specification compliance remains PASS, and code quality/scientific robustness is now PASS within the reviewed scope.

Reviewed `review-c-fix1.diff`, current `validation.py`, the new regression tests and the appended implementation report. The numerical bootstrap still displays the requested mechanically computed statistics. It now explicitly sets inference screening invalid for blocks equal to or longer than the observation record (`validation.py:64–76`). It also rejects fewer than 10 expected bootstrap draws per adjusted tail. The latter is accurately described as a screening policy rather than proof of interval validity.

Summary metrics propagate both the flag and failure reasons. The gate requires explicit true flags and empty failure lists in both summary and nested bootstrap diagnostics (`validation.py:198–206`). Missing diagnostics fail closed. As a result the original full-sample-block example, including block lengths 60/61 with 200/5,000 bootstrap draws, returns `RESEARCH_ONLY` for real development/holdout results. The numerical return/interval statistics remain visible, and neither the block length nor the search correction is silently changed. Synthetic results remain `SYNTHETIC_DEMO`; all live flags remain false.

Fresh independent verification ran only the three regression methods relevant to this correction:

```text
PYTHONPATH=tests python -m unittest -v test_validation.BootstrapTests.test_inference_diagnostics_full_sample_blocks_and_tail_resolution test_validation.EvidenceTests.test_review_fixture_invalid_inference_cannot_promote_real_candidate test_validation.EvidenceTests.test_missing_or_invalid_inference_diagnostics_fail_closed
Ran 3 tests in 0.065s
OK
```

Those tests cover the original consistent account/trade fixture, both candidate phases, full/oversized blocks, adequate and inadequate adjusted-tail resolution, the exact 10-draw boundary, missing diagnostics, nested invalidity, reproducibility, JSON safety, and preservation of synthetic/live restrictions. The constant-return example correctly retains its possible zero-width numerical interval when the newly specified checks pass; no artificial variability is introduced.

The name `inference_valid` denotes passage of the documented screening checks. The returned policy and caveats expressly state that it does not establish stability or adequate dependence modeling. Broader statistical assumptions and the original report's other limitations remain. The reported full-suite passes were not independently rerun during this scoped re-review, as requested.
