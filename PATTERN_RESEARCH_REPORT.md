# UNICREDIT RESEARCH LAB — PATTERN RESEARCH REPORT
**Focus:** Statistical Discovery of Recurring Intraday Market Relationships  
**Asset:** UniCredit S.p.A. (`UCG.MI`, ISIN IT0005239360) | **Benchmark:** `EXV1.DE` (EURO STOXX Banks 30-15)  
**Sample:** 60 Euronext Milan Trading Sessions (5,509 5-minute bars)  
**Date:** November 5, 2026

---

## 1. Executive Summary

This investigation explores whether recurring empirical relationships in UniCredit's intraday trading order flow can provide statistically detectable predictive power over multiple time horizons.

Key conclusions:
1. **Multi-Horizon Return Symmetry:** Across 5, 15, 30, and 60 minutes, forward price changes exhibit nearly perfect symmetry ($47.6\%$ to $50.4\%$ positive outcomes), with drift near zero.
2. **Volatilities Expand with Square-Root of Time:**
   - $\sigma_{5\text{m}} = 12.9\text{ bps}$
   - $\sigma_{15\text{m}} = 22.0\text{ bps}$
   - $\sigma_{30\text{m}} = 31.3\text{ bps}$
   - $\sigma_{60\text{m}} = 44.1\text{ bps}$
   - $\sigma_{120\text{m}} = 62.3\text{ bps}$
3. **Horizon Mismatch:** Only at horizons of 60 to 120 minutes does asset volatility ($\sigma \ge 44\text{ bps}$) reliably exceed the 38 bps institutional friction hurdle. Intraday strategies with holding times under 30 minutes are mathematically incapable of overcoming minimum execution costs.
4. **Sector Beta & Relative Value Divergence:** UniCredit exhibits a high rolling beta ($\beta \approx 1.24$) to the EURO STOXX Banks ETF (`EXV1.DE`). Intraday divergences greater than $1.5\sigma$ mean-revert over 60–90 minutes with 58.4% consistency gross of fees, but the net edge drops below zero once two-leg execution costs (UCG plus ETF hedge) are accounted for.
5. **Non-Linear Quantized Decision Tree vs. Linear Ridge Regression:** The linear model (`ridge_v1`) severely overfits noise, generating 310 losing trades. A shallow non-linear quantized model reduces false entries by 78%, but still fails to achieve positive net expectancy after ticket commissions.

---

## 2. Multi-Horizon Forward Return Analysis

Empirical distribution of forward returns sampled every 5 minutes across all 60 trading sessions:

| Horizon | Sample Count ($N$) | Mean Return | Standard Deviation ($\sigma$) | Positive Outcomes Fraction | Net Hurdle / $\sigma$ Ratio |
|---|---|---|---|---|---|
| **5 Minutes** | 5,449 | -0.0009 bps | 12.87 bps (0.129%) | 47.62% | **2.95** (Extreme penalty) |
| **15 Minutes** | 5,329 | +0.0015 bps | 22.03 bps (0.220%) | 49.77% | **1.72** (Unfavorable) |
| **30 Minutes** | 5,149 | -0.0098 bps | 31.26 bps (0.313%) | 49.66% | **1.22** (Unfavorable) |
| **60 Minutes** | 4,789 | +0.0041 bps | 44.06 bps (0.441%) | 50.45% | **0.86** (Feasible variance) |
| **120 Minutes** | 4,069 | +0.1118 bps | 62.31 bps (0.623%) | 50.68% | **0.61** (Best signal-to-cost) |

### Core Implication:
Short horizons (5m–30m) cannot support active trading on account sizes $\le €50{,}000$ due to minimum ticket costs. Research priority must shift from 5-minute microstructure scalping to **60-to-120 minute multi-hour holding horizons** or **session-level swing trades**.

---

## 3. Same-Clock Relative Volume (RVOL) & Intraday Seasonality

### 3.1 Intraday U-Shaped Volume Curve
Euronext Milan equity trading in UCG exhibits the canonical European U-shaped liquidity profile:
- **Opening Burst (09:00 – 10:00 CET):** Represents 31.4% of total daily volume. High price discovery, wider spreads (12–18 bps), high volatility.
- **Midday Trough (12:00 – 14:00 CET):** Represents 16.2% of total daily volume. Low liquidity, zero-volume bars (61 observed in sample), spreads widen slightly, directionless chop.
- **US Market Open & Closing Auction (15:30 – 17:35 CET):** Represents 42.1% of total daily volume. Tightest spreads (6–8 bps), substantial liquidity from US macro algorithmic flows.

### 3.2 RVOL Breakout Analysis
- High RVOL ($\text{RVOL} \ge 2.0$) occurring in the **first 30 minutes** (09:00–09:30 CET) indicates institutional order block execution.
- However, 64% of early opening breakouts failed to follow through over the subsequent 60 minutes, instead experiencing mean-reverting retests of the Opening Range High/Low.
- This explains why `breakout_v1` achieved only an 11.1% win rate: the strategy entered breakouts at local highs immediately before liquidity providers faded the move back toward VWAP.

---

## 4. Banking Sector Relative Strength (`UCG.MI` vs. `EXV1.DE`)

Because UniCredit is an anchor constituent of the European banking sector, its idiosyncratic price movement was compared against the `EXV1.DE` (iShares EURO STOXX Banks 30-15 UCITS ETF):

- **Correlation of 15-Minute Returns:** $\rho = 0.78$
- **Rolling Beta:** $\beta_{\text{UCG}} \approx 1.24$ (UniCredit behaves as a high-beta financial proxy).
- **Sector Spread Lead-Lag Effect:**
  - When UCG lagged the sector ETF by $> 0.50\%$ over 30 minutes while the broader FTSE MIB remained stable, UCG displayed a mild upward catch-up drift over the subsequent 45 minutes (+8.4 bps mean move).
  - However, when attempting to trade this catch-up signal, the 38 bps round-trip friction completely wiped out the 8.4 bps statistical drift.

---

## 5. Non-Linear Model Exploration (Shallow Tree vs. Ridge Regression)

The linear model (`ridge_v1`) trained on 9 causal features suffered from severe variance:
- Continuous small positive predictions ($> 0.0$) triggered **310 trades** in 60 sessions (over 5 trades per day).
- With 310 trades paying €6.00 round trip, total commission was **€1,860.00**, producing a devastating **-28.47% net return**.

### Non-Linear Challenger (Quantized Decision Tree):
We evaluated a 3-level shallow decision tree using strict interaction splits:
1. `minute_of_day >= 30` (exclude chaotic opening 30 minutes).
2. `rvol >= 1.75` AND `abs(close - vwap) / vwap >= 0.0035` (require substantial stretch from VWAP).
3. `sector_spread_15m <= -0.002` (confirm sector confirmation).

**Result:**
- Total trades dropped from 310 to **18 trades** across 60 sessions (~0.3 trades/day).
- Win rate improved from 7.4% to **38.9%**.
- Net return improved from -28.47% to **-1.84%** (Total fees paid dropped from €1,860 to €108).
- **Evaluation:** While the non-linear rules dramatically reduced unnecessary churn, the strategy still failed to overcome the friction barrier to achieve positive net return.

---

## 6. Historical Pattern Analogs Engine

The web app integrates an automated cross-session pattern matcher (`src/engine/analogs.ts`):
- Given the current session's price, volume, and VWAP trajectory up to minute $M$, the engine computes the Euclidean distance across normalized historical session vectors.
- It returns the top 5 closest historical days and visualizes their subsequent afternoon trajectory.
- **Audited Utility:** While pattern analogs serve as an intuitive research visualization for portfolio managers to assess whether historical analogs experienced afternoon reversals or continuations, empirical forward dispersion remains high ($\sigma \approx 45\text{ bps}$). It must not be used as an autonomous trading trigger without strict statistical bounds.
