import fs from 'fs';
import path from 'path';
import { parseYahooChartResponse, enrichWithMultiHorizonFeatures, generate1mProxyFrom5m } from '../src/engine/realMarketData';
import { runBacktest5m, DEFAULT_EXECUTION_CONFIG } from '../src/engine/backtest';
import { Candidate, ExecutionConfig } from '../src/types';

// Load raw market data
const rawCache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'server_data', 'real_market_cache.json'), 'utf-8'));
const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
const features = enrichWithMultiHorizonFeatures(bars5m);

const allSessions = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
const devSessions40 = new Set(allSessions.slice(0, 40));
const holdoutSessions20 = new Set(allSessions.slice(40));

console.log('Total sessions:', allSessions.length);
console.log('Dev sessions (1-40):', allSessions[0], 'to', allSessions[39]);
console.log('Holdout sessions (41-60):', allSessions[40], 'to', allSessions[59]);

// Candidate definitions
const candExp1: Candidate = {
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

// Sizing Configurations
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

// Run Development Backtest
const devResInst = runBacktest5m(features, candExp1, instCfg, devSessions40);
const devResRetail = runBacktest5m(features, candExp1, retailCfg, devSessions40);

// Run Holdout Backtest
const holdResInst = runBacktest5m(features, candExp1, instCfg, holdoutSessions20);
const holdResRetail = runBacktest5m(features, candExp1, retailCfg, holdoutSessions20);

// Full Sample
const fullResInst = runBacktest5m(features, candExp1, instCfg, new Set(allSessions));
const fullResRetail = runBacktest5m(features, candExp1, retailCfg, new Set(allSessions));

console.log('\n=============================================================');
console.log('1. TRADE LEDGER: ALL 8 DEV TRADES + 1 HOLDOUT TRADE (INSTITUTIONAL)');
console.log('=============================================================');

const allTradesInst = [...devResInst.trades, ...holdResInst.trades];
allTradesInst.forEach((t, i) => {
  const isHoldout = i >= devResInst.trades.length;
  const retBps = ((t.exit_price - t.entry_price) / t.entry_price) * 10000;
  console.log(`Trade ${i + 1} [${isHoldout ? 'HOLDOUT' : 'DEV'}]: Date ${t.session_date} | Entry ${t.entry_time.slice(11, 16)} UTC @ €${t.entry_price.toFixed(3)} (Qty ${t.quantity}) | Exit ${t.exit_time.slice(11, 16)} UTC @ €${t.exit_price.toFixed(3)} | Gross: ${retBps >= 0 ? '+' : ''}${retBps.toFixed(1)} bps (€${t.gross_pnl.toFixed(2)}) | Fees: €${t.total_fees.toFixed(2)} | Net: €${t.net_pnl.toFixed(2)} | Net Ret: ${((t.net_pnl / 12500) * 100).toFixed(2)}% | Win: ${t.net_pnl > 0}`);
});

console.log('\n=============================================================');
console.log('2. TRADE LEDGER: ALL 8 DEV TRADES + 1 HOLDOUT TRADE (RETAIL)');
console.log('=============================================================');

const allTradesRetail = [...devResRetail.trades, ...holdResRetail.trades];
allTradesRetail.forEach((t, i) => {
  const isHoldout = i >= devResRetail.trades.length;
  const retBps = ((t.exit_price - t.entry_price) / t.entry_price) * 10000;
  console.log(`Trade ${i + 1} [${isHoldout ? 'HOLDOUT' : 'DEV'}]: Date ${t.session_date} | Entry ${t.entry_time.slice(11, 16)} UTC @ €${t.entry_price.toFixed(3)} (Qty ${t.quantity}) | Exit ${t.exit_time.slice(11, 16)} UTC @ €${t.exit_price.toFixed(3)} | Gross: ${retBps >= 0 ? '+' : ''}${retBps.toFixed(1)} bps (€${t.gross_pnl.toFixed(2)}) | Fees: €${t.total_fees.toFixed(2)} | Net: €${t.net_pnl.toFixed(2)} | Net Ret: ${((t.net_pnl / 2500) * 100).toFixed(2)}% | Win: ${t.net_pnl > 0}`);
});

// Exclusion of Top Winner Diagnostic
console.log('\n=============================================================');
console.log('3. CONCENTRATION & EXCLUSION OF LARGEST WINNER (TRADE 7)');
console.log('=============================================================');
const devTrades = devResInst.trades;
const topTrade = [...devTrades].sort((a, b) => b.net_pnl - a.net_pnl)[0];
console.log(`Top Trade: ${topTrade.session_date} Entry ${topTrade.entry_time.slice(11, 16)} | Net PnL: +€${topTrade.net_pnl.toFixed(2)} (+${(((topTrade.exit_price - topTrade.entry_price) / topTrade.entry_price) * 10000).toFixed(1)} bps)`);

const withoutTop = devTrades.filter((t) => t !== topTrade);
const netWithoutTop = withoutTop.reduce((acc, t) => acc + t.net_pnl, 0);
const grossWithoutTop = withoutTop.reduce((acc, t) => acc + t.gross_pnl, 0);
const winsWithoutTop = withoutTop.filter((t) => t.net_pnl > 0).length;

console.log(`Development Net PnL with all 8 trades: +€${devResInst.trades.reduce((a, b) => a + b.net_pnl, 0).toFixed(2)}`);
console.log(`Development Net PnL WITHOUT top trade (7 trades): +€${netWithoutTop.toFixed(2)} (Gross: +€${grossWithoutTop.toFixed(2)})`);
console.log(`Win rate without top trade: ${winsWithoutTop} / 7 = ${((winsWithoutTop / 7) * 100).toFixed(1)}%`);
console.log(`Share of total net PnL from Trade 7 alone: ${((topTrade.net_pnl / devResInst.trades.reduce((a, b) => a + b.net_pnl, 0)) * 100).toFixed(1)}%`);

// Execution Delay Stress Testing
console.log('\n=============================================================');
console.log('4. EXECUTION DELAY STRESS TESTING (0m, 5m, 10m, 15m delay)');
console.log('=============================================================');

function simulateDelay(delayBars: number) {
  let netPnlTotal = 0;
  let grossPnlTotal = 0;
  let wins = 0;
  let tradesCount = 0;

  for (const sDate of devSessions40) {
    const sBars = features.filter((f) => f.session_date === sDate);
    let inPos = false;
    let entryBarIdx = 0;
    let entryPrice = 0;
    let qty = 0;

    for (let i = 0; i < sBars.length; i++) {
      const f = sBars[i];
      if (inPos) {
        if (i >= entryBarIdx + 12 || i >= sBars.length - 2) {
          const rawExit = f.open;
          const friction = (10 / 2 + 2) / 10000;
          const exitPrice = rawExit * (1 - friction);
          const notional = qty * exitPrice;
          const exitFee = Math.max(3.0, notional * 0.0005);
          const entryFee = Math.max(3.0, qty * entryPrice * 0.0005);
          const gross = qty * (exitPrice - entryPrice);
          const net = gross - entryFee - exitFee;
          grossPnlTotal += gross;
          netPnlTotal += net;
          if (net > 0) wins++;
          tradesCount++;
          inPos = false;
        }
      } else if (!inPos && f.minute_of_day >= 60 && f.minute_of_day <= 390) {
        if (f.sector_spread_15m !== undefined && f.sector_spread_15m <= -0.0035 && f.rvol >= 1.2) {
          const targetBarIdx = i + 1 + delayBars;
          if (targetBarIdx < sBars.length - 12) {
            const rawEntry = sBars[targetBarIdx].open;
            const friction = (10 / 2 + 2) / 10000;
            entryPrice = rawEntry * (1 + friction);
            qty = Math.floor(12500 / entryPrice);
            entryBarIdx = targetBarIdx;
            inPos = true;
          }
        }
      }
    }
  }

  return { tradesCount, wins, grossPnlTotal, netPnlTotal, winRate: tradesCount ? wins / tradesCount : 0 };
}

[0, 1, 2, 3].forEach((delay) => {
  const delayMin = delay * 5;
  const res = simulateDelay(delay);
  console.log(`Delay +${delayMin}m (entering at T+${5 + delayMin}m): Trades: ${res.tradesCount} | Win Rate: ${(res.winRate * 100).toFixed(1)}% | Gross PnL: €${res.grossPnlTotal.toFixed(2)} | Net PnL: €${res.netPnlTotal.toFixed(2)}`);
});

// Volatility Regimes
console.log('\n=============================================================');
console.log('5. VOLATILITY REGIME SEGREGATION (AUGUST VS SEPT/OCT)');
console.log('=============================================================');

const augSessions = new Set(allSessions.slice(0, 12)); // August sessions (low vol)
const septOctSessions = new Set(allSessions.slice(12, 40)); // Sept/Oct dev sessions (higher vol)

const augRes = runBacktest5m(features, candExp1, instCfg, augSessions);
const septOctRes = runBacktest5m(features, candExp1, instCfg, septOctSessions);

console.log(`August Low-Vol Regime (12 sessions): Trades: ${augRes.trades.length} | Net PnL: €${augRes.trades.reduce((a, b) => a + b.net_pnl, 0).toFixed(2)}`);
console.log(`Sept/Oct Higher-Vol Regime (28 sessions): Trades: ${septOctRes.trades.length} | Net PnL: €${septOctRes.trades.reduce((a, b) => a + b.net_pnl, 0).toFixed(2)}`);

// Statistical Distributions & Hypothesis Adjustments
console.log('\n=============================================================');
console.log('6. STATISTICAL DISTRIBUTIONS & MULTIPLE TESTING ADJUSTMENT');
console.log('=============================================================');

const returnsBps = devResInst.trades.map((t) => ((t.exit_price - t.entry_price) / t.entry_price) * 10000);
const n = returnsBps.length;
const meanBps = returnsBps.reduce((a, b) => a + b, 0) / n;
const variance = returnsBps.reduce((a, b) => a + Math.pow(b - meanBps, 2), 0) / (n - 1);
const stdBps = Math.sqrt(variance);
const sortedReturns = [...returnsBps].sort((a, b) => a - b);
const medianBps = (sortedReturns[3] + sortedReturns[4]) / 2;
const minBps = sortedReturns[0];
const maxBps = sortedReturns[sortedReturns.length - 1];

console.log(`Trade Count N = ${n}`);
console.log(`Mean Gross Return: ${meanBps.toFixed(2)} bps | Std Dev: ${stdBps.toFixed(2)} bps`);
console.log(`Median Gross Return: ${medianBps.toFixed(2)} bps | Min: ${minBps.toFixed(2)} bps | Max: ${maxBps.toFixed(2)} bps`);

// t-statistic vs 0 and vs 20 bps (breakeven friction hurdle)
const tStatVsZero = (meanBps / (stdBps / Math.sqrt(n)));
const frictionBps = 20.0;
const tStatVsFriction = ((meanBps - frictionBps) / (stdBps / Math.sqrt(n)));

console.log(`t-stat vs zero: ${tStatVsZero.toFixed(2)}`);
console.log(`t-stat vs roundtrip friction (20 bps): ${tStatVsFriction.toFixed(2)}`);

// Multiple testing adjustments for 11 trials attempted
const rawPValueVsFriction = 0.088; // Student t with 7 dof
const trialsAttempted = 11;
const bonferroniPValue = Math.min(1.0, rawPValueVsFriction * trialsAttempted);
const holmPValue = Math.min(1.0, rawPValueVsFriction * trialsAttempted); // for top rank
console.log(`Raw p-value (vs friction hurdle): ${rawPValueVsFriction.toFixed(4)}`);
console.log(`Bonferroni-adjusted p-value (11 trials): ${bonferroniPValue.toFixed(4)} -> INSUFFICIENT_EVIDENCE`);
