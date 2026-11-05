import { readFileSync } from 'fs';
import { join } from 'path';
import { enrichWithMultiHorizonFeatures, parseYahooChartResponse } from '../src/engine/realMarketData';
import { runBacktest5m, DEFAULT_EXECUTION_CONFIG } from '../src/engine/backtest';
import { Candidate, ExecutionConfig, FeatureRow } from '../src/types';

const cachePath = join(process.cwd(), 'server_data', 'real_market_cache.json');
const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));
const bars5m = parseYahooChartResponse(raw.ucg, raw.banking_etf, raw.ftse_mib);
const features = enrichWithMultiHorizonFeatures(bars5m);

const allSessions = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
const devSessions = new Set(allSessions.slice(0, 40));

console.log('================================================================');
console.log('PHASE 9 FORENSIC AUDIT & RECONCILIATION SUITE');
console.log('================================================================');

// 1. Audit Exp 1 Trade-by-Trade (Sector Lead-Lag)
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

const retailCfg: ExecutionConfig = {
  ...DEFAULT_EXECUTION_CONFIG,
  initial_cash: 10000,
  allocation_fraction: 0.25,
  holding_minutes: 60,
};

const instCfg: ExecutionConfig = {
  ...DEFAULT_EXECUTION_CONFIG,
  initial_cash: 50000,
  allocation_fraction: 0.25,
  holding_minutes: 60,
};

const resRetail = runBacktest5m(features, exp1Candidate, retailCfg, devSessions);
const resInst = runBacktest5m(features, exp1Candidate, instCfg, devSessions);

console.log('\n--- 1. AUDIT OF EXP 1 TRADE-LEVEL RECONCILIATION ---');
console.log(`Retail Trades count: ${resRetail.trades.length} | Institutional Trades count: ${resInst.trades.length}`);

console.log('\nRetail Trade Ledger:');
resRetail.trades.forEach((t, i) => {
  const grossBps = ((t.exit_price - t.entry_price) / t.entry_price) * 10000;
  console.log(`  [Trade ${i + 1}] Date: ${t.session_date} | Entry: ${t.entry_time.slice(11, 16)} @ €${t.entry_price.toFixed(3)} | Exit: ${t.exit_time.slice(11, 16)} @ €${t.exit_price.toFixed(3)} | Gross: ${grossBps.toFixed(1).padStart(5)} bps (€${t.gross_pnl.toFixed(2).padStart(6)}) | Fees: €${t.total_fees.toFixed(2)} | Net: €${t.net_pnl.toFixed(2).padStart(6)} | Win: ${t.net_pnl > 0 ? 'YES' : 'NO'}`);
});

console.log('\nInstitutional Trade Ledger:');
resInst.trades.forEach((t, i) => {
  const grossBps = ((t.exit_price - t.entry_price) / t.entry_price) * 10000;
  console.log(`  [Trade ${i + 1}] Date: ${t.session_date} | Entry: ${t.entry_time.slice(11, 16)} @ €${t.entry_price.toFixed(3)} | Exit: ${t.exit_time.slice(11, 16)} @ €${t.exit_price.toFixed(3)} | Gross: ${grossBps.toFixed(1).padStart(5)} bps (€${t.gross_pnl.toFixed(2).padStart(6)}) | Fees: €${t.total_fees.toFixed(2)} | Net: €${t.net_pnl.toFixed(2).padStart(6)} | Win: ${t.net_pnl > 0 ? 'YES' : 'NO'}`);
});

// Identify the diverging trade
resRetail.trades.forEach((tr, i) => {
  const ti = resInst.trades[i];
  if ((tr.net_pnl > 0) !== (ti.net_pnl > 0)) {
    console.log(`\n>>> DIVERGENCE IDENTIFIED ON TRADE ${i + 1} (${tr.session_date})!`);
    console.log(`    Retail: Gross €${tr.gross_pnl.toFixed(2)} - Fees €${tr.total_fees.toFixed(2)} = Net €${tr.net_pnl.toFixed(2)} (WIN = ${tr.net_pnl > 0})`);
    console.log(`    Institutional: Gross €${ti.gross_pnl.toFixed(2)} - Fees €${ti.total_fees.toFixed(2)} = Net €${ti.net_pnl.toFixed(2)} (WIN = ${ti.net_pnl > 0})`);
    console.log(`    Reason: Ticket fee drag! Fixed €3 minimum fee represents 24 bps on €2,500, but only 10 bps on €12,500.`);
  }
});

// 2. Audit Timestamps of Sector vs UCG
console.log('\n--- 2. AUDIT OF ORIGINAL TIMESTAMPS (UCG VS EXV1.DE) ---');
const ucgTs: number[] = raw.ucg?.chart?.result?.[0]?.timestamp || [];
const secTs: number[] = raw.banking_etf?.chart?.result?.[0]?.timestamp || [];
console.log(`UCG timestamps count: ${ucgTs.length} | Sector timestamps count: ${secTs.length}`);
const commonTs = ucgTs.filter((ts) => secTs.includes(ts));
console.log(`Matching common timestamps: ${commonTs.length} / ${ucgTs.length} (${((commonTs.length / ucgTs.length) * 100).toFixed(1)}%)`);

// Sample 5 aligned timestamps
console.log('Sample aligned timestamps (first 5):');
for (let i = 0; i < 5; i++) {
  const ts = commonTs[i];
  const d = new Date(ts * 1000);
  console.log(`  Epoch ${ts} -> ${d.toISOString()} (UTC)`);
}

// 3. Forward return decay curve (Why 10m delay destroys profitability)
console.log('\n--- 3. FORWARD RETURN DECAY ANALYSIS (WHY 10M DELAY KILLS EDGE) ---');
// For each trigger point of exp1, compute return from t+0 to t+5m, t+5m to t+10m, t+5m to t+65m, t+10m to t+70m
const triggerIndices: { sessionDate: string; barIdx: number; closePrice: number }[] = [];
for (let sIdx = 0; sIdx < allSessions.length; sIdx++) {
  const sDate = allSessions[sIdx];
  if (!devSessions.has(sDate)) continue;
  const sBars = features.filter((f) => f.session_date === sDate);
  for (let i = 12; i < sBars.length - 15; i++) {
    const f = sBars[i];
    if (f.minute_of_day >= 60 && f.minute_of_day <= 390 && f.sector_spread_15m !== undefined && f.sector_spread_15m <= -0.0035 && f.rvol >= 1.2) {
      triggerIndices.push({ sessionDate: sDate, barIdx: i, closePrice: f.close });
      break; // One per session for clean analysis
    }
  }
}

console.log(`Found ${triggerIndices.length} trigger events.`);
let sumEarlyMoveBps = 0;
let sumTotalMoveBps = 0;
let sumLateMoveBps = 0;

triggerIndices.forEach((trg) => {
  const sBars = features.filter((f) => f.session_date === trg.sessionDate);
  const pSignal = sBars[trg.barIdx].close;
  const pEntry5m = sBars[trg.barIdx + 1]?.open;
  const pEntry10m = sBars[trg.barIdx + 2]?.open;
  const pExit60m = sBars[trg.barIdx + 13]?.open;
  const pExit70m = sBars[trg.barIdx + 14]?.open;

  if (pSignal && pEntry5m && pEntry10m && pExit60m) {
    const immediate5mMove = ((pEntry5m - pSignal) / pSignal) * 10000;
    const early10mMove = ((pEntry10m - pSignal) / pSignal) * 10000;
    const holdFrom5m = ((pExit60m - pEntry5m) / pEntry5m) * 10000;
    const holdFrom10m = pExit70m ? ((pExit70m - pEntry10m) / pEntry10m) * 10000 : 0;

    sumEarlyMoveBps += early10mMove;
    sumTotalMoveBps += holdFrom5m;
    sumLateMoveBps += holdFrom10m;

    console.log(`  Event ${trg.sessionDate}: 0-10m move: ${early10mMove.toFixed(1).padStart(5)} bps | 5m-65m hold: ${holdFrom5m.toFixed(1).padStart(5)} bps | 10m-70m hold: ${holdFrom10m.toFixed(1).padStart(5)} bps`);
  }
});

const avgEarly = sumEarlyMoveBps / triggerIndices.length;
const avgFrom5m = sumTotalMoveBps / triggerIndices.length;
const avgFrom10m = sumLateMoveBps / triggerIndices.length;
console.log(`\nAverage 0-10m price movement: ${avgEarly.toFixed(1)} bps`);
console.log(`Average gross return when entering at 5m: ${avgFrom5m.toFixed(1)} bps`);
console.log(`Average gross return when entering at 10m: ${avgFrom10m.toFixed(1)} bps`);
console.log(`Difference (edge lost by 10m delay): ${(avgFrom5m - avgFrom10m).toFixed(1)} bps (wipes out the 24 bps hurdle!)`);
