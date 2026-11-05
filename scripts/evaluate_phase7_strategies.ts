import fs from 'fs';
import { parseYahooChartResponse, enrichWithMultiHorizonFeatures, generate1mProxyFrom5m } from '../src/engine/realMarketData';
import { DEFAULT_EXECUTION_CONFIG, runBacktest } from '../src/engine/backtest';
import { summarizePerformance, assessEvidence, blockBootstrapMeanCI } from '../src/engine/statistics';
import { Bar1m, Bar5m, Candidate, ExecutionConfig, FeatureRow } from '../src/types';

// Forensic script for Phase 7:
// 1. Reconcile sessions and bars
// 2. Evaluate existing 4 candidates on development partition
// 3. Evaluate expanded hypothesis candidates (60m-120m holding, volume acceleration, sector momentum, decision tree)
// 4. Test friction sensitivities & notional sizing (€2.5k, €5k, €10k, €20k)
// 5. Test against benchmarks

function main() {
  console.log('=== PHASE 7 EMPIRICAL FORENSIC EVALUATION ===');
  const rawCache = JSON.parse(fs.readFileSync('server_data/real_market_cache.json', 'utf-8'));
  const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
  const bars1m = generate1mProxyFrom5m(bars5m);
  const features = enrichWithMultiHorizonFeatures(bars5m);

  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
  console.log(`Total 5m bars: ${bars5m.length}`);
  console.log(`Total sessions: ${sessionDates.length} (${sessionDates[0]} to ${sessionDates[sessionDates.length - 1]})`);

  // Development vs Holdout partition
  // 30 sessions reserved for holdout, leaving first 30 sessions for development
  const devSessions = new Set(sessionDates.slice(0, 30));
  const holdoutSessions = new Set(sessionDates.slice(30));
  console.log(`Development sessions: ${devSessions.size} (${sessionDates[0]} to ${sessionDates[29]})`);
  console.log(`Holdout sessions (FROZEN): ${holdoutSessions.size} (${sessionDates[30]} to ${sessionDates[59]})`);

  // Test Candidate List
  const testCandidates: { candidate: Candidate; holdingMinutes: number; name: string }[] = [
    // Existing 4 candidates (30m holding)
    {
      name: 'Trend Pullback (30m)',
      holdingMinutes: 30,
      candidate: {
        id: 'pullback_v1',
        kind: 'rule',
        name: 'trend_pullback',
        description: 'Pullback recovery above VWAP (30m holding)',
        parameters: { rvol_threshold: 1.25, vwap_filter: true, min_minute: 45, max_minute: 450 },
        score_threshold: 0.0,
      },
    },
    {
      name: 'Opening Breakout (30m)',
      holdingMinutes: 30,
      candidate: {
        id: 'breakout_v1',
        kind: 'rule',
        name: 'opening_breakout',
        description: 'Opening range breakout with expanding RVOL (30m holding)',
        parameters: { rvol_threshold: 1.4, min_minute: 35, max_minute: 240 },
        score_threshold: 0.0,
      },
    },
    {
      name: 'Mean Reversion (30m)',
      holdingMinutes: 30,
      candidate: {
        id: 'mean_reversion_v1',
        kind: 'rule',
        name: 'mean_reversion',
        description: 'Oversold VWAP mean reversion (30m holding)',
        parameters: { vwap_deviation_pct: -0.007, rvol_threshold: 1.3, min_minute: 60, max_minute: 420 },
        score_threshold: 0.0,
      },
    },
    {
      name: 'Ridge Regression (30m)',
      holdingMinutes: 30,
      candidate: {
        id: 'ridge_v1',
        kind: 'model',
        name: 'ridge_v1',
        description: 'Multi-factor linear score (30m holding)',
        parameters: { alpha: 10.0, train_sessions: 60 },
        score_threshold: 0.0002,
      },
    },

    // Expanded Candidates (60m & 120m holding periods)
    {
      name: 'Trend Pullback (60m)',
      holdingMinutes: 60,
      candidate: {
        id: 'pullback_60m',
        kind: 'rule',
        name: 'trend_pullback',
        description: 'Trend pullback with 60m holding horizon',
        parameters: { rvol_threshold: 1.25, vwap_filter: true, min_minute: 45, max_minute: 420 },
        score_threshold: 0.0,
      },
    },
    {
      name: 'Trend Pullback (120m)',
      holdingMinutes: 120,
      candidate: {
        id: 'pullback_120m',
        kind: 'rule',
        name: 'trend_pullback',
        description: 'Trend pullback with 120m holding horizon',
        parameters: { rvol_threshold: 1.25, vwap_filter: true, min_minute: 45, max_minute: 360 },
        score_threshold: 0.0,
      },
    },
    {
      name: 'Mean Reversion (60m)',
      holdingMinutes: 60,
      candidate: {
        id: 'mean_reversion_60m',
        kind: 'rule',
        name: 'mean_reversion',
        description: 'Mean reversion with 60m holding horizon',
        parameters: { vwap_deviation_pct: -0.007, rvol_threshold: 1.3, min_minute: 60, max_minute: 420 },
        score_threshold: 0.0,
      },
    },
    {
      name: 'Mean Reversion (120m)',
      holdingMinutes: 120,
      candidate: {
        id: 'mean_reversion_120m',
        kind: 'rule',
        name: 'mean_reversion',
        description: 'Mean reversion with 120m holding horizon',
        parameters: { vwap_deviation_pct: -0.007, rvol_threshold: 1.3, min_minute: 60, max_minute: 360 },
        score_threshold: 0.0,
      },
    },
  ];

  console.log('\n--- EVALUATING ON DEVELOPMENT DATASET (30 SESSIONS) ---');
  console.log('Capital: €10,000 | Allocation: 25% (€2,500 notional) | Fees: €3.00 min, 5 bps comm, 10 bps spread, 2 bps slip');

  for (const tc of testCandidates) {
    const config: ExecutionConfig = {
      ...DEFAULT_EXECUTION_CONFIG,
      holding_minutes: tc.holdingMinutes,
    };

    const backtest = runBacktest(bars1m, features, tc.candidate, config, devSessions);
    const metrics = summarizePerformance(backtest.equity, backtest.trades, config.initial_cash, 10);
    const evidence = assessEvidence(metrics, false, false, true);

    console.log(`\n[${tc.name}] Trades: ${backtest.trades.length} | Win Rate: ${(metrics.win_rate * 100).toFixed(1)}% | Net Ret: ${(metrics.net_return * 100).toFixed(2)}% | Max DD: ${(metrics.max_drawdown * 100).toFixed(2)}% | Fees: €${metrics.total_fees.toFixed(2)} | CI: [${(metrics.bootstrap_ci.lower * 100).toFixed(3)}%, ${(metrics.bootstrap_ci.upper * 100).toFixed(3)}%] | Status: ${evidence.status}`);
  }

  // Notional Sizing Experiment: €2,500 vs €5,000 vs €10,000 vs €20,000 notional
  console.log('\n--- SIZING SENSITIVITY EXPERIMENT (Trend Pullback 60m & Mean Reversion 60m) ---');
  const notionals = [
    { capital: 10000, alloc: 0.25, notional: 2500, label: '€10k cap @ 25% = €2,500 notional' },
    { capital: 20000, alloc: 0.25, notional: 5000, label: '€20k cap @ 25% = €5,000 notional' },
    { capital: 40000, alloc: 0.25, notional: 10000, label: '€40k cap @ 25% = €10,000 notional' },
    { capital: 80000, alloc: 0.25, notional: 20000, label: '€80k cap @ 25% = €20,000 notional' },
  ];

  for (const n of notionals) {
    const configMR: ExecutionConfig = {
      ...DEFAULT_EXECUTION_CONFIG,
      initial_cash: n.capital,
      allocation_fraction: n.alloc,
      holding_minutes: 60,
    };
    const candMR: Candidate = {
      id: 'mean_reversion_60m',
      kind: 'rule',
      name: 'mean_reversion',
      description: 'Mean Reversion 60m',
      parameters: { vwap_deviation_pct: -0.007, rvol_threshold: 1.3, min_minute: 60, max_minute: 420 },
      score_threshold: 0.0,
    };
    const btMR = runBacktest(bars1m, features, candMR, configMR, devSessions);
    const metMR = summarizePerformance(btMR.equity, btMR.trades, configMR.initial_cash, 10);
    const feePct = (metMR.total_fees / (btMR.trades.length * n.notional * 2 || 1)) * 10000;
    console.log(`[MR-60m | ${n.label}] Net Ret: ${(metMR.net_return * 100).toFixed(2)}% | Total Fees: €${metMR.total_fees.toFixed(2)} (${feePct.toFixed(1)} bps/RT) | Max DD: ${(metMR.max_drawdown * 100).toFixed(2)}% | Win Rate: ${(metMR.win_rate * 100).toFixed(1)}%`);
  }

  // Benchmarks over Dev partition
  console.log('\n--- BENCHMARKS OVER DEV PARTITION ---');
  const devBars5m = bars5m.filter((b) => devSessions.has(b.session_date));
  const bnhStart = devBars5m[0].open;
  const bnhEnd = devBars5m[devBars5m.length - 1].close;
  const bnhRet = (bnhEnd - bnhStart) / bnhStart;
  console.log(`Buy and Hold (Dev): ${(bnhRet * 100).toFixed(2)}% (from €${bnhStart} to €${bnhEnd})`);
}

main();
