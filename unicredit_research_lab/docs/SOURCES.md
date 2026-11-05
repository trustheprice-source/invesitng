# Primary sources used for design

Reviewed 5 November 2026. Provider descriptions establish capabilities, not this project's access, UCG history coverage or profit. URLs and terms may change.

1. Euronext NextHistory — https://www.euronext.com/en/products-services/nexthistory — historical Borsa Italiana/Euronext trades, BBO and reference products.
2. IBKR Historical Time & Sales — https://www.interactivebrokers.com/docs/tws-api/doc/md/historical-ticks — documented three-year historical tick window, subscriptions and quote/trade request types.
3. IBKR Market Data Limitations — https://www.interactivebrokers.com/docs/tws-api/doc/md/market-data-limitations — historical/live filtering and volume differences, historical restrictions.
4. UniCredit share information — https://www.unicreditgroup.eu/en/investors/equity-investors/share-information.html — capital actions and historical share changes; not a ready intraday adjustment engine.
5. Borsa Italiana Optiq migration — https://www.borsaitaliana.it/borsaitaliana/ufficio-stampa/comunicati-stampa/2023/optiqmigration.en.htm — migration of cash-equity/ETF markets in March 2023.
6. Cawley & Talbot (2010) — https://jmlr.org/papers/v11/cawley10a.html — model selection can itself overfit performance estimates.
7. White (2000), A Reality Check for Data Snooping — https://users.ssc.wisc.edu/~behansen/718/White2000.pdf — candidate-family testing and dependent-time-series resampling. A full White Reality Check is not implemented here.
8. Bailey & Lopez de Prado (2014), Deflated Sharpe Ratio — https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf — selection bias, multiple testing and nonnormal returns. DSR is not implemented or claimed by this release.
9. LightGBM original paper — https://papers.neurips.cc/paper_files/paper/2017/hash/6449f44a102fde848669bdd9eb6b76fa-Abstract.html — gradient-boosted decision-tree method.
10. Grinsztajn, Oyallon & Varoquaux (2022) — https://papers.nips.cc/paper_files/paper/2022/hash/0378c7692da36807bdec87ab043cdadc-Abstract.html — tabular-model benchmark; does not demonstrate UCG profitability.
11. Glasserman & Lin (2023) — https://arxiv.org/abs/2309.17322 — historical LLM sentiment evaluation and potential look-ahead/general-knowledge contamination.
12. Federal Reserve FRED real-time periods — https://fred.stlouisfed.org/docs/api/fred/realtime_period.html — distinction between today's revised history and information known at an earlier date; date-based vintages alone do not provide every intraday timestamp.
13. Fineco Tobin tax help — https://help.finecobank.com/it/mercati-e-trading/tobin-tax.html — ordinary share-transfer tax on positive end-of-day net purchases. Applicable account/instrument rules still need verification.
14. IBKR European stock commissions — https://www.interactivebrokers.com/en/pricing/commissions-stocks.php — an illustrative fixed plan informed the defaults; they are not the user's verified fee schedule.
15. OpenClaw documentation — https://docs.openclaw.ai/ — general agent/automation documentation; no validated trading strategy or specific UCG broker connector was established by this project.
