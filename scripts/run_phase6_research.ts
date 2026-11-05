import fs from 'fs';
import { DEFAULT_EXECUTION_CONFIG, runBacktest } from '../src/engine/backtest';
import { generate1mProxyFrom5m, enrichWithMultiHorizonFeatures, parseYahooChartResponse } from '../src/engine/realMarketData';
import { assessEvidence, summarizePerformance } from '../src/engine/statistics';
import { REGISTERED_CANDIDATES } from '../src/engine/strategies';
import { runSensitivityAnalysis } from '../src/engine/sensitivity';
import { findHistoricalAnalogs } from '../src/engine/analogs';
import { Candidate, ExecutionConfig } from '../src/types';

function runResearch() {
  console.log('Loading real market cache...');
  const rawCache = JSON.parse(fs.readFileSync('./server_data/real_market_cache.json', 'utf-8'));
  const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
  console.log(`Parsed ${bars5m.length} 5-minute bars.`);

  const features = enrichWithMultiHorizonFeatures(bars5m);
  const bars1m = generate1mProxyFrom5m(bars5m);
  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
  console.log(`Total sessions: ${sessionDates.length} from ${sessionDates[0]} to ${sessionDates[sessionDates.length - 1]}`);

  // 1. Benchmark: Buy and Hold UCG
  const firstPrice = bars5m[0].open;
  const lastPrice = bars5m[bars5m.length - 1].close;
  const buyAndHoldReturn = (lastPrice - firstPrice) / firstPrice;
  console.log(`Buy and Hold UCG return: ${(buyAndHoldReturn * 100).toFixed(2)}% (from €${firstPrice} to €${lastPrice})`);

  // 2. Benchmark: Fixed Intraday Time Rule (buy at 09:30 CET, exit at 17:00 CET daily)
  let fixedCash = 10000;
  let fixedStartEquity = 10000;
  const fixedDailyReturns: number[] = [];
  for (const sDate of sessionDates) {
    const sBars = bars1m.filter((b) => b.session_date === sDate);
    if (sBars.length < 480) continue;
    const entryBar = sBars[30]; // 09:30 CET (minute 30)
    const exitBar = sBars[480]; // 17:00 CET (minute 480)
    const friction = (DEFAULT_EXECUTION_CONFIG.round_trip_spread_bps / 2 + DEFAULT_EXECUTION_CONFIG.slippage_bps_per_side) / 10000;
    const entryP = entryBar.open * (1 + friction);
    const exitP = exitBar.open * (1 - friction);
    const notional = fixedCash * DEFAULT_EXECUTION_CONFIG.allocation_fraction;
    const qty = Math.floor(notional / entryP);
    if (qty > 0) {
      const entryFee = Math.max(3.0, qty * entryP * 0.0005);
      const exitFee = Math.max(3.0, qty * exitP * 0.0005);
      const grossPnl = qty * (exitP - entryP);
      const netPnl = grossPnl - entryFee - exitFee;
      fixedCash += netPnl;
    }
  }
  const fixedTimeReturn = (fixedCash - fixedStartEquity) / fixedStartEquity;
  console.log(`Fixed Intraday Time Rule return: ${(fixedTimeReturn * 100).toFixed(2)}%`);

  // 3. Strategy Runs
  const strategyResults: Record<string, any> = {};

  for (const candidate of REGISTERED_CANDIDATES) {
    console.log(`Testing candidate: ${candidate.id} (${candidate.name})...`);
    const backtest = runBacktest(bars1m, features, candidate, DEFAULT_EXECUTION_CONFIG);
    const metrics = summarizePerformance(backtest.equity, backtest.trades, DEFAULT_EXECUTION_CONFIG.initial_cash, 10);
    const evidence = assessEvidence(metrics, false, false, true);
    const stressMatrix = runSensitivityAnalysis(bars1m, features, candidate, DEFAULT_EXECUTION_CONFIG);

    strategyResults[candidate.id] = {
      candidate,
      trades_count: backtest.trades.length,
      win_rate: metrics.win_rate,
      net_return: metrics.net_return,
      annualized_return: metrics.annualized_return,
      max_drawdown: metrics.max_drawdown,
      profit_factor: metrics.profit_factor,
      total_fees: metrics.total_fees,
      active_day_fraction: metrics.active_day_fraction,
      active_week_fraction: metrics.active_week_fraction,
      longest_no_trade_sessions: metrics.longest_no_trade_sessions,
      bootstrap_ci: metrics.bootstrap_ci,
      status: evidence.status,
      failed_checks: evidence.failed_checks,
      stress_matrix: stressMatrix,
    };
  }

  // 4. Multi-Horizon Forward Return Distribution
  const horizons = [5, 15, 30, 60, 120] as const;
  const horizonStats: Record<number, { mean: number; std: number; posFraction: number; count: number }> = {};
  for (const h of horizons) {
    const key = `fwd_ret_${h}m` as keyof typeof features[0];
    const vals = features.map((f) => f[key] as number | undefined).filter((v): v is number => v !== undefined && isFinite(v));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
    const pos = vals.filter((v) => v > 0).length / vals.length;
    horizonStats[h] = {
      mean,
      std: Math.sqrt(variance),
      posFraction: pos,
      count: vals.length,
    };
  }

  // 5. Historical Pattern Analogs
  const lastFeature = features[features.length - 1];
  const analogs = findHistoricalAnalogs(lastFeature, features, 5);

  const fullReport = {
    generated_at: new Date().toISOString(),
    dataset: {
      symbol: 'UCG.MI',
      exchange: 'MTAA (Euronext Milan)',
      isin: 'IT0005239360',
      total_5m_bars: bars5m.length,
      total_sessions: sessionDates.length,
      earliest_session: sessionDates[0],
      latest_session: sessionDates[sessionDates.length - 1],
      first_price: firstPrice,
      last_price: lastPrice,
    },
    benchmarks: {
      cash_holding: { net_return: 0.0, max_drawdown: 0.0 },
      buy_and_hold: { net_return: buyAndHoldReturn, first_price: firstPrice, last_price: lastPrice },
      fixed_time_rule: { net_return: fixedTimeReturn, net_pnl: fixedCash - fixedStartEquity },
    },
    horizon_statistics: horizonStats,
    strategies: strategyResults,
    analogs_sample: analogs,
  };

  fs.writeFileSync('./server_data/research_execution_results.json', JSON.stringify(fullReport, null, 2));
  console.log('Saved full research results to server_data/research_execution_results.json');
}

runResearch();
