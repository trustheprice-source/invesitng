# UNCONVENTIONAL_HYPOTHESES.md: Quantitative Hypothesis Cards & Selection Architecture

**System:** UniCredit Research Lab (`UCG.MI`)  
**Phase:** Unconventional Discovery & Adversarial Testing  
**Asset:** UniCredit S.p.A. (`UCG.MI`, MTAA Euronext Milan, ISIN: IT0005239360)  
**Governance:** Predeclared Hypotheses, Fixed Search Budget, Causal Information Boundary  

---

## 1. Research Philosophy: Mechanism-First Quantitative Discovery

Rather than fitting mathematical indicators (RSI, Bollinger Bands, Moving Average crossovers) to past price paths, this research protocol begins with economic mechanisms:
*What observable behavior, structural constraint, timing mismatch, information-processing latency, or temporary supply-demand imbalance could create an intraday pricing opportunity—and why might it persist after transaction costs?*

Below are 20 structured hypothesis cards spanning materially different mechanisms, evaluated under the required 8-field taxonomy.

---

## 2. The 20 Unconventional Hypothesis Cards

### Card 01 — Asymmetric Sector Lead-Lag Catch-Up
* **Direction:** A (Missing reactions and asymmetric reactions) & F (Dynamic relationship changes)
* **Mechanism:** The European banking sector ETF (`EXV1.DE`) or broad banking basket represents liquid institutional aggregate flow. When macro news or sector flows lift the sector basket, institutional algorithms execute basket trades across member equities. Due to local order-book depth and broker routing latency on Euronext Milan, single-stock Italian bank orders can lag the synthetic sector index by 5–15 minutes.
* **Observable precursor:** UCG 15-minute return lags `EXV1.DE` 15-minute return by $\ge 35\text{ bps}$ (`sector_spread_15m <= -0.0035`) during continuous trading (10:00–15:30 CET) while UCG same-clock volume remains elevated ($\text{RVOL} \ge 1.2$).
* **Proposed action:** Enter long on the next 5-minute bar open (honest 5m execution). Hold for 60 minutes or exit if sector spread reverts to $\ge 0$. Mandatory exit at 17:25 CET.
* **Why it might persist:** Cross-border liquidity fragmentation between XETRA (where `EXV1.DE` trades) and Euronext Milan (where `UCG.MI` trades), combined with retail tick size constraints, prevents instant instantaneous latency arbitrage for medium-sized market participants.
* **Strongest alternative explanation:** UCG is not "lagging" the sector; rather, an unobserved idiosyncratic negative event (e.g., Italian BTP sovereign yield widening, bank tax rumors, regulatory litigation) justifies its relative underperformance.
* **Falsification test:** If UCG fails to catch up over 60 minutes and instead continues underperforming the sector in $> 50\%$ of episodes, reject the hypothesis. If an inverted placebo (buying when UCG leads) shows identical or superior returns, reject the catch-up explanation.
* **Data requirements:** Synchronized 5-minute OHLCV bars for `UCG.MI` and `EXV1.DE` with verified UTC/CET exchange timestamps.
* **Feasibility:** Fully feasible. Verified in current dataset using Yahoo Finance synchronized European market feeds.

---

### Card 02 — Asymmetric Downside Panic Transmission
* **Direction:** A (Asymmetric reactions)
* **Mechanism:** Institutional risk managers apply asymmetric gross exposure reduction: when European bank credit risk spikes, Italian banking shares (with higher sovereign beta) are dumped aggressively by automated delta-one and ETF arbitrage desks. Downside sector transmission is sharper and faster than upside recovery.
* **Observable precursor:** Sector ETF drops $> 50\text{ bps}$ over 15 minutes while UCG has only dropped $< 20\text{ bps}$.
* **Proposed action:** Do NOT buy the dip; enter cash or exit long positions immediately. For long-or-cash mandates, stay in cash until downside momentum ceases ($\text{RVOL}$ drops $< 1.0$).
* **Why it might persist:** Asymmetric risk aversion, mandated stop-losses, and portfolio insurance rules create sudden liquidity vacuums on the bid side of peripheral European banks.
* **Strongest alternative explanation:** The ETF drop is noisy and transient, resulting in whipsaws.
* **Falsification test:** If lagging UCG shares during sector drops regularly bounce back rather than continuing downward, reject the asymmetric panic transmission hypothesis.
* **Data requirements:** 5-minute OHLCV of UCG and sector ETF with rolling 15m return deltas.
* **Feasibility:** Fully feasible using existing market cache.

---

### Card 03 — Volume Absorption & Price Displacement Inefficiency
* **Direction:** B (How efficiently volume moves the price)
* **Mechanism:** Institutional iceberg orders absorb aggressive market sell orders. When heavy trading volume occurs ($\text{RVOL} \ge 1.5$) but price displacement is minimal ($|\Delta P_{15\text{m}}| \le 15\text{ bps}$) near support or below intraday VWAP, passive limit buyers are absorbing flow without conceding price. Once aggressive selling dries up, the price rebounds.
* **Observable precursor:** Same-clock volume surge ($\text{RVOL} \ge 1.5$), price below VWAP ($[P - \text{VWAP}]/\text{VWAP} \le -0.3\%$), and price range over 15 minutes compressed to $< 0.15\%$.
* **Proposed action:** Buy long at next bar open, target 60-minute mean reversion to VWAP, stop-loss 1.0%, EOD exit.
* **Why it might persist:** Passive execution algorithms (TWAP/VWAP icebergs) are intentionally disguised to prevent front-running, creating temporary statistical absorption footprints.
* **Strongest alternative explanation:** What appears to be "absorption" is actually relentless aggressive selling meeting fragile retail bids before an imminent breakdown.
* **Falsification test:** If net return after costs is negative across development sessions, or if the majority of trades exit on stop-loss/breakdown, reject the hypothesis.
* **Data requirements:** Real 5-minute bar volume and high/low ranges; Level 2 order book data for definitive depth.
* **Feasibility:** Testable on 5m bar approximations; conclusive testing requires tick-level L2 quotes.

---

### Card 04 — Low-Volume Drift Fragility (Liquidity Vacuum Reversal)
* **Direction:** B (Volume efficiency)
* **Mechanism:** Midday price advances occurring on anemic volume ($\text{RVOL} < 0.7$) are fragile because they reflect a temporary withdrawal of resting ask liquidity rather than genuine institutional buying conviction. When liquidity returns, price snaps back to volume-weighted fair value.
* **Observable precursor:** Minute 150 to 300 (11:30–14:00 CET), price drifts $> +0.4\%$ above VWAP while RVOL remains $< 0.70$.
* **Proposed action:** Stay in cash; decline all breakout signals during this window; or if long, take profit at $+0.4\%$.
* **Why it might persist:** European institutional lunch hours (12:00–14:00 CET) cause order book thinning across continental exchanges.
* **Strongest alternative explanation:** Low-volume drift reflects quiet continuous accumulation that expands when US markets open.
* **Falsification test:** If low-volume midday advances continue gaining momentum after 14:00 CET rather than mean-reverting to VWAP, reject the hypothesis.
* **Data requirements:** 5-minute intraday bars with time-of-day flags and RVOL calculations.
* **Feasibility:** Fully feasible on current historical data.

---

### Card 05 — Sequential State Transition: Compression to Range Escape
* **Direction:** C (The sequence of events, rather than a static snapshot)
* **Mechanism:** Markets cycle through distinct physical regimes: high volatility expansion $\rightarrow$ volume climax $\rightarrow$ volatility compression (consolidation) $\rightarrow$ directional escape. A breakout is only reliable if it was preceded by an observable compression phase where inventory was rebalanced.
* **Observable precursor:** Step 1: RVOL $> 1.3$ with wide candle; Step 2: subsequent 3 bars have high-low range $< 50\%$ of 30m average; Step 3: bar closes above compression high with RVOL expanding.
* **Proposed action:** Buy long upon completion of Step 3; hold 60 minutes; stop-loss below the compression low.
* **Why it might persist:** Sequential order flow dynamics require inventory clearing before sustained trend moves can occur without immediate dealer pushback.
* **Strongest alternative explanation:** The sequence is an over-fitted narrative on noisy 5-minute bars.
* **Falsification test:** If the sequential rule performs no better than a random breakout without the preceding compression, reject the hypothesis.
* **Data requirements:** Continuous sequence of 5-minute OHLCV bars.
* **Feasibility:** Fully feasible.

---

### Card 06 — Failed Breakout Exhaustion Reversal
* **Direction:** C (Sequence of events)
* **Mechanism:** Breakout attempts that pierce the 30-minute opening range high by $< 10\text{ bps}$ and immediately close back inside the range on declining volume represent buyer exhaustion and trapped longs.
* **Observable precursor:** Bar $t$ high $> \text{OR High}$, but bar $t$ close $< \text{OR High}$, with volume on bar $t$ lower than bar $t-1$.
* **Proposed action:** Immediately cancel any pending buy orders; if in a long position, liquidate immediately.
* **Why it might persist:** Algorithmic stop-hunts trigger retail breakout orders into institutional resting liquidity, trapping buyers.
* **Strongest alternative explanation:** The false breach is merely a minor pause before a stronger breakout occurs 15 minutes later.
* **Falsification test:** If subsequent 60-minute forward returns following false breaches are positive, reject the hypothesis.
* **Data requirements:** 5-minute OHLCV with opening range markers.
* **Feasibility:** Fully feasible.

---

### Card 07 — US Daylight Saving Clock Desynchronization
* **Direction:** D (Predictable timing changes as a diagnostic experiment)
* **Mechanism:** In late October and March, Europe and the US shift Daylight Saving Time (DST) on different weeks. For 1–2 weeks, US equity markets open at 14:30 CET instead of 15:30 CET. The institutional volume surge and macro reaction to US financial stocks shifts by exactly one hour on the Milan clock.
* **Observable precursor:** European session date falls within the 1-week transatlantic DST discrepancy window; US cash open occurs at 14:30 Rome time.
* **Proposed action:** Shift all US-open volatility filters and event triggers from 15:30 CET to 14:30 CET during this specific calendar window.
* **Why it might persist:** Calendar rules are deterministic, but retail strategies hardcode "15:30 CET" as the US open, misclassifying the volume regime.
* **Strongest alternative explanation:** US open impact on UniCredit is too diffuse or weak to produce tradeable directional divergence.
* **Falsification test:** If volume surges and volatility peaks remain at 15:30 CET rather than shifting to 14:30 CET during the discrepancy week, reject the hypothesis.
* **Data requirements:** Verified exchange calendar and multi-year October/March intraday bars.
* **Feasibility:** Partially feasible on 2026 data (October 25 DST shift included in cache); multi-year data required for statistical power.

---

### Card 08 — Opening Auction Settlement Latency (Frankfurt vs Milan)
* **Direction:** D (Predictable timing)
* **Mechanism:** Deutsche Börse (XETRA) opening continuous trading begins at 09:00:00 CET, whereas Borsa Italiana (MTAA) opening auction can conclude between 09:00:00 and 09:00:30 CET with opening uncrossing prints delayed. German bank components (`DBK.DE`, `CBK.DE`) establish direction 1–3 minutes before the full Italian order book settles.
* **Observable precursor:** 09:02 CET: German banking basket opens up $> 0.5\%$; UCG first continuous bar (09:05 CET) has not yet priced the move.
* **Proposed action:** Enter UCG long at 09:05 CET open; hold for 30–60 minutes.
* **Why it might persist:** Auction uncrossing mechanics and market maker quote obligations operate on distinct exchange engine latency.
* **Strongest alternative explanation:** Wide opening bid-ask spreads (25–40 bps) consume any price latency advantage.
* **Falsification test:** If net return after opening spread costs is negative, reject the hypothesis.
* **Data requirements:** 1-minute or tick-level opening auction prints and spreads.
* **Feasibility:** Limited on current 5m bars; requires verified tick-level order book history.

---

### Card 09 — Quarterly Index Rebalancing Liquidity Overhang
* **Direction:** E (Publicly observable portfolio and index events)
* **Mechanism:** Quarterly FTSE MIB and STOXX Europe 600 rebalancings (third Friday of March, June, September, December) require passive index tracking funds to trade substantial notional volumes in the closing auction (17:30 CET). Upward weight adjustments create persistent pre-close buying pressure between 17:00 and 17:25 CET.
* **Observable precursor:** Publicly announced index weight increase for UCG; session date is the rebalance effective date; time is 17:00 CET with rising cumulative volume.
* **Proposed action:** Enter long at 17:05 CET; exit at 17:25 CET continuous close (before auction freeze).
* **Why it might persist:** Passive funds are mandated to minimize tracking error at the close and are insensitive to execution price within the rebalance window.
* **Strongest alternative explanation:** Index arbitrageurs front-run the rebalance days in advance, neutralizing the closing hour effect.
* **Falsification test:** If pre-close returns on rebalancing days are not statistically distinguishable from non-rebalancing days, reject the hypothesis.
* **Data requirements:** Historical FTSE Russell / STOXX index change notices and intraday rebalance date bars.
* **Feasibility:** Requires multi-year historical event calendar.

---

### Card 10 — Monthly BTP Sovereign Debt Auction Liquidity Siphon
* **Direction:** E (Public events)
* **Mechanism:** Italian Treasury (MEF) conducts mid-month and end-of-month auctions for medium/long-term BTPs (typically at 11:00 CET). Primary dealer banks (including UniCredit) allocate balance sheet liquidity to underwrite sovereign debt. BTP bid-to-cover ratios and auction yields create sharp repricing of Italian bank assets between 11:15 and 12:00 CET.
* **Observable precursor:** Scheduled MEF BTP auction date at 11:00 CET; auction result published at 11:15 CET showing yield drop / strong bid-to-cover ($> 1.4\times$).
* **Proposed action:** Enter long UCG at 11:20 CET if BTP yields drop; hold 60m.
* **Why it might persist:** Primary dealer balance sheet commitments create brief institutional attention and capital concentration.
* **Strongest alternative explanation:** Sovereign debt yields are fully anticipated in the BTP futures market (`FBTP`) with zero spillover delay to equities.
* **Falsification test:** If UCG price movement after 11:15 CET on auction dates shows no correlation with auction bid-to-cover strength, reject the hypothesis.
* **Data requirements:** MEF auction calendar, BTP yield auction results, and 5-minute UCG bars.
* **Feasibility:** External event calendar integration required.

---

### Card 11 — Dynamic Rolling Beta Divergence vs Point-in-Time Peer Basket
* **Direction:** F (Changes in relationships, not fixed correlations)
* **Mechanism:** Instead of assuming a static 1:1 correlation with an ETF, model UCG's rolling 20-day beta against an Italian peer basket (`ISP.MI`, `BAMI.MI`, `BMPS.MI`). When UCG's intraday return deviates by $> 2.0$ standard deviations from its rolling beta-expected return without company-specific news, mean reversion to the peer basket occurs.
* **Observable precursor:** $\epsilon_{t} = R_{\text{UCG}, 15\text{m}} - \beta_{t} R_{\text{peers}, 15\text{m}} < -0.004$ ($40\text{ bps}$ residual deficit) with no active news headline.
* **Proposed action:** Buy UCG long; hold until residual $\epsilon$ converges to 0 or 60 minutes elapse.
* **Why it might persist:** Dedicated Italian equity long/short hedge funds operate on daily closing settlement, leaving intraday residual divergences open to statistical arbitrageurs.
* **Strongest alternative explanation:** Residual divergence is driven by private order flow (e.g., a block trade execution) that will permanently depress UCG price.
* **Falsification test:** If peer residual mean-reversion fails to generate positive net PnL after costs, reject the hypothesis.
* **Data requirements:** Synchronized 5-minute bars for `ISP.MI`, `BAMI.MI`, and `BMPS.MI`.
* **Feasibility:** Partially feasible; requires multi-asset cache for Italian peer banks.

---

### Card 12 — Idiosyncratic Decoupling from Sovereign Yield Spreads
* **Direction:** F (Dynamic relationships)
* **Mechanism:** Italian banks typically trade inversely to the 10-year BTP-Bund spread. When the BTP-Bund spread tightens intraday (bullish for Italian sovereign solvency) but UCG has not yet reacted due to localized liquidity pauses, an entry window emerges.
* **Observable precursor:** 10-year BTP-Bund spread narrows by $\ge 3\text{ bps}$ over 30 minutes while UCG return remains flat ($< 5\text{ bps}$).
* **Proposed action:** Enter UCG long; hold 60 minutes.
* **Why it might persist:** Fixed income and equity trading desks operate in institutional silos with distinct latency profiles.
* **Strongest alternative explanation:** BTP spread narrowing is already priced into pre-market futures.
* **Falsification test:** Test correlation between 30m BTP spread delta and subsequent 60m UCG return; reject if correlation is statistically indistinguishable from zero ($p > 0.05$).
* **Data requirements:** Real-time / 5-minute BTP and Bund yields.
* **Feasibility:** External data dependency.

---

### Card 13 — Post-Earnings Regulatory Filing Muted Response Drift
* **Direction:** G (Information novelty and unexpected nonreaction)
* **Mechanism:** Following quarterly earnings reports, initial headline numbers (net profit, revenue) are absorbed in the opening auction. However, complex granular details in the Pillar 3 regulatory disclosures (CET1 ratio, NPE ratios, net interest income guidance) require 60–120 minutes for institutional research analysts to parse. If the detailed disclosure is exceptionally positive but the initial market reaction is muted, post-earnings drift unfolds over the remainder of the session.
* **Observable precursor:** Earnings report session; positive CET1 ratio surprise ($> 30\text{ bps}$ above consensus); price reaction in first 60 minutes is flat ($|\Delta P| \le 0.5\%$) with $\text{RVOL} \ge 2.0$.
* **Proposed action:** Enter long at 10:30 CET; hold until 17:20 CET.
* **Why it might persist:** Structural delay in institutional model recalculation and compliance sign-off for fundamental parameter revisions.
* **Strongest alternative explanation:** The "muted" response reflects market skepticism or offsetting negative guidance communicated on the CEO earnings call.
* **Falsification test:** If post-earnings muted reactions are followed by random walk drift (zero excess return over benchmark), reject the hypothesis.
* **Data requirements:** Timestamped earnings releases, analyst consensus tables, and intraday bars across multiple quarters.
* **Feasibility:** Requires multi-year history covering at least 12–20 earnings sessions.

---

### Card 14 — Post-ECB Rate Decision Whip vs 30-Minute Policy Drift
* **Direction:** G (Information novelty)
* **Mechanism:** ECB rate announcements occur at 14:15 CET, followed by the President's press conference at 14:45 CET. The 14:15 release creates high-frequency algorithmic whipsaws with wide bid-ask spreads (30–60 bps). Between 14:45 and 15:30 CET, fundamental macro positioning emerges as policy nuances are clarified.
* **Observable precursor:** ECB Governing Council decision day; time is 15:00 CET; initial 14:15 spike has subsided; 30m sector trend is established with $\text{RVOL} \ge 2.5$.
* **Proposed action:** Do NOT trade between 14:14 and 14:44 CET (spread protection); enter directional trade at 15:00 CET following the confirmed post-press-conference trend; hold 90 minutes.
* **Why it might persist:** Market makers deliberately widen spreads and pull liquidity during the 14:15 release, preventing retail profit; waiting for liquidity normalization captures institutional post-announcement reallocation.
* **Strongest alternative explanation:** Most of the move is completed in the first 60 seconds; entering at 15:00 CET captures tail risk and mean reversion.
* **Falsification test:** Measure post-15:00 CET drift vs 14:15–15:00 CET direction; reject if drift is negative or random.
* **Data requirements:** ECB calendar and 5-minute intraday tick data around central bank meetings.
* **Feasibility:** Requires multi-year ECB meeting dataset.

---

### Card 15 — Anti-Breakout Rejection: Predeclared Quality Filter
* **Direction:** H (Predict the failure of a familiar setup)
* **Mechanism:** Traditional opening range breakouts fail consistently on Euronext Milan because retail traders buy breakouts without verifying sector alignment or order-flow conviction. By predeclaring an adversarial rejection filter—rejecting breakouts where same-clock RVOL $< 1.5$ OR where European banking sector spread is negative—we eliminate the majority of false breakout traps.
* **Observable precursor:** Price crosses 30m Opening Range High, BUT either $\text{RVOL} < 1.5$ OR `sector_spread_15m < 0.001`.
* **Proposed action:** REJECT the buy setup; remain in cash. Only execute breakouts that pass both strict criteria.
* **Why it might persist:** Retail momentum bots continue firing on pure price breakouts, providing liquidity to institutional sellers.
* **Strongest alternative explanation:** Raising the filter bar simply reduces sample size to near-zero without actually curing the negative expectancy of the underlying setup.
* **Falsification test:** If filtered breakouts still yield negative net returns after transaction costs, or if sample size drops to $< 5$ trades per year, reject the hypothesis.
* **Data requirements:** 5-minute bars with OR markers and sector spread features.
* **Feasibility:** Fully feasible and directly tested in Campaign 1.

---

### Card 16 — Midday Range Rejection Filter (Anti-Choil Rule)
* **Direction:** H (Predict setup failure)
* **Mechanism:** Intraday signals generated between 12:00 and 13:30 CET (European lunch) suffer from elevated failure rates due to low market depth and false liquidity pushes.
* **Observable precursor:** Any rule-based entry signal firing between 12:00 and 13:30 CET where the 30-minute realized volatility is $< 25\text{ bps}$.
* **Proposed action:** Suppress all new entries during this 90-minute window.
* **Why it might persist:** Liquidity providers widen spreads relative to volatility during lunch hours, elevating the effective transaction cost hurdle.
* **Strongest alternative explanation:** The lunch window contains genuine US pre-market macro rebalancing that should not be skipped.
* **Falsification test:** Compare Sharpe ratio and net PnL of all strategies with and without the midday suppression rule; reject if performance deteriorates.
* **Data requirements:** Intraday bars with timestamp filtering.
* **Feasibility:** Fully feasible.

---

### Card 17 — Passive Limit Touch Order Timing (Spread Crossing Avoidance)
* **Direction:** I (Improve trade timing without improving directional prediction)
* **Mechanism:** Crossing the full 10 bps bid-ask spread with aggressive market orders immediately imposes a -10 bps tax. By placing passive limit orders at the near touch (current bid for buys) and waiting up to 3 bars (15 minutes) for execution, execution cost drops by 50% (saving 5–8 bps per trade).
* **Observable precursor:** Strategy generates a buy signal; order is placed as a limit order at the current bid rather than crossing to the ask.
* **Proposed action:** Submit resting limit order at `current_bid`; if unfilled after 15 minutes, cancel order and remain in cash (do not chase).
* **Why it might persist:** Market makers and small liquidity providers are willing to hit resting limit orders during normal intraday noise.
* **Strongest alternative explanation:** Adverse selection: limit orders only get filled when price is crashing through the bid (adverse fills), while winning moves run away without filling (missed trades).
* **Falsification test:** If net PnL of filled limit orders suffers from severe adverse selection (worse post-fill performance than market orders) or if fill rate is $< 30\%$, reject the hypothesis.
* **Data requirements:** Level 1/Level 2 order book data with queue position modeling.
* **Feasibility:** Requires realistic order book simulation with tick queue models.

---

### Card 18 — Post-Breakout Retest Pullback Entry
* **Direction:** I (Improve trade timing)
* **Mechanism:** Rather than buying the exact breakout candle (at the absolute peak of the range), wait for the initial momentum spike to exhaust and retest the broken resistance level as support over the subsequent 10–20 minutes.
* **Observable precursor:** Price breaks above 30m OR high; wait for a pullback to within $5\text{ bps}$ of the OR high with declining volume ($\text{RVOL} \le 1.0$).
* **Proposed action:** Enter long on the pullback touch of OR high; stop-loss $15\text{ bps}$ below OR high.
* **Why it might persist:** Impatient momentum traders enter early and dump positions on the first minor retrace, providing liquidity to disciplined pullback buyers.
* **Strongest alternative explanation:** Strong trending breakouts never retest the level; the strategy only fills on weak, dying breakouts that subsequently fail completely.
* **Falsification test:** If fill rate is $< 25\%$ or if pullback entries break through support more often than bouncing, reject the hypothesis.
* **Data requirements:** 5-minute OHLCV bars.
* **Feasibility:** Fully feasible.

---

### Card 19 — Small-Account Odd-Lot Execution Advantage
* **Direction:** J (Small-capacity opportunities)
* **Mechanism:** Institutional orders of €1,000,000+ cannot execute on Euronext Milan without substantial market impact (5–15 bps slippage). A small account (€10,000 capital, €2,500–€5,000 position size) can execute instantly against top-of-book resting liquidity with negligible market impact—provided broker minimum commission hurdles can be managed.
* **Observable precursor:** Rapid intraday dislocation where top-of-book depth is thin (e.g., 2,000 shares available at the inside ask).
* **Proposed action:** Deploy small-clip orders ($\le 500$ shares) to capture quick $20\text{--}30\text{ bps}$ micro-dislocations that large funds are physically incapable of trading.
* **Why it might persist:** Large quantitative hedge funds and institutional desks cannot scale positions below €50,000–€100,000 without violating internal capacity thresholds.
* **Strongest alternative explanation:** Retail broker minimum ticket fees (€3.00/side) impose an insurmountable 24 bps hurdle on €2,500 orders, converting structural agility into a cost disadvantage.
* **Falsification test:** If broker commissions exceed the gross profit of micro-dislocations, reject the hypothesis for accounts below €50,000.
* **Data requirements:** Consolidated trade tape with trade size markers and broker commission schedules.
* **Feasibility:** Fully audited; proven in Phase 7 to require $\ge €10,000\text{--}€50,000$ to neutralize the ticket fee.

---

### Card 20 — Pre-Auction Market-on-Close (MOC) Order Queue Positioning
* **Direction:** J (Small-capacity opportunities)
* **Mechanism:** Between 17:20 and 17:25 CET (the final 5 minutes of continuous trading before the 17:30 closing auction freeze), passive liquidity pools and market makers rebalance inventories. If persistent buying pressure is observable in the final continuous tape, small orders can ride the final continuous push and exit cleanly before the auction uncrossing.
* **Observable precursor:** 17:20 CET: UCG trading above VWAP with $\text{RVOL} \ge 1.4$ and continuous positive tick flow.
* **Proposed action:** Enter long at 17:20 CET; unconditionally exit at 17:24:59 CET (preserving Italian Tobin Tax FTT exemption).
* **Why it might persist:** Closing continuous trading dynamics are driven by execution algorithms seeking to complete daily benchmark targets before the auction cutoff.
* **Strongest alternative explanation:** The 5-minute holding period is too brief for gross price movement to exceed round-trip bid-ask spread (10 bps) and commission costs (10–24 bps).
* **Falsification test:** If average return over the 5-minute pre-close window is $< 24\text{ bps}$, reject the hypothesis.
* **Data requirements:** Minute-level or 5-minute closing bars with exact 17:20–17:25 timestamps.
* **Feasibility:** Fully testable on current dataset.

---

## 3. Qualitative Evaluation & Selection Ranking

To select up to three mechanisms for empirical implementation without wasting search budget, all 20 cards were ranked against five objective criteria:
1. **Plausibility (Weight 25%):** Is there a credible economic, structural, or behavioral mechanism?
2. **Data Availability (Weight 25%):** Can the hypothesis be tested with verified real observations without synthetic assumptions?
3. **Distinctness (Weight 20%):** Does it fundamentally diverge from standard indicator-fitting and prior failed setups?
4. **Execution Feasibility (Weight 15%):** Can a long-or-cash, no-leverage account execute under Euronext Milan rules?
5. **Decisiveness (Weight 15%):** Can the hypothesis be decisively confirmed or falsified with clear stopping rules?

### Ranking Table

| Rank | Card ID | Mechanism Name | Direction | Plausibility | Data Ready | Distinctness | Feasibility | Decisiveness | Total Score | Action Status |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | **Card 01** | **Asymmetric Sector Lead-Lag Catch-Up** | **A & F** | 9/10 | 10/10 | 9/10 | 9/10 | 9/10 | **9.25** | **SELECTED (Campaign 1, Exp 1)** |
| **2** | **Card 03** | **Volume Absorption / Low Displacement** | **B** | 8/10 | 9/10 | 9/10 | 8/10 | 9/10 | **8.55** | **SELECTED (Campaign 1, Exp 2)** |
| **3** | **Card 15** | **Anti-Breakout Quality Rejection Filter** | **H** | 9/10 | 10/10 | 8/10 | 8/10 | 9/10 | **8.90** | **SELECTED (Campaign 1, Exp 3)** |
| 4 | Card 05 | Sequential Compression to Range Escape | C | 8/10 | 9/10 | 8/10 | 8/10 | 8/10 | 8.25 | Backlog (Campaign 2) |
| 5 | Card 04 | Low-Volume Drift Fragility | B | 8/10 | 9/10 | 7/10 | 8/10 | 8/10 | 8.05 | Backlog (Campaign 2) |
| 6 | Card 18 | Post-Breakout Retest Pullback Entry | I | 8/10 | 8/10 | 7/10 | 8/10 | 8/10 | 7.85 | Backlog (Campaign 2) |
| 7 | Card 06 | Failed Breakout Exhaustion Reversal | C | 7/10 | 8/10 | 8/10 | 8/10 | 8/10 | 7.75 | Backlog (Campaign 2) |
| 8 | Card 11 | Dynamic Rolling Beta vs Peer Basket | F | 9/10 | 6/10 | 9/10 | 7/10 | 8/10 | 7.65 | Blocked on Multi-Asset Feed |
| 9 | Card 17 | Passive Limit Touch Order Timing | I | 8/10 | 5/10 | 9/10 | 7/10 | 8/10 | 7.25 | Blocked on Level 2 Tick Data |
| 10 | Card 07 | US Daylight Saving Desynchronization | D | 8/10 | 6/10 | 8/10 | 8/10 | 7/10 | 7.35 | Blocked on Multi-Year History |
| 11 | Card 16 | Midday Range Rejection Filter | H | 7/10 | 9/10 | 6/10 | 8/10 | 7/10 | 7.45 | Backlog |
| 12 | Card 02 | Asymmetric Downside Panic Transmission | A | 8/10 | 8/10 | 7/10 | 6/10 | 8/10 | 7.45 | Requires Shorting Mandate |
| 13 | Card 20 | Pre-Auction MOC Queue Positioning | J | 7/10 | 7/10 | 8/10 | 7/10 | 7/10 | 7.15 | Backlog |
| 14 | Card 09 | Quarterly Index Rebalancing Overhang | E | 8/10 | 5/10 | 8/10 | 7/10 | 8/10 | 7.10 | Blocked on Multi-Year Events |
| 15 | Card 10 | Monthly BTP Sovereign Auction Drain | E | 8/10 | 4/10 | 9/10 | 7/10 | 8/10 | 7.00 | Blocked on External Event Feed |
| 16 | Card 14 | Post-ECB Rate Decision Drift | G | 8/10 | 4/10 | 8/10 | 7/10 | 8/10 | 6.85 | Blocked on ECB Calendar Feed |
| 17 | Card 12 | Idiosyncratic Sovereign Decoupling | F | 8/10 | 4/10 | 8/10 | 7/10 | 7/10 | 6.70 | Blocked on Real-Time BTP Data |
| 18 | Card 13 | Post-Earnings Regulatory Filing Drift | G | 8/10 | 3/10 | 9/10 | 7/10 | 8/10 | 6.75 | Blocked on Multi-Year Filings |
| 19 | Card 08 | Opening Auction Settlement Latency | D | 7/10 | 3/10 | 8/10 | 6/10 | 7/10 | 6.05 | Blocked on Sub-Minute Borsa L2 |
| 20 | Card 19 | Small-Account Odd-Lot Advantage | J | 6/10 | 6/10 | 6/10 | 5/10 | 8/10 | 6.10 | Limited by €3 Min Broker Fee |

---

## 4. Selection Rationale for Campaign 1

The top 3 qualifying mechanisms were selected for immediate empirical backtesting and adversarial falsification:
1. **Experiment 1 (Card 01: Sector Lead-Lag Catch-Up):** Highest total score (9.25). Captures cross-border institutional flow lag between Frankfurt (`EXV1.DE`) and Milan (`UCG.MI`). Verified data already available; tested with honest 5m execution.
2. **Experiment 2 (Card 03: Volume Absorption / Low Displacement):** Score 8.55. Directly tests Direction B (how efficiently volume moves price). Distinct from momentum or breakout; investigates whether heavy volume without price progress signals absorption or breakdown.
3. **Experiment 3 (Card 15: Anti-Breakout Rejection Filter):** Score 8.90. Directly tests Direction H (predicting setup failure). Evaluates whether a predeclared negative filter can redeem a broken baseline without creating an unprincipled parameter search.
