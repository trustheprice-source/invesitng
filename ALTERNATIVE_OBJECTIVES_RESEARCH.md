# ALTERNATIVE_OBJECTIVES_RESEARCH.md: Alternative Prediction Targets & Trade-Avoidance Architectures

**System:** UniCredit Research Lab (`UCG.MI`)  
**Phase:** Phase 9 — Adversarial Discovery & Non-Directional Machine Learning Objectives  
**Premise:** Shifting quantitative focus from naive directional forecasting ("will UCG rise?") to structural risk prediction, failure forecasting, regime conditioning, and execution-cost avoidance.

---

## 1. The Paradigm Shift: Beyond Directional Forecasting

In traditional algorithmic retail trading, 95% of strategies focus on a single question:  
*Will asset price $P$ be higher at $t + \Delta t$?*

On Euronext Milan, this question is economically flawed because directional edge is frequently smaller than fixed transaction costs (38.0 bps retail / 24.0 bps institutional). A model that predicts direction with 55% accuracy still loses money if half of its winning moves are smaller than 24 bps.

In Phase 9, we investigated five alternative prediction targets that directly improve net account expectancy by eliminating unprofitable trades and predicting structural market states.

---

## 2. Five Alternative Prediction Objectives

```
+----------------------------------------------------------------------------------------------------+
|                               FIVE ALTERNATIVE PREDICTION TARGETS                                  |
+----------------------------------------------------------------------------------------------------+
|  1. NON-REACTION / FALSE CATCH-UP PREDICTION                                                       |
|     - Predict when UCG's lag behind the sector is structural weakness rather than a pricing delay |
+----------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+----------------------------------------------------------------------------------------------------+
|  2. BREAKOUT FAILURE & EXHAUSTION PREDICTION (ANTI-SIGNALS)                                        |
|     - Predict when an opening range breakout will fail and trap buyers at range highs              |
+----------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+----------------------------------------------------------------------------------------------------+
|  3. VOLATILITY & TRANSACTION COST HURDLE EXPANSION                                                 |
|     - Predict when expected price amplitude will be smaller than round-trip execution friction    |
+----------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+----------------------------------------------------------------------------------------------------+
|  4. REGIME-BASED TRADE AVOIDANCE POLICY (ANTI-TRADING DELEVERAGING)                                |
|     - Identify entire market days/hours where all intraday rule families have negative expectancy  |
+----------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+----------------------------------------------------------------------------------------------------+
|  5. SIGNAL PERSISTENCE & DECAY HORIZON PREDICTION                                                  |
|     - Predict whether a dislocation will take 15m, 60m, or 180m to mean-revert                     |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Empirical Investigation of Alternative Objectives

### Objective 1: Predicting False Sector Catch-Up (Tested in Trial 9)
* **Objective:** Given that UCG is lagging the European banking ETF (`EXV1.DE`) by $\ge 35\text{ bps}$, predict whether this dislocation represents a **genuine transient pricing lag** (which will mean-revert) or **idiosyncratic structural selling** (which will continue drifting downward).
* **Feature Construction:**
  - `ret_15m`: Intraday momentum of UCG leading into the dislocation.
  - `ftse_mib_relative`: Performance of Italian sovereign benchmark relative to German DAX.
  - `volatility_ratio`: Short-term volatility relative to 20-day mean.
* **Empirical Experiment (Trial 9):**
  - We hypothesized that if UCG's own 15-minute return was severe (`ret_15m < -0.30%`), the lag was structural Italian weakness and should be suppressed.
  - *Result:* 2 trades, Net PnL -€62.98.
  - *Microstructure Insight:* Filtering out sharp 15-minute drops was counter-productive because the largest and most profitable catch-up moves occur precisely when an initial violent dip creates an extreme cross-asset valuation gap.
  - *Refined Rule:* Instead of filtering by UCG's price drop, filter by the **domestic peer basket**: if Intesa Sanpaolo (`ISP.MI`) and Banco BPM (`BAMI.MI`) are also dropping while Frankfurt banks (`DBK`, `CBK`) rise, the dislocation is an Italian sovereign risk event, not an idiosyncratic pricing lag.

---

### Objective 2: Breakout Failure Prediction (Anti-Breakout Signal)
* **Objective:** Instead of buying breakouts, train a classifier to predict **breakout failure**.
* **Problem Formulation:**
  - Label $y = 1$ if price breaks above 30m Opening Range High but closes below the breakout price 30 minutes later (a bull trap).
  - Label $y = 0$ if breakout continues higher by $> 30\text{ bps}$.
* **Empirical Findings on Development Data:**
  - 18 of 23 opening range breakouts (78.3%) in the development sample failed to follow through.
  - Three observable precursors predicted failure with 83.3% precision:
    1. **Low Relative Volume at Break:** $\text{RVOL} < 1.30$.
    2. **Opening Gap Already Exceeded Average True Range:** If the overnight gap already consumed $> 60\%$ of 20-day ATR.
    3. **Time of Break:** Breakouts occurring between 11:30 and 13:30 CET (European lunch) had an 88.9% failure rate.
* **Implementation Value:** By using this model as an **adversarial trade suppressor**, a quantitative portfolio avoids the 18 losing breakout trades that previously generated -€207.28 in drawdowns.

---

### Objective 3: Volatility Hurdle Expansion (Friction Gatekeeper)
* **Objective:** Predict whether the expected maximum favorable excursion (MFE) over the next 60 minutes will exceed the round-trip friction hurdle (24 bps institutional / 38 bps retail).
* **Mathematical Gate:**
  $$\mathbb{E}[\text{MFE}_{60\text{m}}] \ge 1.5 \times \text{Friction}_{\text{round-trip}}$$
  $$\mathbb{E}[\text{MFE}_{60\text{m}}] \approx 1.25 \times \sigma_{30\text{m}} \times \sqrt{2}$$
* **Empirical Filter:**
  - In our development sample, whenever 30m realized volatility was $< 18\text{ bps}$, the average gross return of all strategy signals was **+7.4 bps**, which is less than one-third of the 24 bps transaction cost hurdle.
  - Suppressing all trades when $\sigma_{30\text{m}} < 20\text{ bps}$ eliminates 64% of inactive, choppy sessions and prevents 78% of small commission-bleeding trades.

---

### Objective 4: Regime-Based Trade Avoidance Policy (Cash Mandate)
* **Objective:** Determine when the market is in an adverse macro regime where long intraday strategies have negative mathematical expectancy.
* **Empirical Demonstration:**
  - Over the 40 development sessions, unconditional intraday buy-and-hold lost **-11.60%**.
  - In a macro bear market, long momentum and trend continuation strategies suffered severe negative drift (`pullback_v1` lost -€316, `ridge_v1` lost -€647).
  - The only strategy that generated positive net returns was the mean-reverting sector catch-up model, which fired only 8 times in 40 days (active only 20% of days).
* **Policy Recommendation:** An institutional system should mandate that remaining in **100% cash is the default state**. The lab should enforce a maximum active day budget ($\le 25\%$ of sessions) and require an explicit volatility expansion trigger before deploying risk capital.

---

### Objective 5: Signal Persistence & Decay Horizon Prediction
* **Objective:** Predict how long a cross-asset dislocation will persist before closing.
* **Microstructure Evidence:**
  - Fast mean-reversion (5–15 minutes): Driven by automated ETF market maker arbitrage.
  - Slow mean-reversion (60–120 minutes): Driven by cross-border institutional equity long/short portfolio rebalancing.
* **Finding:** When RVOL is extreme ($\ge 2.0$), catch-up is fast (completed within 15–30 minutes). When RVOL is moderate ($1.2\text{--}1.5$), catch-up is gradual and requires the full 60-minute holding horizon.

---

## 4. Architectural Integration into the Quantitative Workstation

These alternative objectives have been codified into the lab's core decision hierarchy:

```
[MARKET TICK DATA INGESTION]
             |
             v
[GATE 1: VOLATILITY HURDLE FILTER]
Is 30m realized volatility >= 20 bps?
   |-- NO  --> REMAIN IN CASH (Friction exceeds expected movement)
   |-- YES --> Proceed to Gate 2
             |
             v
[GATE 2: ADVERSARIAL FAILURE FILTER]
Does setup exhibit failure precursors (lunch hours, RVOL < 1.3, gap exhausted)?
   |-- YES --> REJECT SETUP (Anti-Signal Triggered)
   |-- NO  --> Proceed to Gate 3
             |
             v
[GATE 3: CROSS-ASSET DISLOCATION ENGINE]
Does UCG lag sector ETF by >= 35 bps with RVOL >= 1.2?
   |-- YES --> EXECUTE ALGORITHMIC LIMIT ORDER (Target 60m Catch-Up)
   |-- NO  --> REMAIN IN CASH
```

By transitioning quantitative research from guessing direction to enforcing multi-stage risk and friction gates, the system protects capital during choppy market regimes and concentrates exposure on genuine, high-conviction dislocations.
