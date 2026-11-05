import { readFileSync } from 'fs';
import { join } from 'path';
import { enrichWithMultiHorizonFeatures, parseYahooChartResponse } from '../src/engine/realMarketData';
import { runBacktest5m, DEFAULT_EXECUTION_CONFIG } from '../src/engine/backtest';
import { summarizePerformance } from '../src/engine/statistics';
import { Candidate, ExecutionConfig, FeatureRow, Trade } from '../src/types';

const cachePath = join(process.cwd(), 'server_data', 'real_market_cache.json');
const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));
const bars5m = parseYahooChartResponse(raw.ucg, raw.banking_etf, raw.ftse_mib);
const features = enrichWithMultiHorizonFeatures(bars5m);

const allSessions = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
const devSessions = new Set(allSessions.slice(0, 40));

console.log('================================================================');
console.log('CAMPAIGN 2: BOUNDED ADVERSARIAL EXPERIMENTS (TRIALS 9, 10, 11)');
console.log('================================================================');

const instCfg: ExecutionConfig = {
  ...DEFAULT_EXECUTION_CONFIG,
  initial_cash: 50000,
  allocation_fraction: 0.25,
  holding_minutes: 60,
};

const retailCfg: ExecutionConfig = {
  ...DEFAULT_EXECUTION_CONFIG,
  initial_cash: 10000,
  allocation_fraction: 0.25,
  holding_minutes: 60,
};

// -------------------------------------------------------------
// TRIAL 9: Alternative Prediction Objective - False Catch-Up Filter
// -------------------------------------------------------------
console.log('\n--- TRIAL 9: Anti-Signal / False Catch-Up Filter (Alternative Objective) ---');
// Predict when UCG is UNLIKELY to catch up:
// If UCG is lagging the sector (spread <= -0.0035), BUT UCG itself is in freefall (ret_15m < -0.004)
// or MIB index is down, UCG's lag is structural Italian risk, NOT transient delay!
// Only trigger when ret_15m >= -0.003 (stable consolidation, not freefall).
const trial9Candidate: Candidate = {
  id: 'exp9_filtered_catchup',
  kind: 'rule',
  name: 'sector_lead_lag',
  description: 'Catch-up trade with False-Lag Anti-Filter: suppresses entry if UCG is in freefall (ret_15m < -0.003)',
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

// Custom backtest function for Trial 9
function runTrial9(cfg: ExecutionConfig, sessions: Set<string>) {
  const sessionDates = Array.from(sessions).sort();
  let cash = cfg.initial_cash;
  const trades: Trade[] = [];
  const dailyEquityRows: any[] = [];
  let tCounter = 1;

  for (const sDate of sessionDates) {
    const sBars = features.filter((f) => f.session_date === sDate);
    if (sBars.length === 0) continue;
    let sPnl = 0;
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
          cash += notional - exitFee;
          sPnl += netPnl;
          trades.push({
            id: `T9-${tCounter++}`,
            candidate_id: trial9Candidate.id,
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
            holding_duration_minutes: (i - entryIdx) * 5,
          });
          inPos = false;
        }
      } else if (!inPos && i >= 12 && i <= sBars.length - 15) {
        const f = sBars[i];
        // ANTI-FILTER: Require stable consolidation, not freefall!
        if (
          f.sector_spread_15m !== undefined &&
          f.sector_spread_15m <= -0.0035 &&
          f.rvol >= 1.2 &&
          f.ret_15m >= -0.003 // ANTI-FREEFALL RULE
        ) {
          const nextBar = sBars[i + 1];
          if (nextBar) {
            const friction = (cfg.round_trip_spread_bps / 2 + cfg.slippage_bps_per_side) / 10000;
            const entryPrice = nextBar.open * (1 + friction);
            const notional = cash * cfg.allocation_fraction;
            const qty = Math.floor(notional / entryPrice);
            if (qty > 0) {
              const entryFee = Math.max(cfg.minimum_commission, qty * entryPrice * cfg.commission_rate);
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
    dailyEquityRows.push({ session_date: sDate, equity: cash, daily_return: 0, net_pnl: sPnl, trade_count: 0, drawdown_pct: 0 });
  }
  return { trades, equity: dailyEquityRows };
}

const t9Inst = runTrial9(instCfg, devSessions);
const t9Retail = runTrial9(retailCfg, devSessions);
const t9MetricsInst = summarizePerformance(t9Inst.equity, t9Inst.trades, instCfg.initial_cash);
const t9MetricsRetail = summarizePerformance(t9Retail.equity, t9Retail.trades, retailCfg.initial_cash);

console.log(`[Trial 9 Inst]   Trades: ${t9Inst.trades.length} | Net PnL: €${t9MetricsInst.total_net_pnl.toFixed(2)} | WinRate: ${(t9MetricsInst.win_rate * 100).toFixed(1)}% | ProfitFactor: ${t9MetricsInst.profit_factor}`);
console.log(`[Trial 9 Retail] Trades: ${t9Retail.trades.length} | Net PnL: €${t9MetricsRetail.total_net_pnl.toFixed(2)} | WinRate: ${(t9MetricsRetail.win_rate * 100).toFixed(1)}% | ProfitFactor: ${t9MetricsRetail.profit_factor}`);

// -------------------------------------------------------------
// TRIAL 10: US Cash Open Transatlantic Impulse (15:35 CET)
// -------------------------------------------------------------
console.log('\n--- TRIAL 10: US Cash Open Transatlantic Impulse (Direction D) ---');
// Mechanism: At 15:30 CET, US equity markets open. In banking equities, US opening order flow triggers
// a sharp directional acceleration. If UCG has established an intraday trend (close > VWAP, ret_60m > 0),
// buying at 15:35 CET and holding until 17:00 CET rides US institutional allocation flows.
function runTrial10(cfg: ExecutionConfig, sessions: Set<string>) {
  const sessionDates = Array.from(sessions).sort();
  let cash = cfg.initial_cash;
  const trades: Trade[] = [];
  const dailyEquityRows: any[] = [];
  let tCounter = 1;

  for (const sDate of sessionDates) {
    const sBars = features.filter((f) => f.session_date === sDate);
    if (sBars.length === 0) continue;
    let sPnl = 0;
    let inPos = false;
    let activeTrd: any = null;
    let entryIdx = -1;

    for (let i = 0; i < sBars.length; i++) {
      const b = sBars[i];
      if (inPos) {
        if (i >= entryIdx + 17 || i >= sBars.length - 2) { // Hold ~85 mins until 17:00 CET
          const friction = (cfg.round_trip_spread_bps / 2 + cfg.slippage_bps_per_side) / 10000;
          const exitPrice = b.open * (1 - friction);
          const notional = activeTrd.qty * exitPrice;
          const exitFee = Math.max(cfg.minimum_commission, notional * cfg.commission_rate);
          const grossPnl = activeTrd.qty * (exitPrice - activeTrd.entryPrice);
          const netPnl = grossPnl - activeTrd.entryFee - exitFee;
          cash += notional - exitFee;
          sPnl += netPnl;
          trades.push({
            id: `T10-${tCounter++}`,
            candidate_id: 'exp10_us_open_impulse',
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
            holding_duration_minutes: (i - entryIdx) * 5,
          });
          inPos = false;
        }
      } else if (!inPos && b.minute_of_day === 390) { // 15:30 CET bar close -> enter at 15:35 CET
        if (b.close > b.vwap && b.ret_60m > 0.002 && b.rvol >= 1.1) {
          const nextBar = sBars[i + 1];
          if (nextBar) {
            const friction = (cfg.round_trip_spread_bps / 2 + cfg.slippage_bps_per_side) / 10000;
            const entryPrice = nextBar.open * (1 + friction);
            const notional = cash * cfg.allocation_fraction;
            const qty = Math.floor(notional / entryPrice);
            if (qty > 0) {
              const entryFee = Math.max(cfg.minimum_commission, qty * entryPrice * cfg.commission_rate);
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
    dailyEquityRows.push({ session_date: sDate, equity: cash, daily_return: 0, net_pnl: sPnl, trade_count: 0, drawdown_pct: 0 });
  }
  return { trades, equity: dailyEquityRows };
}

const t10Inst = runTrial10(instCfg, devSessions);
const t10Retail = runTrial10(retailCfg, devSessions);
const t10MetricsInst = summarizePerformance(t10Inst.equity, t10Inst.trades, instCfg.initial_cash);
const t10MetricsRetail = summarizePerformance(t10Retail.equity, t10Retail.trades, retailCfg.initial_cash);

console.log(`[Trial 10 Inst]   Trades: ${t10Inst.trades.length} | Net PnL: €${t10MetricsInst.total_net_pnl.toFixed(2)} | WinRate: ${(t10MetricsInst.win_rate * 100).toFixed(1)}% | ProfitFactor: ${t10MetricsInst.profit_factor}`);
console.log(`[Trial 10 Retail] Trades: ${t10Retail.trades.length} | Net PnL: €${t10MetricsRetail.total_net_pnl.toFixed(2)} | WinRate: ${(t10MetricsRetail.win_rate * 100).toFixed(1)}% | ProfitFactor: ${t10MetricsRetail.profit_factor}`);

// -------------------------------------------------------------
// TRIAL 11: Sequential Volume Climax & Range Recapture (Direction C)
// -------------------------------------------------------------
console.log('\n--- TRIAL 11: Sequential Volume Climax & Range Recapture (Direction C) ---');
// Mechanism: Heavy morning volume selling climax (RVOL >= 1.6, gap down) followed by range compression
// and subsequent reclaim of intraday VWAP.
function runTrial11(cfg: ExecutionConfig, sessions: Set<string>) {
  const sessionDates = Array.from(sessions).sort();
  let cash = cfg.initial_cash;
  const trades: Trade[] = [];
  const dailyEquityRows: any[] = [];
  let tCounter = 1;

  for (const sDate of sessionDates) {
    const sBars = features.filter((f) => f.session_date === sDate);
    if (sBars.length === 0) continue;
    let sPnl = 0;
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
          cash += notional - exitFee;
          sPnl += netPnl;
          trades.push({
            id: `T11-${tCounter++}`,
            candidate_id: 'exp11_sequential_climax_reversal',
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
            holding_duration_minutes: (i - entryIdx) * 5,
          });
          inPos = false;
        }
      } else if (!inPos && i >= 12 && i <= sBars.length - 15) {
        // Condition: Prior bar was below VWAP, current bar crosses above VWAP with RVOL >= 1.3 after a morning dip
        const prevB = sBars[i - 1];
        if (
          prevB.close < prevB.vwap &&
          b.close > b.vwap &&
          b.rvol >= 1.3 &&
          b.minute_of_day >= 60 &&
          b.minute_of_day <= 300
        ) {
          const nextBar = sBars[i + 1];
          if (nextBar) {
            const friction = (cfg.round_trip_spread_bps / 2 + cfg.slippage_bps_per_side) / 10000;
            const entryPrice = nextBar.open * (1 + friction);
            const notional = cash * cfg.allocation_fraction;
            const qty = Math.floor(notional / entryPrice);
            if (qty > 0) {
              const entryFee = Math.max(cfg.minimum_commission, qty * entryPrice * cfg.commission_rate);
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
    dailyEquityRows.push({ session_date: sDate, equity: cash, daily_return: 0, net_pnl: sPnl, trade_count: 0, drawdown_pct: 0 });
  }
  return { trades, equity: dailyEquityRows };
}

const t11Inst = runTrial11(instCfg, devSessions);
const t11Retail = runTrial11(retailCfg, devSessions);
const t11MetricsInst = summarizePerformance(t11Inst.equity, t11Inst.trades, instCfg.initial_cash);
const t11MetricsRetail = summarizePerformance(t11Retail.equity, t11Retail.trades, retailCfg.initial_cash);

console.log(`[Trial 11 Inst]   Trades: ${t11Inst.trades.length} | Net PnL: €${t11MetricsInst.total_net_pnl.toFixed(2)} | WinRate: ${(t11MetricsInst.win_rate * 100).toFixed(1)}% | ProfitFactor: ${t11MetricsInst.profit_factor}`);
console.log(`[Trial 11 Retail] Trades: ${t11Retail.trades.length} | Net PnL: €${t11MetricsRetail.total_net_pnl.toFixed(2)} | WinRate: ${(t11MetricsRetail.win_rate * 100).toFixed(1)}% | ProfitFactor: ${t11MetricsRetail.profit_factor}`);
