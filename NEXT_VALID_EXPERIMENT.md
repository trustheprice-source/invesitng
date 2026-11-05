# NEXT_VALID_EXPERIMENT.md: Pre-Registered Protocol for Experiment 9

**System:** UniCredit Research Lab (`UCG.MI`)  
**Phase:** Quantitative Discovery & Adversarial Protocol Horizon  
**Target Candidate:** `exp9_peer_basket_residual` (Derived from Hypothesis Card 11 & Card 18)  
**Governance:** Pre-Registered Frozen Specification, Causal Input Ledger, Fixed Stopping Rules  
**Authorized Search Budget Status:** Trial 9 of 12 (4 trials remaining in current budget allocation)  

---

## 1. The Core Scientific Question

**Question:**  
*Does modeling UniCredit's idiosyncratic intraday residual return ($\epsilon_t$) relative to a point-in-time basket of domestic Italian tier-1 banking peers (`ISP.MI`, `BAMI.MI`, `BMPS.MI`) generate recurring, statistically stationary weekly opportunities (3–5 trades per week) that exceed round-trip Euronext Milan transaction costs ($\ge 24\text{ bps}$), where single-name indicators and aggregate ETF spreads proved either unprofitable or too low in frequency?*

---

## 2. Proposed Economic & Microstructure Mechanism

### 2.1 The Economic Driver
Domestic Italian banks share common systematic exposure to the Italian sovereign yield curve (10-year BTP-Bund spread), ECB supervisory guidance, and Italian domestic retail deposit betas. When global macro flows (or institutional algorithmic program trading) impact the Italian banking sector, capital initially flows into the most liquid proxy (`ISP.MI` or `EXV1.DE`).

Idiosyncratic order flow on Euronext Milan (such as a large institutional block execution, corporate buyback tranches, or localized dealer hedging) temporarily dislocates `UCG.MI` from its peer basket. If no fundamental corporate news event has occurred for UniCredit, this divergence represents a temporary inventory imbalance that mean-reverts as multi-asset statistical arbitrage desks rebalance intraday risk.

### 2.2 Mathematical Specification
1. **Dynamic Point-in-Time Beta Estimation:**  
   Using rolling 20-day historical 15-minute log returns (excluding overnight gaps):
   $$R_{\text{UCG}, t} = \alpha + \beta_1 R_{\text{ISP}, t} + \beta_2 R_{\text{BAMI}, t} + \epsilon_t$$
2. **Residual Z-Score Normalization:**  
   $$\text{Z-Score}(\epsilon_t) = \frac{\epsilon_t - \mu_{\epsilon, 20\text{d}}}{\sigma_{\epsilon, 20\text{d}}}$$
3. **Pre-Registered Entry Trigger:**  
   Enter Long UCG when:
   - $\text{Z-Score}(\epsilon_t) \le -2.0$ (UCG underperforming peer basket by $> 2.0$ standard deviations).
   - Same-clock relative volume confirms institutional participation: $\text{RVOL}_{\text{UCG}, t} \ge 1.25$.
   - News filter: Zero corporate announcements published by UCG in the preceding 120 minutes.
   - Time window: Continuous trading between 09:45 and 15:30 CET.
4. **Execution Policy & Latency:**  
   - Delayed entry at bar $t+1$ open (5-minute execution latency).
   - Near-touch limit order or arrival price simulation with 10 bps spread + 4 bps slippage.
   - Sizing: €12,500 position size (€50,000 capital base) to neutralize minimum broker ticket fees.
5. **Pre-Registered Exit Policy:**  
   - Dynamic mean-reversion exit: Exit at bar open when $\text{Z-Score}(\epsilon_t) \ge 0.0$ (residual converges to peer parity).
   - Time stop: Maximum holding duration of 90 minutes.
   - Hard risk stop: -1.0% stop-loss from entry price.
   - Mandatory EOD liquidation: 17:25 CET (preserving Italian Tobin Tax FTT exemption).

---

## 3. Precise Technical & Data Blockers

To execute Experiment 9 without violating empirical standards or fabricating intrabar quotes, the following precise blockers must be resolved:

### Blocker 1: Multi-Asset Intraday Synchronized Dataset
* **Current State:** The current repository cache (`server_data/real_market_cache.json`) contains 5-minute bars for `UCG.MI`, `EXV1.DE`, and `FTSE_MIB`. It does **not** contain synchronized intraday price series for peer banks `ISP.MI` (Intesa Sanpaolo), `BAMI.MI` (Banco BPM), or `BMPS.MI` (Banca Monte dei Paschi di Siena).
* **Required Resolution:** Ingest authorized 5-minute OHLCV history for `ISP.MI`, `BAMI.MI`, and `BMPS.MI` covering identical session dates and timestamps.
* **Prohibition:** The team must not synthesize peer quotes using random walk correlations or linear approximations.

### Blocker 2: Multi-Year Longitudinal Historical Span
* **Current State:** The available dataset is strictly limited to 60 trading sessions (August 10 – November 5, 2026).
* **Statistical Limitation:** In a 60-session sample, cointegrating residuals and rolling betas are unstable ($N$ too small to evaluate macroeconomic regime shifts).
* **Required Resolution:** Procure 5 years (2021–2026) of verified 1-minute/5-minute intraday bars from an institutional provider (FirstRate Data European Equities or LSEG Tick History).

### Blocker 3: Verified Point-in-Time News Tape
* **Current State:** The current news feature (`news_count_60m`) is populated with default zero values.
* **Required Resolution:** Integration of an authorized timestamped regulatory disclosure feed (e.g., Borsa Italiana SDIR or Reuters Company News) to ensure signals are suppressed during genuine idiosyncratic news releases.

---

## 4. Predeclared Falsification Protocol for Experiment 9

Before analyzing backtest PnL, Experiment 9 must undergo and pass the following predefined adversarial battery:

1. **Stationarity & Cointegration Test:**  
   Augmented Dickey-Fuller (ADF) test on the residual series $\epsilon_t$. If $p > 0.01$ (unit root present), the spread is non-stationary and the experiment is **abandoned**.
2. **Inverted Placebo Test:**  
   Run the exact rule buying when $\text{Z-Score}(\epsilon_t) \ge +2.0$ (buying when UCG leads peers). The placebo must yield a net loss ($< 0$). If the placebo is profitable, the mechanism lacks directional specificity and is **rejected**.
3. **Execution Latency Degradation Test:**  
   Compare performance under 5-minute vs 10-minute entry latency. If net PnL turns negative under 10-minute delay, the strategy is classified as high-latency sensitive.
4. **Friction Stress Test:**  
   Subject trades to 20 bps spread + 6 bps slippage (32 bps round-trip friction). Net return must remain positive ($> 0.0\%$).
5. **Calendar Subsample Stability:**  
   Split the multi-year history into odd vs even calendar years (e.g. 2021/2023/2025 vs 2022/2024). Net return must be positive in both subsamples.

---

## 5. Ready-to-Resume Checkpoint

The infrastructure for Experiment 9 has been pre-architected in the codebase:
- `src/engine/backtest.ts`: Non-interpolated 5-minute backtest engine (`runBacktest5m`) is active and verified.
- `src/engine/paperDaemon.ts`: Autonomous server daemon is ready to ingest multi-asset quotes via `/api/paper/daemon/ingest-tick`.
- `server_data/holdout_ledger.json`: Trial counter stands at 8 of 12, preserving 4 remaining authorized search trials.

**Resume Trigger:**  
Upon provisioning the multi-asset peer bank dataset (`ISP.MI`, `BAMI.MI`) into `server_data/peer_market_cache.json`, Experiment 9 can be executed immediately via `npx tsx scripts/run_experiment_9_peer_basket.ts` without modifying core engine logic or violating search budget constraints.
