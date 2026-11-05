# UniCredit Research Lab

## Objective

Build and operate a reproducible research system for UniCredit ordinary shares that searches years of historical intraday price, volume, market context and timestamped events for opportunities occurring on many days or in most weeks. Optimize net account returns subject to explicit loss/exposure constraints. A valid outcome is that no strategy meets the requirements. A profitable historical curve is not a guarantee or permission to trade real money.

## Scope authorized for this project

Local software development, public or properly licensed data, historical replay, statistical evaluation, a simulated account and a paper-only OpenClaw handoff. Do not purchase data, place real orders, transfer money, access private systems without authorization, evade access controls, or use stolen/nonpublic information. No broker credentials are required for the included demonstration. Do not install external agent skills automatically.

## Decisions

- Start with UCG ordinary shares, EUR, long/cash, whole shares, one position at a time, no leverage, same-day exits.
- Separate opportunity frequency from holding period. Report active days, active weeks and longest no-trade period, not only average trades/week.
- Canonical input is one-minute OHLCV with UTC interval-start timestamps and an explicit calendar of sessions. Five-minute completed bars drive signals. Orders occur only after the decision plus the configured delay.
- Acquire a target of 5–10 years of reliable intraday history if coverage, terms and cost permit. This is not confirmed access. Older periods need corporate-action and feed consistency checks.
- Compare interval and cumulative volume against the same clock interval on earlier sessions. No current day's eventual total volume, close, high or low may be an input to an earlier decision.
- Use a small predefined rule family and regularized ridge regression. LightGBM is an explicit optional challenger. Historical-neighbor examples explain results but are not independent proof.
- Numerical forecasts and deterministic execution produce simulated results. Codex develops/reviews code. OpenClaw may invoke documented paper commands and report results; it is not a source of financial facts or authority to trade live.
- Timestamped event counts and market context are supported. Rich news sentiment, order-book models and production broker adapters are continuation work with explicit data and validation requirements.
- All default capital, cost and risk values are illustrative research assumptions. They are not an accepted personal risk mandate or a broker quote.

## Integrity requirements

1. Preserve raw input and dataset hashes; retain source, acquisition time, units, timestamp semantics, adjustment method and licensing declarations.
2. Reject malformed, duplicated, nonfinite, out-of-session, unsorted or missing one-minute data. Missing observations are not zero-volume observations. Session calendars must be supplied for real datasets.
3. Keep historical comparisons causal. Fit feature scaling and models inside training periods. Purge training labels that finish at or after the evaluation boundary.
4. Separate chronological development from a final holdout. Register every attempted candidate before computing its result. Use a bounded search budget. Freeze the candidate, inputs, costs and acceptance criteria before the final test.
5. Consume the final holdout once, recording the attempt before evaluation. A failure does not justify silently resetting the ledger or reusing the holdout as unseen data.
6. Model commissions, spread, slippage, whole-share affordability, one-position limits, delayed fills, stopping rules and end-of-session liquidation. Bar-based execution remains an approximation.
7. Calculate confidence intervals from blocks of daily returns, including no-trade days. Report assumptions, search size, tail losses and concentration of gains. Do not claim a fixed number of bars proves an edge.
8. Synthetic data is permanently marked synthetic in all reports and handoffs and can never qualify a strategy for live trading.
9. This version never returns live authorization. Real-money execution is a separate future project requiring evidence, reviewed broker integration and an explicit capital/risk mandate.
10. No fabricated coverage, news, prices, trades, performance or success alerts. Distinguish unavailable data, no qualifying setup, a research candidate and a paper signal.

## Delivered workflow

1. Generate a reproducible synthetic demo or import an authorized canonical dataset.
2. Audit data and construct causal five-minute features with optional context/events.
3. Run bounded chronological comparisons of rules and numerical models.
4. Save trades, equity, evidence diagnostics, experiment ledger and a local HTML report.
5. Freeze one candidate; evaluate the reserved final period once.
6. Export a paper-only handoff and record prospective observations; retrospective replay must remain labelled replay.

## Definition of completion for this delivery

A runnable Python project, meaningful tests, a demonstrated synthetic end-to-end workflow, documented inputs/commands, statistical and execution limitations, a Codex continuation prompt, a prioritized backlog, and a paper-only OpenClaw contract. Completion of this software delivery does not establish a profitable UniCredit strategy. Verified real data and broker-specific costs remain external inputs.

## Scientific acceptance for a future candidate

Freeze numerical thresholds before testing. Require evidence of positive, economically meaningful net expectancy on subsequent periods, appropriate uncertainty accounting for dependence and the search, useful day/week coverage, losses within the agreed mandate, robust plausible execution costs, no reliance on a few exceptional episodes, and a subsequent frozen prospective paper evaluation. Historical drawdown does not cap future loss. Confidence intervals are conditional estimates, not future-profit probabilities.
