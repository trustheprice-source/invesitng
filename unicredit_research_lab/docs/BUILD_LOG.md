# Build log — plan: docs/superpowers/plans/2026-11-05-research-lab.md

## Authorization and rulings

- User requested the complete Codex project after the historical intraday design. Implementation is authorized; no repeated design approval is needed.
- Fresh isolated project directory; no existing repository or files were found in the workspace.
- Ruling: independently owned modules may be implemented concurrently under frozen contracts. This follows the session's parallel-delegation instruction; agents must not edit shared files or the Git index. Root integrates and commits.
- Ruling: use stdlib unittest because pytest is not installed. Numerical dependencies are available locally; optional LightGBM is not installed and will be tested for explicit unavailability.
- Ruling: paper-only delivery, with prototype execution and evidence assumptions exposed. No external data has been acquired and no actual UCG result exists.

## Preflight interface scan

| Tasks | Shared interface | Resolution |
|---|---|---|
| A/B | UTC minute-start bars, session calendar, completed decision_time | Fixed in CONTRACTS; no shared file edits. |
| A/C | Feature column list, target merge, session labels | C accepts explicit feature list; target labels supplied by B. |
| B/C | Daily equity includes zero days; trades have fixed schema | C consumes tables, does not implement execution. |
| A/D | Dataset manifest paths, audit and hash | D delegates input validity to A, additionally validates research config. |
| B/D | Backtest input is already evaluation-sliced | D slices by official supplied sessions and aggregates outer-fold results. |
| C/D | JSON-safe statistics and all live eligibility false | D preserves state, phase, model/cost/data hashes. |
| A | Data tests align with strict complete-minute contract | Invalid real feeds must be normalized explicitly, not silently filled. |
| B | Fill tests align with one-minute delay and whole shares | OHLC stops flagged approximate; no fabricated fills. |
| C | Inference tests align with approximate dependent bootstrap | Candidate status is screening, never proof or authorization. |
| D | Integration tests align with one-shot holdout and synthetic labels | Ledger records intent before computation. |

## Progress

- Specification, contracts and implementation plan written.
- Tasks A/B/C implemented with independent test-first reports and reviewed separately.
- Task A fix round 1: reject uniformly malformed CSV field counts before pandas; reject finite intermediate volume/turnover overflow. Scoped review approved.
- Task B fix round 1: preserve exhausted accounts at zero without recapitalization; explicitly reject unsupported negative-equity fee liability. Scoped review approved.
- Task C fix round 1: report invalid bootstrap inference for whole-sample blocks and inadequately resolved adjusted tails; evidence gate fails closed. Scoped review approved.
- Ruling: these diagnostics strengthen the original specification; bootstrap mechanical output remains available for transparent demonstrations, but cannot promote an invalid candidate.
- Root workflow: synthetic audit/development/freeze/one-shot holdout/handoff integration tests passed. A pandas empty-trade concatenation warning was reproduced with warnings-as-errors and removed.
- Paper account core implemented and financially checked for delayed hypothetical fills, commissions, capital caps, idempotency and stale/future observations. It does not yet supply live data, signals, session scheduling or automatic exits; these remain explicitly documented integration work.
- Initial integrated verification: 112 tests passed with warnings treated as errors; the full 180-session invented-data CLI workflow completed. These checks exercise software and do not establish a market edge.
- Final independent integration review requested corrections for cross-fold capital exhaustion, dependency identity, prospective receipt-clock integrity, configuration type/range consistency and recovery from a missing study ledger. A documentation review requested explicit optional context/news manifest wiring. One coordinated correction wave resolved F1–F5 and the documentation issue. Scoped independent re-review approved the final source; see the retained review reports.
- Packaging decision: preserve the local branch and deliver the source as one ZIP. No external repository, merge, push or deployment is part of this request.

## Final verification

- Final package source hash: `b423f740234ffbf5af61b88fe61c791ce5efa05b476680697a1da853aca2b2a7`.
- Full suite: 124 tests passed with warnings treated as errors (11.651 seconds).
- Fresh 180-session synthetic CLI demonstration completed all four candidates, freeze, final evaluation, paper handoff and simulated-account initialization.
- Repeating the final evaluation returned the expected exit 2; analog inspection and installed console help succeeded.
- Exact environment and limits are in `VERIFICATION.md`. No actual UCG data or trading evidence exists.
- Archive gate: 75 source/document/example files plus a checksum manifest; CRC/path/byte validation, extracted import, help, fixture audit and three CLI tests passed.
