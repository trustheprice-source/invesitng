# UNICREDIT RESEARCH LAB — STATISTICAL VALIDATION REPORT
**Validation Methodology:** Chronological Walk-Forward, Circular Block Bootstrap & Multi-Scenario Friction Matrix  
**Dataset:** 60 Euronext Milan Sessions (`UCG.MI`)  
**Holdout Partition Status:** UNTOUCHED & FROZEN (30 Sessions Reserved)  
**Primary Formal Finding:** `NO_QUALIFYING_STRATEGY` — `INSUFFICIENT_EVIDENCE`

---

## 1. Executive Summary & Research Integrity Mandate

In quantitative research, the temptation to tweak thresholds, reduce transaction cost assumptions, or cherry-pick timeframes to produce an artificial "profitable" backtest is the primary cause of catastrophic live losses. 

In strict adherence to the project instructions:
> **"Do not manufacture successful strategies. A finding that no statistically credible advantage exists is acceptable."**

We formally report that **no candidate strategy among the four investigated models meets the pre-declared statistical acceptance criteria** on the verified 60-session Euronext Milan market dataset. All four strategies fail the required lower 95% bootstrap confidence interval bound, and two violate the maximum drawdown limit.

Consequently, **the one-shot Holdout Gate remains locked**, preserving the holdout dataset for future models that possess a genuine, structural advantage.

---

## 2. Pre-Declared Acceptance Gate Criteria

Before inspecting results, the lab enforced the following non-negotiable institutional hurdles:

| Gate Criterion | Target Threshold | Rationale |
|---|---|---|
| **Minimum Evaluation Sessions** | $\ge 60$ sessions (Dev) / $\ge 30$ sessions (Holdout) | Ensures statistical power across varying macro regimes |
| **Minimum Sample Trades** | $\ge 30$ trades (Dev) / $\ge 15$ trades (Holdout) | Prevents small-sample luck and outlier distortion |
| **Active Week Fraction** | $\ge 60.0\%$ of calendar weeks | Disqualifies sporadic or cluster-dependent models |
| **Maximum Drawdown Bound** | $\le 10.0\%$ equity decline | Preserves fund capital under adverse market conditions |
| **Bootstrap 95% CI Lower Bound** | $> 0.000\%$ mean daily return | Proves edge is distinguishable from zero at $\alpha = 0.05$ |
| **Friction Sensitivity Robustness** | Must remain profitable across all 8 stress scenarios | Verifies survival under severe market degradation |

---

## 3. Quantitative Evaluation Against Acceptance Gates

| Candidate ID | Strategy Family | Trades Count | Active Week % | Max Drawdown | Bootstrap 95% CI (Daily Ret) | Friction Sensitivity Passed? | Gate Outcome |
|---|---|---|---|---|---|---|---|
| `pullback_v1` | Trend Pullback | 172 ($\ge 30$ ✓) | 91.7% ($\ge 60\%$ ✓) | **14.95%** ($> 10\%$ ✗) | **[-0.36%, -0.18%]** ($\le 0$ ✗) | 0 / 8 Scenarios Passed | **FAILED** |
| `breakout_v1` | Opening Breakout | 63 ($\ge 30$ ✓) | 75.0% ($\ge 60\%$ ✓) | 5.35% ($\le 10\%$ ✓) | **[-0.13%, -0.06%]** ($\le 0$ ✗) | 0 / 8 Scenarios Passed | **FAILED** |
| `mean_reversion_v1` | Mean Reversion | 35 ($\ge 30$ ✓) | **41.7%** ($< 60\%$ ✗) | 3.70% ($\le 10\%$ ✓) | **[-0.12%, -0.02%]** ($\le 0$ ✗) | 0 / 8 Scenarios Passed | **FAILED** |
| `ridge_v1` | Ridge Regression | 310 ($\ge 30$ ✓) | 100.0% ($\ge 60\%$ ✓) | **28.47%** ($> 10\%$ ✗) | **[-0.66%, -0.41%]** ($\le 0$ ✗) | 0 / 8 Scenarios Passed | **FAILED** |

### Detailed Failure Analysis:
1. **Lower Bootstrap Bound:** Every single strategy has a strictly negative upper and lower bootstrap confidence interval. At the 95% confidence level, the expected mean daily return is reliably negative.
2. **Drawdown Violations:** Both `pullback_v1` (-14.95%) and `ridge_v1` (-28.47%) breached the 10.0% maximum drawdown ceiling due to excessive trading frequency during choppy sideways sessions.
3. **Sparse Frequency:** `mean_reversion_v1` traded in only 41.7% of calendar weeks, failing the minimum 60% frequency requirement.

---

## 4. Multi-Scenario Friction & Latency Stress Matrix

To decouple alpha generation from execution friction, we subjected each strategy to an 8-scenario stress grid:

### Performance Matrix: `mean_reversion_v1` (Lowest Drawdown Candidate)

| Scenario Name | Spread (bps) | Slippage (bps) | Latency (min) | Min Ticket Fee | Net Return | Max Drawdown | Win Rate | Trades |
|---|---|---|---|---|---|---|---|---|
| **Theoretical Zero-Friction Ceiling** | 0.0 | 0.0 | 0 | €0.00 | **+2.14%** | 1.82% | 54.3% | 35 |
| **Tight Spread Scenario** | 5.0 | 1.0 | 1 | €3.00 | **-1.85%** | 2.10% | 22.9% | 35 |
| **Baseline Reality** | 10.0 | 2.0 | 1 | €3.00 | **-3.70%** | 3.70% | 17.1% | 35 |
| **Wider Spread Scenario** | 15.0 | 3.0 | 1 | €3.00 | **-5.42%** | 5.42% | 14.3% | 35 |
| **Heavy Slippage Scenario** | 10.0 | 5.0 | 1 | €3.00 | **-5.18%** | 5.18% | 14.3% | 35 |
| **2-Minute Execution Delay** | 10.0 | 2.0 | 2 | €3.00 | **-4.12%** | 4.12% | 14.3% | 35 |
| **3-Minute Execution Delay** | 10.0 | 2.0 | 3 | €3.00 | **-4.65%** | 4.65% | 11.4% | 35 |
| **High Ticket Fee (€5.00)** | 10.0 | 2.0 | 1 | €5.00 | **-5.10%** | 5.10% | 17.1% | 35 |

### Quantitative Insight:
Under **Theoretical Zero Friction**, `mean_reversion_v1` generates **+2.14% net return** with a 54.3% win rate. This proves that the underlying signal contains mild directional information. However, the moment realistic broker fees and exchange spreads are introduced, net returns instantly drop below zero. **The strategy is not economically viable under institutional retail broker execution schedules.**

---

## 5. Holdout Partition Integrity

The research suite enforces a server-side immutable holdout ledger (`server_data/holdout_ledger.json`):
- **Partition:** 30 sessions reserved strictly for one-shot final verification.
- **Trial Counter:** 4 exploratory trials recorded on development data; **0 evaluations on the holdout partition**.
- **State:** `HOLD_GATE_ACTIVE: LOCKED`.
- **Integrity Guarantee:** Because none of the candidates satisfied the development criteria, no candidate was submitted to the holdout gate. This protects the research team from "p-hacking" the test set.

---

## 6. Official Finding

- **Verdict:** `NO_QUALIFYING_STRATEGY`
- **Classification:** `RESEARCH_ONLY`
- **Live Trading Eligibility:** Permanently Disabled (`eligible_for_live: false`).
