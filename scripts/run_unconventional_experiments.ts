import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { enrichWithMultiHorizonFeatures, parseYahooChartResponse } from '../src/engine/realMarketData';
import { runBacktest5m, DEFAULT_EXECUTION_CONFIG } from '../src/engine/backtest';
import { summarizePerformance } from '../src/engine/statistics';
import { Candidate, FeatureRow, ExecutionConfig, Trade } from '../src/types';

// Load real market dataset
const cachePath = join(process.cwd(), 'server_data', 'real_market_cache.json');
const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));
const bars5m = parseYahooChartResponse(raw.ucg, raw.banking_etf, raw.ftse_mib);
const features = enrichWithMultiHorizonFeatures(bars5m);

const allSessions = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
const devSessions = new Set(allSessions.slice(0, 40));
const holdoutSessions = new Set(allSessions.slice(40));

console.log(`Loaded ${bars5m.length} 5m bars across ${allSessions.length} sessions.`);
console.log(`Development: ${devSessions.size} sessions | Holdout (Frozen): ${holdoutSessions.size} sessions.`);

// Sizing configurations to test
const retailConfig: ExecutionConfig = {
  ...DEFAULT_EXECUTION_CONFIG,
  initial_cash: 10000,
  allocation_fraction: 0.25, // €2,500 position size (€3 min fee = 24 bps RT + 10 bps spread + 4 bps slip = 38 bps)
  holding_minutes: 60,
};

const institutionalConfig: ExecutionConfig = {
  ...DEFAULT_EXECUTION_CONFIG,
  initial_cash: 50000,
  allocation_fraction: 0.25, // €12,500 position size (0.05% fee = 10 bps RT + 10 bps spread + 4 bps slip = 24 bps)
  holding_minutes: 60,
};

interface ExperimentResult {
  id: string;
  name: string;
  mechanism: string;
  devMetricsRetail: any;
  devMetricsInstitutional: any;
  tradesRetail: Trade[];
  tradesInstitutional: Trade[];
  falsificationChecks: {
    timingLagSurvives: boolean;
    placeboSurvives: boolean;
    benchmarkBeaten: boolean;
    executionStressSurvives: boolean;
    concentrationOk: boolean;
  };
}

const experimentResults: ExperimentResult[] = [];

console.log('\n================================================================');
console.log('CAMPAIGN 1: THREE UNCONVENTIONAL MECHANISM EXPERIMENTS');
console.log('================================================================');

// -------------------------------------------------------------
// EXPERIMENT 1: Asymmetric Sector Lag Catch-Up (Direction A & F)
// -------------------------------------------------------------
console.log('\n--- Running Experiment 1: Asymmetric Sector Lag Catch-Up ---');
const exp1Candidate: Candidate = {
  id: 'exp1_sector_lag_catchup',
  kind: 'rule',
  name: 'sector_lead_lag',
  description: 'Buy UCG when trailing EURO STOXX Banks ETF by >= 35 bps with volume confirmation, holding 60m.',
  parameters: {
    spread_threshold: -0.0035,
    rvol_threshold: 1.2,
    min_minute: 60,
    max_minute: 390,
    holding_minutes: 60,
  },
  score_threshold: 0.0,
  target_horizon_minutes: 60,
};

const exp1ResRetail = runBacktest5m(features, exp1Candidate, retailConfig, devSessions);
const exp1ResInst = runBacktest5m(features, exp1Candidate, institutionalConfig, devSessions);
const exp1MetricsRetail = summarizePerformance(exp1ResRetail.equity, exp1ResRetail.trades, retailConfig.initial_cash);
const exp1MetricsInst = summarizePerformance(exp1ResInst.equity, exp1ResInst.trades, institutionalConfig.initial_cash);

console.log(`[Exp 1 Retail €10k] Trades: ${exp1ResRetail.trades.length} | Net PnL: €${exp1MetricsRetail.total_net_pnl} | Return: ${(exp1MetricsRetail.net_return * 100).toFixed(2)}% | WinRate: ${(exp1MetricsRetail.win_rate * 100).toFixed(1)}%`);
console.log(`[Exp 1 Inst €50k]   Trades: ${exp1ResInst.trades.length} | Net PnL: €${exp1MetricsInst.total_net_pnl} | Return: ${(exp1MetricsInst.net_return * 100).toFixed(2)}% | WinRate: ${(exp1MetricsInst.win_rate * 100).toFixed(1)}%`);

// -------------------------------------------------------------
// EXPERIMENT 2: Volume Absorption / Price Displacement Failure (Direction B)
// -------------------------------------------------------------
console.log('\n--- Running Experiment 2: Volume Absorption / Low Displacement Reversal ---');
// Mechanism: Heavy volume (RVOL >= 1.5) with minimal price displacement (< 0.15% over 15m) near lower VWAP boundary.
// When selling volume is absorbed by passive limit orders without moving price down, expect a mean-reverting pop over 60m.
const exp2Signals = new Map<string, number>();
for (let i = 0; i < features.length; i++) {
  const f = features[i];
  if (
    f.rvol_ready &&
    f.minute_of_day >= 60 &&
    f.minute_of_day <= 390 &&
    f.rvol >= 1.5 && // Heavy volume surge
    Math.abs(f.ret_15m) <= 0.0015 && // Price failed to displace (absorption)
    (f.close - f.vwap) / f.vwap < -0.003 // Below VWAP (absorbing downward pressure)
  ) {
    exp2Signals.set(f.timestamp, 1.0);
  }
}

// Custom candidate runner for Exp 2
function runExp2(cfg: ExecutionConfig, sessions: Set<string>) {
  // Mock candidate using custom signals
  const cand: Candidate = {
    id: 'exp2_volume_absorption',
    kind: 'rule',
    name: 'mean_reversion',
    description: 'Volume absorption failure: heavy volume with compressed displacement below VWAP',
    parameters: { holding_minutes: 60 },
    score_threshold: 0.0,
    target_horizon_minutes: 60,
  };
  // We temporarily evaluate using custom logic
  const sessionDates = Array.from(sessions).sort();
  let currentCash = cfg.initial_cash;
  let peakEquity = cfg.initial_cash;
  const trades: Trade[] = [];
  const dailyEquityRows: any[] = [];
  let tCounter = 1;

  for (const sDate of sessionDates) {
    const sBars = features.filter((f) => f.session_date === sDate);
    if (sBars.length === 0) continue;
    const sessionStartEquity = currentCash;
    let sPnl = 0;
    let sCount = 0;
    let inPos = false;
    let activeTrd: any = null;
    let entryIdx = -1;

    for (let i = 0; i < sBars.length; i++) {
      const b = sBars[i];
      if (inPos) {
        if (i >= entryIdx + 12 || i >= sBars.length - 2) {
          const friction = (cfg.round_trip_spread_bps / 2 + cfg.slippage_bps_per_side) / 10000;
          const exitPrice = b.open * (1 - friction);
          const notional = activeTrd.qty * exitPrice;
          const exitFee = Math.max(cfg.minimum_commission, notional * cfg.commission_rate);
          const grossPnl = activeTrd.qty * (exitPrice - activeTrd.entryPrice);
          const netPnl = grossPnl - activeTrd.entryFee - exitFee;
          currentCash += notional - exitFee;
          sPnl += netPnl;
          sCount++;
          trades.push({
            id: `EXP2-${tCounter++}`,
            candidate_id: cand.id,
            session_date: sDate,
            entry_time: activeTrd.entryTime,
            exit_time: b.timestamp,
            quantity: activeTrd.qty,
            entry_price: activeTrd.entryPrice,
            exit_price: exitPrice,
            entry_fee: activeTrd.entryFee,
            exit_fee: exitFee,
            total_fees: activeTrd.entryFee + exitFee,
            gross_pnl: grossPnl,
            net_pnl: netPnl,
            net_return: netPnl / (activeTrd.qty * activeTrd.entryPrice),
            exit_reason: i >= sBars.length - 2 ? 'session_end' : 'time_exit',
            holding_duration_minutes: (i - entryIdx) * 5,
          });
          inPos = false;
        }
      } else if (!inPos && exp2Signals.has(b.timestamp) && i < sBars.length - 14) {
        const nextBar = sBars[i + 1];
        if (nextBar) {
          const friction = (cfg.round_trip_spread_bps / 2 + cfg.slippage_bps_per_side) / 10000;
          const entryPrice = nextBar.open * (1 + friction);
          const notional = currentCash * cfg.allocation_fraction;
          const qty = Math.floor(notional / entryPrice);
          if (qty > 0) {
            const entryFee = Math.max(cfg.minimum_commission, qty * entryPrice * cfg.commission_rate);
            if (currentCash >= qty * entryPrice + entryFee) {
              currentCash -= qty * entryPrice + entryFee;
              inPos = true;
              entryIdx = i + 1;
              activeTrd = { qty, entryPrice, entryTime: nextBar.timestamp, entryFee };
            }
          }
        }
      }
    }
    dailyEquityRows.push({
      session_date: sDate,
      equity: currentCash,
      daily_return: (currentCash - sessionStartEquity) / sessionStartEquity,
      net_pnl: sPnl,
      trade_count: sCount,
      drawdown_pct: 0,
    });
  }
  return { trades, equity: dailyEquityRows };
}

const exp2ResRetail = runExp2(retailConfig, devSessions);
const exp2ResInst = runExp2(institutionalConfig, devSessions);
const exp2MetricsRetail = summarizePerformance(exp2ResRetail.equity, exp2ResRetail.trades, retailConfig.initial_cash);
const exp2MetricsInst = summarizePerformance(exp2ResInst.equity, exp2ResInst.trades, institutionalConfig.initial_cash);

console.log(`[Exp 2 Retail €10k] Trades: ${exp2ResRetail.trades.length} | Net PnL: €${exp2MetricsRetail.total_net_pnl} | Return: ${(exp2MetricsRetail.net_return * 100).toFixed(2)}% | WinRate: ${(exp2MetricsRetail.win_rate * 100).toFixed(1)}%`);
console.log(`[Exp 2 Inst €50k]   Trades: ${exp2ResInst.trades.length} | Net PnL: €${exp2MetricsInst.total_net_pnl} | Return: ${(exp2MetricsInst.net_return * 100).toFixed(2)}% | WinRate: ${(exp2MetricsInst.win_rate * 100).toFixed(1)}%`);

// -------------------------------------------------------------
// EXPERIMENT 3: Breakout Rejection Filter (Direction H)
// -------------------------------------------------------------
console.log('\n--- Running Experiment 3: Breakout Rejection / Anti-Breakout Filter ---');
// Mechanism: Opening range breakouts frequently trap retail momentum traders when:
// 1) Same-clock volume is weak (RVOL < 1.3), OR
// 2) The European banking sector ETF is NOT breaking out (sector_spread < 0).
// Hypothesis: By REJECTING breakouts that lack sector confirmation and require RVOL >= 1.5,
// we turn the unprofitable breakout baseline (18 trades, -€207 net PnL) into a selective filter.
const exp3Signals = new Map<string, number>();
for (let i = 0; i < features.length; i++) {
  const f = features[i];
  if (
    f.or_ready &&
    f.or_high !== null &&
    f.minute_of_day >= 35 &&
    f.minute_of_day <= 240 &&
    f.close > f.or_high &&
    f.rvol >= 1.5 && // STRICT volume acceleration
    f.sector_spread_15m !== undefined &&
    f.sector_spread_15m >= 0.001 // Sector confirmed: UCG or sector moving up together
  ) {
    exp3Signals.set(f.timestamp, 1.0);
  }
}

function runExp3(cfg: ExecutionConfig, sessions: Set<string>) {
  const cand: Candidate = {
    id: 'exp3_filtered_breakout',
    kind: 'rule',
    name: 'opening_breakout',
    description: 'Breakout with sector confirmation filter and strict volume acceleration',
    parameters: { holding_minutes: 60 },
    score_threshold: 0.0,
    target_horizon_minutes: 60,
  };
  const sessionDates = Array.from(sessions).sort();
  let currentCash = cfg.initial_cash;
  const trades: Trade[] = [];
  const dailyEquityRows: any[] = [];
  let tCounter = 1;

  for (const sDate of sessionDates) {
    const sBars = features.filter((f) => f.session_date === sDate);
    if (sBars.length === 0) continue;
    const sessionStartEquity = currentCash;
    let sPnl = 0;
    let sCount = 0;
    let inPos = false;
    let activeTrd: any = null;
    let entryIdx = -1;

    for (let i = 0; i < sBars.length; i++) {
      const b = sBars[i];
      if (inPos) {
        if (i >= entryIdx + 12 || i >= sBars.length - 2) {
          const friction = (cfg.round_trip_spread_bps / 2 + cfg.slippage_bps_per_side) / 10000;
          const exitPrice = b.open * (1 - friction);
          const notional = activeTrd.qty * exitPrice;
          const exitFee = Math.max(cfg.minimum_commission, notional * cfg.commission_rate);
          const grossPnl = activeTrd.qty * (exitPrice - activeTrd.entryPrice);
          const netPnl = grossPnl - activeTrd.entryFee - exitFee;
          currentCash += notional - exitFee;
          sPnl += netPnl;
          sCount++;
          trades.push({
            id: `EXP3-${tCounter++}`,
            candidate_id: cand.id,
            session_date: sDate,
            entry_time: activeTrd.entryTime,
            exit_time: b.timestamp,
            quantity: activeTrd.qty,
            entry_price: activeTrd.entryPrice,
            exit_price: exitPrice,
            entry_fee: activeTrd.entryFee,
            exit_fee: exitFee,
            total_fees: activeTrd.entryFee + exitFee,
            gross_pnl: grossPnl,
            net_pnl: netPnl,
            net_return: netPnl / (activeTrd.qty * activeTrd.entryPrice),
            exit_reason: i >= sBars.length - 2 ? 'session_end' : 'time_exit',
            holding_duration_minutes: (i - entryIdx) * 5,
          });
          inPos = false;
        }
      } else if (!inPos && exp3Signals.has(b.timestamp) && i < sBars.length - 14) {
        const nextBar = sBars[i + 1];
        if (nextBar) {
          const friction = (cfg.round_trip_spread_bps / 2 + cfg.slippage_bps_per_side) / 10000;
          const entryPrice = nextBar.open * (1 + friction);
          const notional = currentCash * cfg.allocation_fraction;
          const qty = Math.floor(notional / entryPrice);
          if (qty > 0) {
            const entryFee = Math.max(cfg.minimum_commission, qty * entryPrice * cfg.commission_rate);
            if (currentCash >= qty * entryPrice + entryFee) {
              currentCash -= qty * entryPrice + entryFee;
              inPos = true;
              entryIdx = i + 1;
              activeTrd = { qty, entryPrice, entryTime: nextBar.timestamp, entryFee };
            }
          }
        }
      }
    }
    dailyEquityRows.push({
      session_date: sDate,
      equity: currentCash,
      daily_return: (currentCash - sessionStartEquity) / sessionStartEquity,
      net_pnl: sPnl,
      trade_count: sCount,
      drawdown_pct: 0,
    });
  }
  return { trades, equity: dailyEquityRows };
}

const exp3ResRetail = runExp3(retailConfig, devSessions);
const exp3ResInst = runExp3(institutionalConfig, devSessions);
const exp3MetricsRetail = summarizePerformance(exp3ResRetail.equity, exp3ResRetail.trades, retailConfig.initial_cash);
const exp3MetricsInst = summarizePerformance(exp3ResInst.equity, exp3ResInst.trades, institutionalConfig.initial_cash);

console.log(`[Exp 3 Retail €10k] Trades: ${exp3ResRetail.trades.length} | Net PnL: €${exp3MetricsRetail.total_net_pnl} | Return: ${(exp3MetricsRetail.net_return * 100).toFixed(2)}% | WinRate: ${(exp3MetricsRetail.win_rate * 100).toFixed(1)}%`);
console.log(`[Exp 3 Inst €50k]   Trades: ${exp3ResInst.trades.length} | Net PnL: €${exp3MetricsInst.total_net_pnl} | Return: ${(exp3MetricsInst.net_return * 100).toFixed(2)}% | WinRate: ${(exp3MetricsInst.win_rate * 100).toFixed(1)}%`);

// -------------------------------------------------------------
// ADVERSARIAL FALSIFICATION TESTING (Section 6 Challenges)
// -------------------------------------------------------------
console.log('\n================================================================');
console.log('ADVERSARIAL FALSIFICATION CHALLENGES (Testing Exp 1: Sector Lead-Lag)');
console.log('================================================================');

// 1. Timing Lag Challenge: Enter at bar i + 2 (10m delay) instead of bar i + 1
function runTimingChallenge() {
  const sessionDates = Array.from(devSessions).sort();
  let cash = institutionalConfig.initial_cash;
  const trades: Trade[] = [];
  let tCounter = 1;

  for (const sDate of sessionDates) {
    const sBars = features.filter((f) => f.session_date === sDate);
    if (sBars.length === 0) continue;
    let inPos = false;
    let activeTrd: any = null;
    let entryIdx = -1;

    for (let i = 0; i < sBars.length; i++) {
      const b = sBars[i];
      if (inPos) {
        if (i >= entryIdx + 12 || i >= sBars.length - 2) {
          const friction = (institutionalConfig.round_trip_spread_bps / 2 + institutionalConfig.slippage_bps_per_side) / 10000;
          const exitPrice = b.open * (1 - friction);
          const notional = activeTrd.qty * exitPrice;
          const exitFee = Math.max(institutionalConfig.minimum_commission, notional * institutionalConfig.commission_rate);
          const grossPnl = activeTrd.qty * (exitPrice - activeTrd.entryPrice);
          const netPnl = grossPnl - activeTrd.entryFee - exitFee;
          cash += notional - exitFee;
          trades.push({
            id: `TIME-LAG-${tCounter++}`,
            candidate_id: 'exp1_sector_lag_catchup',
            session_date: sDate,
            entry_time: activeTrd.entryTime,
            exit_time: b.timestamp,
            quantity: activeTrd.qty,
            entry_price: activeTrd.entryPrice,
            exit_price: exitPrice,
            entry_fee: activeTrd.entryFee,
            exit_fee: exitFee,
            total_fees: activeTrd.entryFee + exitFee,
            gross_pnl: grossPnl,
            net_pnl: netPnl,
            net_return: netPnl / (activeTrd.qty * activeTrd.entryPrice),
            exit_reason: 'time_exit',
          });
          inPos = false;
        }
      } else if (!inPos && i >= 12 && i <= sBars.length - 15) {
        const f = sBars[i];
        if (f.sector_spread_15m !== undefined && f.sector_spread_15m <= -0.0035 && f.rvol >= 1.2) {
          // DELAYED BY 2 BARS (10 minutes)
          const entryBar = sBars[i + 2];
          if (entryBar) {
            const friction = (institutionalConfig.round_trip_spread_bps / 2 + institutionalConfig.slippage_bps_per_side) / 10000;
            const entryPrice = entryBar.open * (1 + friction);
            const notional = cash * institutionalConfig.allocation_fraction;
            const qty = Math.floor(notional / entryPrice);
            if (qty > 0) {
              const entryFee = Math.max(institutionalConfig.minimum_commission, qty * entryPrice * institutionalConfig.commission_rate);
              if (cash >= qty * entryPrice + entryFee) {
                cash -= qty * entryPrice + entryFee;
                inPos = true;
                entryIdx = i + 2;
                activeTrd = { qty, entryPrice, entryTime: entryBar.timestamp, entryFee };
              }
            }
          }
        }
      }
    }
  }
  const netPnl = trades.reduce((a, t) => a + t.net_pnl, 0);
  const wins = trades.filter((t) => t.net_pnl > 0).length;
  console.log(`[Challenge 1: Timing Lag 10m] Trades: ${trades.length} | Net PnL: €${netPnl.toFixed(2)} | Wins: ${wins}/${trades.length} (${(wins/trades.length*100).toFixed(1)}%)`);
  return { netPnl, trades: trades.length, survived: netPnl > 0 };
}

// 2. Placebo Challenge: Invert the hypothesis (Buy when UCG leads by >= 35 bps)
function runPlaceboChallenge() {
  const placeboCand: Candidate = {
    id: 'placebo_inverted_lead',
    kind: 'rule',
    name: 'sector_lead_lag',
    description: 'PLACEBO CONTROL: Buy UCG when LEADING the sector ETF by >= 35 bps (opposite of catchup)',
    parameters: {
      spread_threshold: 0.0035, // Positive spread = leading
      rvol_threshold: 1.2,
      min_minute: 60,
      max_minute: 390,
      holding_minutes: 60,
    },
    score_threshold: 0.0,
    target_horizon_minutes: 60,
  };
  // Custom signal generator for placebo
  const placeboSignals = new Map<string, number>();
  for (const f of features) {
    if (f.minute_of_day >= 60 && f.minute_of_day <= 390 && f.sector_spread_15m !== undefined && f.sector_spread_15m >= 0.0035 && f.rvol >= 1.2) {
      placeboSignals.set(f.timestamp, 1.0);
    }
  }
  // Backtest placebo
  const sessionDates = Array.from(devSessions).sort();
  let cash = institutionalConfig.initial_cash;
  const trades: Trade[] = [];
  let tCounter = 1;
  for (const sDate of sessionDates) {
    const sBars = features.filter((f) => f.session_date === sDate);
    let inPos = false;
    let activeTrd: any = null;
    let entryIdx = -1;
    for (let i = 0; i < sBars.length; i++) {
      const b = sBars[i];
      if (inPos) {
        if (i >= entryIdx + 12 || i >= sBars.length - 2) {
          const friction = (institutionalConfig.round_trip_spread_bps / 2 + institutionalConfig.slippage_bps_per_side) / 10000;
          const exitPrice = b.open * (1 - friction);
          const notional = activeTrd.qty * exitPrice;
          const exitFee = Math.max(institutionalConfig.minimum_commission, notional * institutionalConfig.commission_rate);
          const grossPnl = activeTrd.qty * (exitPrice - activeTrd.entryPrice);
          const netPnl = grossPnl - activeTrd.entryFee - exitFee;
          cash += notional - exitFee;
          trades.push({
            id: `PLACEBO-${tCounter++}`,
            candidate_id: placeboCand.id,
            session_date: sDate,
            entry_time: activeTrd.entryTime,
            exit_time: b.timestamp,
            quantity: activeTrd.qty,
            entry_price: activeTrd.entryPrice,
            exit_price: exitPrice,
            entry_fee: activeTrd.entryFee,
            exit_fee: exitFee,
            total_fees: activeTrd.entryFee + exitFee,
            gross_pnl: grossPnl,
            net_pnl: netPnl,
            net_return: netPnl / (activeTrd.qty * activeTrd.entryPrice),
            exit_reason: 'time_exit',
          });
          inPos = false;
        }
      } else if (!inPos && placeboSignals.has(b.timestamp) && i < sBars.length - 14) {
        const nextBar = sBars[i + 1];
        if (nextBar) {
          const friction = (institutionalConfig.round_trip_spread_bps / 2 + institutionalConfig.slippage_bps_per_side) / 10000;
          const entryPrice = nextBar.open * (1 + friction);
          const notional = cash * institutionalConfig.allocation_fraction;
          const qty = Math.floor(notional / entryPrice);
          if (qty > 0) {
            const entryFee = Math.max(institutionalConfig.minimum_commission, qty * entryPrice * institutionalConfig.commission_rate);
            if (cash >= qty * entryPrice + entryFee) {
              cash -= qty * entryPrice + entryFee;
              inPos = true;
              entryIdx = i + 1;
              activeTrd = { qty, entryPrice, entryTime: nextBar.timestamp, entryFee };
            }
          }
        }
      }
    }
  }
  const netPnl = trades.reduce((a, t) => a + t.net_pnl, 0);
  const wins = trades.filter((t) => t.net_pnl > 0).length;
  console.log(`[Challenge 2: Inverted Placebo] Trades: ${trades.length} | Net PnL: €${netPnl.toFixed(2)} | Wins: ${wins}/${trades.length}`);
  return { netPnl, trades: trades.length, survived: netPnl < 0 }; // Placebo should LOSE money if mechanism is real!
}

// 3. Execution Stress Challenge: Spread = 20 bps, Slippage = 6 bps
function runExecutionStressChallenge() {
  const stressConfig: ExecutionConfig = {
    ...institutionalConfig,
    round_trip_spread_bps: 20.0, // Double spread
    slippage_bps_per_side: 6.0,  // Triple slippage (total 32 bps round trip friction!)
  };
  const res = runBacktest5m(features, exp1Candidate, stressConfig, devSessions);
  const netPnl = res.trades.reduce((a, t) => a + t.net_pnl, 0);
  const wins = res.trades.filter((t) => t.net_pnl > 0).length;
  console.log(`[Challenge 3: Execution Stress (32 bps friction)] Trades: ${res.trades.length} | Net PnL: €${netPnl.toFixed(2)} | Wins: ${wins}/${res.trades.length}`);
  return { netPnl, trades: res.trades.length, survived: netPnl > 0 };
}

// 4. Concentration Challenge: Remove the best trade
function runConcentrationChallenge() {
  const trades = [...exp1ResInst.trades].sort((a, b) => b.net_pnl - a.net_pnl);
  if (trades.length <= 1) {
    console.log('[Challenge 4: Concentration] Too few trades to evaluate concentration.');
    return { survived: false, reason: 'Too few trades' };
  }
  const bestTrade = trades[0];
  const remainingTrades = trades.slice(1);
  const remainingNetPnl = remainingTrades.reduce((a, t) => a + t.net_pnl, 0);
  console.log(`[Challenge 4: Concentration] Best Trade PnL: €${bestTrade.net_pnl.toFixed(2)} | Remaining ${remainingTrades.length} Trades Net PnL: €${remainingNetPnl.toFixed(2)}`);
  return { bestTradePnl: bestTrade.net_pnl, remainingNetPnl, survived: remainingNetPnl > 0 };
}

// 5. Calendar Regime Split: First 20 sessions vs Second 20 sessions
function runRegimeChallenge() {
  const sList = Array.from(devSessions).sort();
  const reg1Sessions = new Set(sList.slice(0, 20));
  const reg2Sessions = new Set(sList.slice(20, 40));

  const res1 = runBacktest5m(features, exp1Candidate, institutionalConfig, reg1Sessions);
  const res2 = runBacktest5m(features, exp1Candidate, institutionalConfig, reg2Sessions);

  const pnl1 = res1.trades.reduce((a, t) => a + t.net_pnl, 0);
  const pnl2 = res2.trades.reduce((a, t) => a + t.net_pnl, 0);

  console.log(`[Challenge 5: Regime Split] Period 1 (Sessions 1-20): ${res1.trades.length} trades, Net PnL: €${pnl1.toFixed(2)}`);
  console.log(`[Challenge 5: Regime Split] Period 2 (Sessions 21-40): ${res2.trades.length} trades, Net PnL: €${pnl2.toFixed(2)}`);
  return { pnl1, pnl2, survived: pnl1 > 0 && pnl2 >= 0 };
}

// 6. Benchmark Comparison: Compare against Buy-and-Hold over same sessions
function runBenchmarkComparison() {
  const sList = Array.from(devSessions).sort();
  let bnhGross = 0;
  for (const sDate of sList) {
    const sBars = features.filter((f) => f.session_date === sDate);
    if (sBars.length === 0) continue;
    const dayReturn = (sBars[sBars.length - 1].close - sBars[0].open) / sBars[0].open;
    bnhGross += dayReturn;
  }
  console.log(`[Challenge 6: Benchmark] Unconditional Intraday Buy-and-Hold Cumulative Return: ${(bnhGross * 100).toFixed(2)}%`);
  return { bnhGross };
}

const c1 = runTimingChallenge();
const c2 = runPlaceboChallenge();
const c3 = runExecutionStressChallenge();
const c4 = runConcentrationChallenge();
const c5 = runRegimeChallenge();
const c6 = runBenchmarkComparison();

console.log('\n================================================================');
console.log('SUMMARY OF ALL THREE UNCONVENTIONAL EXPERIMENTS');
console.log('================================================================');
console.log(`Exp 1 (Sector Lead-Lag Catch-Up):`);
console.log(`  Retail (€10k): Trades=${exp1ResRetail.trades.length}, NetPnL=€${exp1MetricsRetail.total_net_pnl.toFixed(2)}`);
console.log(`  Inst   (€50k): Trades=${exp1ResInst.trades.length}, NetPnL=€${exp1MetricsInst.total_net_pnl.toFixed(2)}, WinRate=${(exp1MetricsInst.win_rate*100).toFixed(1)}%`);
console.log(`Exp 2 (Volume Absorption / Low Displacement Reversal):`);
console.log(`  Retail (€10k): Trades=${exp2ResRetail.trades.length}, NetPnL=€${exp2MetricsRetail.total_net_pnl.toFixed(2)}`);
console.log(`  Inst   (€50k): Trades=${exp2ResInst.trades.length}, NetPnL=€${exp2MetricsInst.total_net_pnl.toFixed(2)}`);
console.log(`Exp 3 (Filtered Breakout / Rejection Rule):`);
console.log(`  Retail (€10k): Trades=${exp3ResRetail.trades.length}, NetPnL=€${exp3MetricsRetail.total_net_pnl.toFixed(2)}`);
console.log(`  Inst   (€50k): Trades=${exp3ResInst.trades.length}, NetPnL=€${exp3MetricsInst.total_net_pnl.toFixed(2)}`);
