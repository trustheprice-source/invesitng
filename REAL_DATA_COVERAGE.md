# UNICREDIT RESEARCH LAB — REAL DATA COVERAGE REPORT
**Target Asset:** UniCredit S.p.A. (`UCG.MI`, ISIN IT0005239360)  
**Exchange:** Euronext Milan / Borsa Italiana (MTAA)  
**Date:** November 5, 2026  
**Status:** INSTITUTIONAL VENDOR AUDIT & STATISTICAL LIMITATIONS ANALYSIS

---

## 1. Executive Summary

To achieve institutional-grade empirical validation, quantitative research on intraday trading requires several years of unbroken price, volume, and order-book observations across diverse macroeconomic regimes.

This report evaluates authorized institutional market data vendors capable of providing multi-year Euronext Milan intraday archives, compares their capabilities, formats, and licensing costs, and formally outlines the statistical limitations of relying solely on the current 60-session dataset.

**Governance Mandate:** In strict adherence to project instructions, no commercial data subscriptions or licenses will be purchased without explicit user authorization.

---

## 2. Institutional Vendor Comparison Matrix

| Vendor / Provider | Coverage Granularity | History Length | Order Book / Spreads | Corporate Actions & Splits | Synchronized Sector Feed | Licensing Model & Cost | Feasibility & Recommendation |
|---|---|---|---|---|---|---|---|
| **Euronext Market Data Solutions (MDS)** | Nanosecond tick-by-tick, Full Level 3 (Optiq) | 10+ years | Direct Borsa Italiana uncrossing & full depth | Official Euronext corporate actions log | Direct feeds for Italian banking constituents | Commercial exchange redistribution: ~€1,500–€3,500/month + exchange fees | **Gold Standard** for European market making, but requires institutional budget and compliance agreements. |
| **LSEG Tick History (formerly Refinitiv / Reuters)** | Millisecond tick trades & quotes (L1/L2) | 15+ years (back to 2008 crisis) | Complete historical bid/ask quotes with sizes | Comprehensive dividends, splits & capital increases | Cross-asset coverage (`EXV1.DE`, `FTSEMIB.MI`, `ISP.MI`) | Institutional enterprise data license (quoted per firm) | **Preferred Academic / Quant Fund Source** for deep backtesting across ECB rate cycles. |
| **Bloomberg Data License (B-PIPE / Intraday Bar)** | 1-minute, 5-minute, and raw tick history | 5–10 years | Top-of-book bid/ask snapshots | Fully integrated corporate actions and cash dividends | Global banking indices & sovereign bond yields (BTP/Bund) | Per-terminal or enterprise server license ($24k+/year) | High fidelity, standard in institutional asset management. |
| **FirstRate Data (Milan Equities Intraday Package)** | 1-minute and 5-minute OHLCV bars | 10+ years (2014–2026) | Modeled NBBO spreads; no historical L2 book | Split and dividend adjustment files included | Available for major Milan tickers (`UCG`, `ISP`, `BAMI`) | One-time archive download license: ~$350–$600 | **Most Cost-Effective Practical Workaround** for offline institutional testing. |
| **Interactive Brokers (TWS / Client Portal API)** | 1-minute bars & live consolidated top-of-book | Up to 2 years of 1-minute bars | Live real-time streaming quotes (historical quotes limited) | Basic split adjustments | Simultaneous multi-ticker streaming | Funded brokerage account ($0 extra data fee for basic MTAA) | Excellent for forward prospective paper trading; insufficient for 10-year historical research. |
| **Yahoo Finance API (Current Web Default)** | 5-minute bars (60 days), 1-minute bars (7 days) | 60 calendar days | Modeled 10 bps spread (no historical book quotes) | Splits reflected, but unadjusted intraday prices | Cached companion feeds (`EXV1.DE`, `FTSEMIB.MI`) | Free public endpoint | **Useful for system development & baseline audit**, but statistically inadequate for long-term alpha proof. |

---

## 3. Data Ingestion Architecture & Workaround Pipeline

To ensure the codebase is fully prepared for multi-year institutional data without modifying code when authorized:

1. **Standardized CSV Schema:**
   The web server (`server.ts`) and TypeScript engine (`src/engine/features.ts`) support an audited CSV drop-in pipeline:
   - `bars.csv`: `timestamp (ISO/UTC), open, high, low, close, volume, session_date, minute_of_day`
   - `sessions.csv`: `session_date, open_timestamp, close_timestamp, is_holdout`
   - `quotes.csv` (optional): `timestamp, bid_open, ask_open, bid_size, ask_size`
2. **Deterministic Parity Ingestor:**
   Dropping authorized vendor CSVs into the `/workspace` directory automatically overrides the 60-day Yahoo Finance mirror, unlocking multi-year walk-forward backtesting.

---

## 4. Statistical Limitations of the 60-Session Historical Dataset

Because commercial subscriptions are not yet procured, the current empirical dataset is restricted to 60 completed trading sessions (August 14 to November 5, 2026). Researchers must recognize the following severe statistical limitations:

### 4.1 Single Macroeconomic & Interest Rate Regime
- During the August–November 2026 window, European financial markets operated under a **single monetary policy regime**: ECB deposit rate easing expectations and European banking consolidation rumors (UniCredit's disclosed stake in Commerzbank AG).
- In this period, UniCredit shares declined from **€85.73 to €77.18 (-9.33%)**.
- The dataset contains **zero representation** of:
  - Aggressive central bank rate hikes (e.g., 2022–2023 ECB cycle).
  - Sovereign debt spread crises (e.g., BTP-Bund widening shocks).
  - Market liquidity freezes or flash crashes (e.g., March 2020 COVID selloff).
  - Prolonged multi-month bull runs.

### 4.2 Sample Size & Power Insufficiency
- **Total Sessions:** 60 daily sessions (30 dev, 30 holdout; or 40 dev, 20 holdout).
- **Trade Samples:** Across 30–40 sessions, a disciplined quantitative strategy generates only **10 to 35 trades**.
- Under circular block bootstrap resampling, a sample of 15–20 trades yields a **95% confidence interval margin of error of $\pm 25\text{ to }40\text{ basis points}$**.
- Any observed "edge" of $+10\text{ to }+20\text{ bps}$ is statistically indistinguishable from zero or random noise ($p > 0.20$).

### 4.3 Severe Overfitting & P-Hacking Vulnerability
- Attempting to train non-linear models (e.g., LightGBM, Random Forests, Multi-layer Perceptrons) on 60 sessions runs an extreme risk of memorizing specific calendar days (e.g., August 28 ECB minutes release).
- A model with 50 parameters evaluated on 60 daily sessions has more degrees of freedom than independent market episodes.

### 4.4 Intraday Sub-Bar Microstructure Approximations
- As confirmed in `PHASE7_VERIFICATION.md`, the 1-minute bars are linearly interpolated proxies from 5-minute prints, and bid-ask spreads are modeled at 10 bps.
- Real-world institutional execution encounters queue priority delays, adverse selection from latency-arbitrage HFTs, and order-book skew, none of which can be observed without genuine tick-level Level 2 data.

---

## 5. Conclusion & Research Protocol Guidelines

1. **Academic Honesty:** Findings derived from the 60-session dataset must be designated as **preliminary microstructure exploratory findings**, never as proven commercial trading edges.
2. **Next Steps:** When authorized, procure an institutional historical archive (e.g., FirstRate Data Milan Equities 10-Year or LSEG Tick History) to test whether identified patterns survive across 2015–2025 market regimes.
