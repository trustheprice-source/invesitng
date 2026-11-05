import { readFileSync } from 'fs';
import { join } from 'path';
import { enrichWithMultiHorizonFeatures, generate1mProxyFrom5m, parseYahooChartResponse } from '../src/engine/realMarketData';
import { runBacktest, DEFAULT_EXECUTION_CONFIG } from '../src/engine/backtest';
import { REGISTERED_CANDIDATES } from '../src/engine/strategies';

const cachePath = join(process.cwd(), 'server_data', 'real_market_cache.json');
const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));
const bars5m = parseYahooChartResponse(raw.ucg, raw.banking_etf, raw.ftse_mib);
const features = enrichWithMultiHorizonFeatures(bars5m);
const bars1m = generate1mProxyFrom5m(bars5m);

const devSessions = new Set(Array.from(new Set(bars5m.map((b) => b.session_date))).sort().slice(0, 40));

console.log('================================================================');
console.log('INVESTIGATING HOLDING PERIOD BEHAVIOR ACROSS CANDIDATES');
console.log('================================================================');

for (const cand of REGISTERED_CANDIDATES) {
  console.log(`\n--- Candidate: ${cand.id} (${cand.name}) ---`);
  for (const hold of [15, 30, 45, 60, 90, 120]) {
    const cfg = { ...DEFAULT_EXECUTION_CONFIG, holding_minutes: hold };
    const res = runBacktest(bars1m, features, cand, cfg, devSessions);
    const exits = res.trades.map(t => t.exit_reason);
    const reasonCounts: Record<string, number> = {};
    for (const r of exits) reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    const totalNetPnl = res.trades.reduce((a, t) => a + t.net_pnl, 0);
    const avgHoldingTime = res.trades.length > 0 ? (res.trades.reduce((a, t) => a + (t.holding_duration_minutes || hold), 0) / res.trades.length).toFixed(1) : '0';
    console.log(`Hold cfg=${hold.toString().padStart(3)}m | Trades=${res.trades.length.toString().padStart(2)} | Cum Net PnL=€${totalNetPnl.toFixed(2).padStart(8)} | Avg Hold=${avgHoldingTime}m | Exits: ${JSON.stringify(reasonCounts)}`);
  }
}
