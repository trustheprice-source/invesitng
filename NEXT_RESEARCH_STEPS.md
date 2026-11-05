# UNICREDIT RESEARCH LAB — NEXT RESEARCH STEPS & ROADMAP
**Prepared By:** Quantitative Research & Microstructure Strategy Team  
**Focus:** Actionable Engineering & Statistical Strategy Discovery for UniCredit (`UCG.MI`)  
**Date:** November 5, 2026

---

## 1. Executive Summary

Phase 6 concluded with a critical empirical insight:
> **The bottleneck in intraday UniCredit trading is not signal directionality, but transaction cost friction relative to volatility horizon.**

Under institutional retail broker schedules (€3.00 minimum ticket + 10 bps spread + 4 bps slippage), short-horizon intraday trades (5–30 minutes) have a 38 bps friction hurdle that exceeds the 31 bps asset volatility, creating negative mathematical expectancy.

To discover statistically defensible, positive trading returns, the research lab must transition from high-frequency microstructure scalping to **economically sound holding horizons, larger notional sizing, and multi-asset relative value architectures**.

---

## 2. Six Actionable Research Initiatives

### Initiative 1: Transition to Multi-Hour & Intraday Swing Horizons (60m – 240m)
- **Problem:** At 15–30 minutes, $\sigma \approx 22\text{--}31\text{ bps} < 38\text{ bps friction}$.
- **Solution:** At 60–120 minutes, $\sigma \approx 44\text{--}62\text{ bps} > 38\text{ bps friction}$.
- **Action Item:** Re-calibrate candidate holding periods to 60, 90, and 120 minutes. Implement trailing volatility stops that allow winning positions to run during strong morning trend sessions (09:30–12:00 CET) while maintaining the mandatory flat-by-17:25 CET liquidation.

### Initiative 2: Capital Sizing & Notional Friction Optimization
- **Problem:** On €2,500 trade notional, the €3.00 fee is 12 bps per side (24 bps round trip).
- **Solution:** On €20,000 trade notional (e.g. €80,000 portfolio with 25% allocation), the €3.00 minimum fee is superseded by the 0.05% rate ($€10.00$), reducing ticket drag to exactly 5 bps per side (10 bps round trip).
- **Impact:** Total round-trip friction drops from **38 bps to 24 bps**, dramatically improving the win-rate requirement.
- **Action Item:** Introduce a configurable Portfolio Sizing Optimization module in `ResearchView` allowing researchers to test capital regimes from €10,000 to €250,000.

### Initiative 3: Banking Pair Cointegration (`UCG.MI` vs. `ISP.MI` / `BAMI.MI`)
- **Premise:** UniCredit frequently co-moves with Italy's other banking powerhouse, Intesa Sanpaolo (`ISP.MI`), and mid-tier leader Banco BPM (`BAMI.MI`).
- **Hypothesis:** Idiosyncratic price divergences between UCG and ISP driven by non-fundamental liquidity blocks mean-revert over 2 to 4 hours with higher statistical certainty than single-name momentum.
- **Action Item:** Expand data ingestion to include simultaneous 5m bars for `ISP.MI` and compute rolling Engle-Granger cointegration residuals and Ornstein-Uhlenbeck mean-reversion half-lives.

### Initiative 4: Pre-Market & Closing Auction Imbalance Dynamics
- **Premise:** In European equities, up to 25% of daily volume transacts during the 17:30–17:35 CET Closing Auction (MOC — Market On Close).
- **Hypothesis:** Imbalances between indicative closing auction prices and continuous VWAP at 17:20 CET create predictable liquidity premia.
- **Action Item:** Integrate auction indicative match price and volume feeds to test end-of-day market-on-close rebalancing strategies.

### Initiative 5: Ingestion of Institutional Multi-Year Tick History
- **Status:** Public free feeds are limited to 60 days of 5-minute data.
- **Action Item:** Procure an authorized 5–10 year institutional dataset (Euronext Market Data Solutions or LSEG Tick History). Ingest via the verified CSV pipeline (`server.ts` `/api/market/upload-audit`). This will expand the sample size from 60 sessions to $> 1{,}500$ sessions, enabling deep out-of-sample walk-forward validation across differing macroeconomic rate cycles (e.g. 2022–2024 ECB tightening cycle).

### Initiative 6: Multi-Task Gradient Boosted Tree Architecture (LightGBM)
- **Problem:** Linear models (`ridge_v1`) overfit noise; hardcoded rule models (`pullback_v1`) lack adaptive regime conditioning.
- **Solution:** Train a shallow Gradient Boosted Tree ensemble (maximum depth 4, minimum child weight 50) using monotonic constraints:
  - Input features: RVOL at minute $M$, distance to intraday VWAP, 60m sector spread to `EXV1.DE`, opening gap magnitude, and 30m realized volatility.
  - Target: Forward 60-minute net return after friction.
- **Action Item:** Implement a lightweight decision tree evaluator in TypeScript (`src/engine/treeModel.ts`) trained on development partitions and evaluated with strict circular block cross-validation.

---

## 3. Immediate Implementation Schedule

| Phase | Milestone | Deliverable | Target Date |
|---|---|---|---|
| **Phase 7.1** | Multi-Hour Horizon & Sizing Engine | Expand horizons to 60m/120m and test €50k+ notional | Sprint 1 |
| **Phase 7.2** | Italian Banking Pair Engine | Ingest `ISP.MI` and test cointegrated spread mean-reversion | Sprint 2 |
| **Phase 7.3** | Institutional CSV Upload & 5-Year Ingestion | Ingest historical LSEG/Euronext tick archive | Sprint 3 |
| **Phase 7.4** | Non-Linear Monotonic Tree Model | Train LightGBM model on 60m targets | Sprint 4 |
| **Phase 7.5** | One-Shot Holdout Gate Review | Submit qualifying candidate to frozen holdout partition | Sprint 5 |

---

## 4. Final Recommendation
Continue developing the UniCredit Research Lab under strict scientific governance. The preservation of the uncorrupted holdout ledger and the transparent reporting of real-market microstructure barriers position the lab for genuine, defensible alpha discovery.
