# Task B independent execution review

## Verdict

Current verdict after scoped review round 1: approved for Task B's documented scope. Finding B1 is resolved; no additional defect was found in the correction. Code-quality verdict: focused and understandable implementation with shared pricing, commission, sizing and trade-accounting helpers. The original review established one medium-severity account-exhaustion defect and no critical or high-severity defect; its evidence is retained below.

Reviewed `PROJECT.md`, `AGENTS.md`, `docs/CONTRACTS.md`, `docs/STATUS.md`, `docs/CONTINUATION.md`, the Task B implementation report, the supplied Task B diff, and the strategy/backtest implementation and regression fixtures. This review did not change implementation or run a duplicate full suite. It ran one targeted financial reproduction with the available runtime Python; no repository virtual environment was present.

## Finding B1 — medium, resolved in round 1: a fully depleted account crashes on the next no-trade session

Location: `ucg_lab/backtest.py:295`, daily-return calculation `cash / start_equity - 1`.

A permitted gap loss plus commissions can leave cash exactly zero. The following session correctly cannot buy anything, but producing its mandatory equity row divides zero by zero and raises `ZeroDivisionError`. This prevents returning a valid loss history for otherwise valid canonical inputs. The daily loss brake cannot prevent the triggering gap, and the contract explicitly disclaims such a guarantee.

Targeted reproduction, actually executed:

- Two five-minute sessions beginning 2024-01-02 and 2024-01-03 at 08:00 UTC, with complete one-minute bars and positive volume throughout.
- First session OHLC values per minute: `[97, 97, 97, 3, 3]`; second session: `[3, 3, 3, 3, 3]`.
- One true decision on day one at 08:01. Cash EUR 100; allocation 1; minimum commission EUR 3; proportional commission, spread and slippage zero; latency one minute; holding two minutes; stop 1%; daily brake 2%; cooldown zero.
- Actual first-session result: one share bought at 08:02 for EUR 97 plus EUR 3 commission; gap-stop exit at 08:03 for EUR 3 less EUR 3 commission; net P&L EUR -100; closing equity zero; daily return -1.
- Adding the second session produces `ZeroDivisionError: float division by zero`, even though there are no further signals.

Minimal correction: explicitly define exhausted-account behavior before calculating subsequent daily returns. If the result preserves all supplied sessions, keep zero equity and no trades after bankruptcy and use a documented convention for subsequent unchanged zero-equity days. Do not allow division by zero or imply that a later capital reset occurred. If the project instead chooses a controlled terminal error, document that exception to the one-row-per-session contract and make it intentional and explanatory.

Minimal regression: retain the literal two-session example above; verify the chosen terminal-account policy, the first day's full loss, and absence of later entries. This is an adverse-price test, not an additional execution feature.

## Scoped correction review — round 1

Reviewed `/workspace/scratch/4b21b2e03881/review-b-fix1.diff` and the appended implementation report. The correction retains the original -100% loss and explicitly represents later unchanged zero-equity sessions with zero daily returns, no P&L, no trades and explanatory `account_exhausted` events. Subsequent signals cannot restart trading, and complete canonical validation still precedes the exhaustion branch. Exit-fee liabilities that would create negative equity now cause an explanatory insolvency `ValueError`, preserving the unsupported-debt boundary rather than silently forgiving debt.

The scope is appropriate and the checks do not change ordinary solvent execution. The added tests use literal financial amounts and exercise both a subsequent no-signal session and a later qualifying signal after exhaustion, plus the adjacent negative-equity case.

Fresh reviewer verification: `python -m unittest discover -s tests -p test_backtest.py -k exhausted -k liability -v` ran the two new regression tests; both passed. No duplicate full suite was run. No unresolved Task B findings remain from this review. The review does not independently certify other modules or the full integrated suite.

## Contract checks without findings

- Decisions consume only supplied, chronological timestamps; entry uses the first eligible positive-volume minute at or after decision plus delay. A later false signal cancels pending entry. Persistent true signals do not re-arm, and episodes during an existing position or cooldown do not become stale later entries.
- Whole-share notional obeys the allocation limit; entry cost plus the greater of minimum/proportional fee fits available cash. The long/cash state means cash is current equity whenever a new entry is possible.
- Bar execution applies half spread plus side slippage per side. Quote execution uses ask/bid and side slippage without adding synthetic spread. Both entry and exit fees are reflected in P&L and returns.
- Scheduled/time/gap exits run before new entries, same-bar re-entry is prevented, and intrabar stop checks follow open actions. Zero-volume stop touches defer to a later positive-volume open rather than retaining an unavailable historical stop fill. Quote-stop OHLC approximation is disclosed.
- Final-minute liquidation uses the predetermined opening of that minute. New entries are forbidden there. Missing final liquidation liquidity raises rather than inventing flat inventory or carrying overnight.
- The daily brake uses session-start equity, marks liquidation value at opens and realized exits, latches for the rest of the session and resets next session. It is correctly not presented as a guaranteed loss ceiling.
- Labels independently use initial allocation, the same delay, fees, spread, whole shares and zero-volume availability, with the complete fixed holding period fitting the session. They intentionally exclude stops/brakes and shortened end-of-session outcomes. Outputs remain targets with explicit end times; no target-to-feature path was introduced in Task B.
- Rule readiness, session-local pullback history, fixed thresholds, empty output schemas and input-frame preservation agree with the contract. No live broker path was introduced.

Positive-volume availability is a documented approximation, not a depth or participation model. These omitted market-microstructure features, real-data validation and future broker integration are outside this review's defect scope.
