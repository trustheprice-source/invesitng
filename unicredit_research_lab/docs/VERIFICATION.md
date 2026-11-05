# Delivery verification — version 0.1.0

Verified 5 November 2026. These checks establish behavior of the delivered software under the recorded environment. They do not establish any UniCredit trading edge, real-feed accuracy or operational trading readiness.

## Recorded environment

| Component | Version |
| --- | --- |
| Python | 3.12.14 |
| NumPy | 2.3.5 |
| pandas | 2.2.3 |
| scikit-learn | 1.8.0 |
| SciPy | 1.17.0 |
| joblib | 1.5.3 |
| threadpoolctl | 3.6.0 |
| setuptools | 84.2.1 |
| LightGBM | Not installed |

The package declares Python 3.11+ and compatible numerical ranges. The table records the actual delivery test environment; no other Python version or operating system was verified. `requirements-tested.txt` records these numerical versions but is not a full hash-locked dependency graph.

Reviewed and exercised package-source SHA-256:

```text
b423f740234ffbf5af61b88fe61c791ce5efa05b476680697a1da853aca2b2a7
```

This is the project-defined hash over sorted `ucg_lab/*.py` names and bytes, not a hash of the entire archive. Study identity also records inputs, configuration and dependency versions.

## Full test suite

```bash
python -W error -m unittest discover -s tests -v
```

**Result: 124 tests passed, 11.651 seconds, exit 0.** Warnings were treated as errors. The count includes the 12 final-review regression methods; they are not added again to the total.

Tests cover strict data/schema validation, complete supplied calendars, same-clock historical volume, causal features and event availability, training-only preprocessing and outcome purging, realistic cost fixtures, no fabricated zero-volume fills, one entry per signal episode, complete loss/account exhaustion, approximate bootstrap validity guards, inactive-session coverage, bounded registration, immutable study identity, one-use holdout, missing-ledger failure, artifact changes, synthetic nonqualification and simulated-account state/freshness/idempotency.

A full-suite pass does not prove the absence of defects. In particular, source metadata and a supplied calendar cannot independently prove that a real vendor feed or calendar is correct.

## End-to-end synthetic demonstration

```bash
python scripts/run_demo.py --out workspace/delivery_final
```

**Result: exit 0.** Generated 180 invented three-hour sessions, then completed audit, development, freeze, final test, paper handoff and simulated-account initialization. All four declared development candidates completed with no recorded failures. Every candidate and final result remained `SYNTHETIC_DEMO`; every live-eligibility flag remained false. Ridge was selected only to exercise the workflow and produced zero trades in this example. No real UCG result is implied.

The four HTML/JSON report snapshots are included in `examples/`. Full generated data, SQLite accounts and runtime experiments are excluded from the source archive; rerun the demo in a new directory to inspect them. The two-session minimal input fixture is separate from the 180-session report run.

```bash
python -m ucg_lab holdout --study workspace/delivery_final/study
```

**Expected refusal verified:** exit 2 with `Final holdout already consumed; it is no longer an unseen test`. The first attempt was preserved.

```bash
python -m ucg_lab analogs --study workspace/delivery_final/study --max-cases 10
```

**Result: exit 0**, ten earlier development analogs returned. Final-period and unfinished-outcome exclusions are also covered by tests.

## Installation and entry point

An isolated virtual environment sharing the preinstalled numerical packages was created outside the project. Local installation used:

```bash
python -m pip install --no-index --no-deps --no-build-isolation -e .
ucg-lab --help
```

Both succeeded. This verifies local package metadata and the installed console entry point with available dependencies. It does not claim a fresh internet installation, a macOS/Windows run or an installed LightGBM fit.

## Independent review

Separate reviews covered data/features, financial execution and model/evidence behavior. The final integration review identified and then approved corrections for cross-fold zero equity, dependency version coverage, prospective clock integrity, configuration boundaries and lost/incompatible registries. The reviewer independently ran all 12 final-regression methods with warnings as errors; the fix implementer ran 35 focused tests. Those overlap with the full 124-test suite.

The handoff review's optional context/news manifest-wiring issue was corrected. Review records and bounded limitations are retained in `docs/reviews/`. `git diff --check` passed before packaging.

## Archive verification

The release contains source, tests, documentation, input templates and explicitly synthetic examples. It excludes repository internals, environment packages, caches, private data, credentials and runtime experiment/account databases. `MANIFEST.sha256` records each included source file's bytes.

The packaging gate validates ZIP CRCs and safe paths, extracts into a separate directory, compares every extracted file with the packaged input, confirms imports come from the extracted project, runs module help, audits the minimal synthetic fixture and runs the CLI regression tests from the extracted directory. This gate passed: all 76 archive entries were validated (75 source/document/example files plus the checksum manifest), module help and the fixture audit returned exit 0, and all three CLI regression tests passed from the extracted project. The import-location check confirmed the extracted source was used.

## What was not verified

- Any real UniCredit prices, corporate-action adjustments, volume history, original news, executable quotes or licensed provider connection.
- Any profitable pattern, statistical market edge, prospective paper return or real-money result.
- A full installed LightGBM model run. Explicit unavailable-dependency behavior and version-identity guards were tested.
- An unattended strategy loop, real exchange-session scheduler, automatic paper exit/risk service or live broker adapter.
- Intraday maximum drawdown, order-book queue/market impact, production fault tolerance or advanced adaptive-search inference.

The reported drawdown uses daily ending equity. Hypothetical minute-bar and quote-snapshot fills remain approximations. Real-data qualification requires the remaining inputs and validation work in `CONTINUATION.md`.
