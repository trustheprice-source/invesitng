# Research protocol and evidence interpretation

## Pre-register the experiment

Record instrument, venue/trade universe, dataset hash, code/dependency identity, feature definitions, label/execution horizon, model family, all parameter choices, costs, capital, risk/frequency thresholds, search budget and reserved final dates. A local study is intentionally immutable. The current four candidates use illustrative parameters and are hypotheses, not recommended trades.

Current model target: net percentage return on reference entry expenditure, after declared fixed-horizon execution costs. It excludes the strategy simulator's stop/EOD early exits. Judge trading performance from the full simulator, not prediction MSE or direction accuracy alone. No shorting, leverage, derivatives or overnight positions are included.

## Historical chronology

The CLI reserves the final N supplied sessions before constructing development features or outcomes. Structural auditing covers all inputs, but holdout returns never guide development selection. Within development, a rolling training window predicts successive nonoverlapping test blocks. Feature histories may include older sessions known at each decision. Training labels whose outcomes reach the evaluation start are removed. Model imputation/scaling uses training observations only.

The final selected model is fitted once on the declared training window preceding holdout and stays fixed throughout the final period. This is explicitly different from adaptive retraining. If future research introduces scheduled retraining, freeze and evaluate the full retraining policy rather than changing it during final testing.

All research attempts are registered before performance evaluation; failed attempts remain counted. The registry caches unchanged completed trials. There is no random retry until success. A frozen final attempt is recorded before computation and remains consumed even after an operational failure. Operational recovery requires a documented new evaluation plan, not deleting the record.

## Uncertainty and sample dependence

The prototype aggregates all executed decisions into daily account returns, including no-trade sessions, and resamples circular blocks of consecutive sessions. It applies a Bonferroni-adjusted alpha using the declared maximum family size. This is an approximate bootstrap screening procedure with finite-sample, stationarity, block-length and Monte Carlo assumptions; it is not a universal correction for arbitrary adaptive human/AI searches.

Diagnostics prevent candidate promotion when a block spans the whole evaluation sample or longer, or when fewer than ten bootstrap draws are expected in each adjusted tail. That ten-draw floor is an engineering resolution check, not proof of reliable tail estimation. Tests can still be statistically underpowered above the floor. Choose block lengths and useful effect-size targets before evaluating final performance. Do not treat 30 trades, 60 days, a confidence interval or a high Sharpe as a law of sufficient evidence.

The research defaults use a family budget of 12, 5-session blocks, 5,000 bootstrap samples and alpha .05. These are provisional. A real acceptance protocol may require more precise inference, additional dependence diagnostics, a reality-check/superior-predictive-ability procedure, selection-stability analysis and independent prospective confirmation. Those methods must be implemented and tested explicitly if used; this release does not claim they already exist.

## Account and frequency metrics

Report net account return, annualization convention (252 sessions, approximate), fees, daily ending equity, daily-close peak-to-trough drawdown, worst compounded week, win/loss quantities, average trade return, active-day/week fractions and longest zero-trade stretch. Do not compare raw trade return percentages with whole-account returns. A strategy trading 50 times in two weeks may fail weekly coverage even if average trades/week looks adequate.

Daily-close drawdown excludes intraday equity excursions. Minute-level intraday drawdown, exposure duration, adverse excursion and cost/regime/parameter stress dashboards are continuation work. Historical drawdown and stops never guarantee future loss bounds. Capital exhaustion stays exhausted; the code does not inject new cash.

## Costs and execution

Default EUR10,000 account, 25% position cap, .05% commission/minimum EUR3 each side, 10bps total round-trip spread and 2bps slippage each side are illustrative assumptions, not a quote for the user's broker. The core uses no purchase tax for fully matched same-day ordinary-share round trips under the assumed netting treatment; it is not suitable for overnight/derivative tax accounting. Personal tax, cash interest, data fees and operating expenses are excluded and must be considered before an economic claim.

For bar-proxy execution, half the declared round-trip spread is paid on each side. For quote-snapshot execution, buy at observed opening ask and sell at observed opening bid plus side-specific slippage; no duplicate synthetic spread. Minimum commission and whole-share affordability apply. Zero volume/insufficient data cannot produce a fabricated closing fill. Stops use conservative bar-level gap/touch logic and are marked approximate. No queue-position, market-impact or order-book replay is implemented.

## Candidate states

- `SYNTHETIC_DEMO`: invented data; can never become market evidence.
- `RESEARCH_ONLY`: insufficient evidence, unverified provenance/cost/mandate or failed screening checks.
- `HISTORICAL_CANDIDATE`: development screening checks passed under recorded assumptions; selection bias and practical risks remain.
- `PAPER_CANDIDATE`: a frozen final historical screen passed; proceed only to further evaluation, not real money.

Every state has `eligible_for_live: false`. Ledger/hash protection detects ordinary workflow mistakes; an operator able to edit files can defeat it. It does not replace truthful research practices or a pooled registry across all studies.

## Prospective paper evaluation

Fix the strategy, model/update policy, execution/risk rules and review horizon. Record actual receive times, current quotes, rejected signals, hypothetical fills, outages and all costs. Do not reset losing paper periods. Distinguish retrospective replay from prospective observations. Repeated checking until a significance threshold is crossed needs a valid predeclared sequential method; it is not automatically allowed by more data.

The included file-fed paper broker demonstrates state/accounting, latency, quote freshness and idempotency. A licensed live feed, signal service, real-session scheduler, automatic stop/time exits, a full daily loss service and prospective evidence evaluator remain to be integrated. Do not treat the broker-core demonstration as an operating unattended strategy.
