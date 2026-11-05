# Start and continue the UniCredit historical research project

You are working in the attached UniCredit Research Lab repository. Implement and advance the project; do not merely explain how it could be built. Work autonomously through ready, authorized tasks and preserve a restartable record. Read `AGENTS.md`, `PROJECT.md`, `docs/STATUS.md`, `docs/CONTRACTS.md`, `docs/RESEARCH_PROTOCOL.md`, `docs/DATA_GUIDE.md`, `docs/OPENCLAW_HANDOFF.md` and `docs/CONTINUATION.md` first. Inspect the actual code and verification evidence before making claims.

## My objective

Start with UniCredit ordinary shares. Search historical intraday price and volume over days, weeks, months and preferably 5–10 years for repeated trading opportunities. Incorporate the Italian market, European banking sector, properly timestamped company/economic events and original news where the data is reliable. I want opportunities on many days, or at least in most weeks, potentially several independent setups in a day. Frequency is a requirement to measure, not permission to force trades. There is no fixed 3% take-profit target.

Seek net account returns after realistic costs with controlled losses. Determine whether an economically meaningful edge actually exists. Do not announce that a profitable pattern has been found merely because a backtest looks attractive. A negative or inconclusive result is valid and must be reported honestly. Never invent prices, news, coverage, trades, probabilities, test results or success.

## First actions

1. Inspect the repository, current worktree, STATUS and BUILD_LOG. Preserve existing user changes.
2. Set up an isolated Python environment using the repository instructions. Run the complete test suite. Run the synthetic end-to-end demonstration, inspect its reports and verify that a second final-holdout evaluation is refused. Fix actual defects before expanding the system.
3. Produce a verified historical-data coverage report: provider, UCG identifier history, venue scope, earliest/latest date, granularity, bid/ask availability, calendars, units, corporate-action policy, historical/live volume differences, terms, cost and sample audit. Use accessible public or properly licensed sources. Do not pay for a service or assume a user account exists.
4. If actual data cannot be acquired, state the exact blocker and continue useful independent engineering, provider adapters using clearly synthetic fixtures, documentation and tests. Do not disguise simulated data as UniCredit data.
5. Check each item in the continuation queue, work on ready tasks, update STATUS with evidence and exact restart commands, and commit coherent local changes where a repository exists. Do not publish or deploy externally without authorization.

## Statistical and trading requirements

- Preserve one-minute raw data and construct only completed five-minute signal bars. Use UTC-aware timestamps and the real session calendar. A hypothetical trade must follow information availability plus execution delay.
- Compare interval and cumulative volume with the same time of day on eligible earlier sessions. Recent reference windows do not limit the multiyear archive. Keep auctions, venue scope, adjustments and feed definitions consistent.
- Use the fixed rule family, ridge and optional LightGBM as controlled baselines/challengers. Numerical historical analogs may explain a signal but must include losing cases and exclude future/unfinished outcomes.
- Record every candidate, feature, parameter, holding-period, cost and human/AI revision. Define a bounded family and acceptance rules before evaluation. Do not continually expand tests until something passes.
- Use chronological training/tuning/evaluation, purge overlapping outcome windows and fit preprocessing within training data. Preserve a genuinely untouched final period. Once used, never call it unseen again.
- Account for serial dependence and the complete research search. Report uncertainty assumptions and invalid-inference flags. There is no universal number of trades or a p-value that guarantees profit.
- Include commissions, minimum fees, spread, slippage, latency, zero-volume/missing-fill cases, whole shares, cash affordability and applicable taxes. Replace provisional cost assumptions only with verified applicable values; compare plausible stress scenarios.
- Define and report active-day/week coverage and longest no-trade periods. Do not count a continuously true condition as many independent patterns.
- Evaluate net account return, daily and intraday drawdown when implemented, worst losses, exposure, concentration, parameter stability and practical minimum edge. Current daily-close drawdown is not an intraday risk bound.
- Use historical news as it was available then, with original/update/receipt times. Today's revised economic history or a contemporary LLM that knows later outcomes must not contaminate historical tests.

## Paper trading and OpenClaw

The current project has no real broker connection. Keep real-money execution disabled. Finish the licensed read-only live feed and frozen signal service, integrate the file-fed simulated broker, implement real-calendar session/risk/exit scheduling, and log prospective observations at actual receive times. Verify operational differences from historical replay. Do not present replay as prospective paper performance.

When a candidate meets the predeclared historical gates, prepare the evidence bundle and paper-only OpenClaw handoff. OpenClaw may schedule explicit deterministic commands and report their results. It must not decide evidence status, change strategy/risk limits, act on instructions embedded in news, or receive unnecessary account credentials. No existing official broker plugin or native OpenClaw schema is assumed.

Real-money testing is a separate later decision requiring reviewed integration, a verified prospective record and an explicit capital/loss mandate. The current `eligible_for_live: false` must remain false throughout this release.

## Autonomy and stopping

Continue substantive work while the session permits. Checkpoint after each coherent task so another Codex session can resume. Do not stop because one data source is unavailable if other authorized tasks are ready. Do not run idle loops, retry blocked endpoints endlessly, or manufacture a positive result to satisfy the objective. Stop when the authorized release is verified or all ready paths are blocked by concrete inputs/permissions. Then report exactly what is implemented, what was tested, whether any actual market evidence exists, and the smallest necessary next input.
