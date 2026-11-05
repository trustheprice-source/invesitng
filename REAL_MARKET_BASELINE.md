# UNICREDIT RESEARCH LAB — REAL MARKET BASELINE REPORT
**Underlying Asset:** UniCredit S.p.A. (`UCG.MI`, ISIN IT0005239360)  
**Exchange:** Euronext Milan (MTAA)  
**Sample Period:** August 14, 2026 – November 5, 2026 (60 Trading Sessions, 84 Calendar Days)  
**Starting Capital:** €10,000.00 | **Execution Fee Schedule:** €3.00 minimum ticket, 5 bps commission, 10 bps spread, 2 bps/side slippage  
**Primary Finding:** `NO_QUALIFYING_STRATEGY` (High-frequency intraday trading edge is eliminated by institutional transaction friction)

---

## 1. Executive Summary

Empirical backtesting of the UniCredit Research Lab core strategies on 60 consecutive Euronext Milan trading sessions demonstrates that **no high-turnover intraday strategy produces statistically defensible positive net returns after realistic transaction costs**.

While gross price movements exhibit small short-term momentum and mean-reversion tendencies, the combined friction of the **€3.00 minimum ticket commission**, **10 basis-point bid-ask spread**, and **2 basis-point per-side slippage** creates a mandatory hurdle of **~38 basis points per round-trip trade**. Because UniCredit's median 30-minute volatility is approximately 31 basis points, the friction cost exceeds the natural expected move, causing high-frequency strategies to bleed capital monotonically in broker fees.

In contrast, a **Fixed Intraday Time Rule** (buying at 09:30 CET and exiting at 17:00 CET daily) avoided the catastrophic 9.33% drop suffered by Buy-and-Hold, finishing flat-to-positive (+0.81% net) by trading only once per day and bypassing overnight exposure.

---

## 2. Benchmark Comparisons

To establish rigorous scientific baseline context, the strategies are evaluated against 4 distinct benchmarks over the identical 60-session timeline:

| Benchmark | Net Return | Annualized Return | Max Drawdown | Total Trades | Total Fees Paid | Market Exposure |
|---|---|---|---|---|---|---|
| **1. Cash Holding** | **0.00%** | 0.00% | **0.00%** | 0 | €0.00 | 0.0% (Risk-free reference) |
| **2. Buy-and-Hold UCG.MI** | **-9.33%** | -29.24% | **11.52%** | 1 | €6.00 | 100.0% (€85.12 to €77.18) |
| **3. Fixed Intraday Time Rule** | **+0.81%** | +3.45% | **3.89%** | 60 | €360.00 | 88.2% (09:30 to 17:00 CET daily) |
| **4. Baseline Unaugmented Model** | **0.00%** | 0.00% | **0.00%** | 0 | €0.00 | Filtered out by risk gates |

### Benchmark Analysis:
- **Buy-and-Hold (-9.33%):** UniCredit trended downward from €85.12 in mid-August to €77.18 in early November 2026 amidst broader European banking sector consolidation and ECB interest rate cut expectations.
- **Fixed Intraday Time Rule (+0.81%):** By systematically closing positions before the 17:30 CET auction, this benchmark avoided overnight negative earnings gaps and European sovereign debt repricing, proving that **avoiding overnight risk was more valuable than intraday directional timing**.

---

## 3. Quantitative Candidate Performance Table

Full backtest execution results on 60 trading sessions (5,509 5-minute bars and 27,545 1-minute proxy bars) using €10,000 capital and 25% allocation:

| Candidate ID | Strategy Family | Trades Count | Win Rate | Net Return | Annualized Return | Max Drawdown | Profit Factor | Total Fees Paid | Active Day Fraction | 95% Bootstrap CI (Daily Return) | Evidence Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `pullback_v1` | Trend Pullback | 172 | 8.1% | **-14.95%** | -49.35% | 14.95% | 0.06 | €1,032.00 | 85.0% | [-0.36%, -0.18%] | `RESEARCH_ONLY` |
| `breakout_v1` | Opening Breakout | 63 | 11.1% | **-5.35%** | -20.61% | 5.35% | 0.05 | €378.00 | 50.0% | [-0.13%, -0.06%] | `RESEARCH_ONLY` |
| `mean_reversion_v1` | Mean Reversion | 35 | 17.1% | **-3.70%** | -14.66% | 3.70% | 0.02 | €210.00 | 28.3% | [-0.12%, -0.02%] | `RESEARCH_ONLY` |
| `ridge_v1` | Ridge Regression | 310 | 7.4% | **-28.47%** | -75.52% | 28.47% | 0.02 | €1,860.00 | 91.7% | [-0.66%, -0.41%] | `RESEARCH_ONLY` |

---

## 4. Market Microstructure & Friction Breakdown

The central finding of this baseline audit is that **the fee schedule dominates the statistical outcome of intraday trading**.

### 4.1 The Fixed Ticket Penalty
- Capital: €10,000. Allocation fraction: 25% $\rightarrow$ Notional per trade: **€2,500.00**.
- Minimum ticket fee per side: **€3.00**.
- Round-trip ticket fee: $2 \times €3.00 = \mathbf{€6.00}$.
- Percentage drag from ticket fee alone:
  $$\frac{€6.00}{€2{,}500.00} = \mathbf{0.240\% \quad (24.0 \text{ bps})}$$

### 4.2 Spread & Slippage
- Euronext Milan average bid-ask spread on UCG during continuous trading: **10 bps**.
- Half spread crossed on entry + half spread crossed on exit: **10 bps**.
- Slippage at 2 bps per side: **4 bps**.
- Total spread and execution penalty: **14.0 bps**.

### 4.3 Total Round-Trip Friction Hurdle
$$\text{Total Hurdle} = 24.0 \text{ bps (fees)} + 10.0 \text{ bps (spread)} + 4.0 \text{ bps (slippage)} = \mathbf{38.0 \text{ bps} \quad (0.38\%)}$$

### 4.4 Volatility Horizon Comparison
- UniCredit 30-minute standard deviation of return: **~31.2 bps (0.312%)**.
- Ratio of Friction to 30-minute standard deviation:
  $$\frac{38.0 \text{ bps}}{31.2 \text{ bps}} = \mathbf{1.22 \times \sigma}$$
- **Statistical Implication:** For an intraday trade with a 30-minute holding horizon to break even net of costs, the price move must exceed **1.22 standard deviations** in the favorable direction. Because directional price moves on 5-minute bars are roughly symmetric, the probability of exceeding $+1.22\sigma$ is under 12%, explaining why observed win rates hover between 7.4% and 17.1%.

---

## 5. Italian Financial Transaction Tax (Tobin Tax) Validation

- Under Italian Law 228/2012 (Art. 1, c. 491–499), shares in Italian companies with market cap $> €500\text{M}$ are subject to a **0.10% (10 bps)** transaction tax on the net positive end-of-day balance.
- **Intraday Exemption:** All 4 tested strategies systematically liquidate open positions prior to the session close (17:30 CET). The net balance at market close is strictly zero shares.
- **Audit Confirmation:** No Italian FTT tax was incurred on these intraday trades. However, if an execution error failed to close a €2,500 position before the closing auction, an additional **€2.50 tax liability** would be assessed, further worsening net performance.

---

## 6. Scientific Status Determination

- **Formal Finding:** `NO_QUALIFYING_STRATEGY`
- **Integrity Compliance:** In accordance with quantitative research ethics, the lab does **not** adjust parameters ex-post or lower friction assumptions to fabricate positive returns.
- **Holdout Protection:** The holdout partition remains pristine and unviolated. None of these candidates qualify to advance to the one-shot Holdout Gate or Paper Terminal.
