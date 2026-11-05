import { readFileSync } from 'fs';
import { join } from 'path';
import { enrichWithMultiHorizonFeatures, generate1mProxyFrom5m, parseYahooChartResponse } from '../src/engine/realMarketData';
import { runBacktest, runBacktest5m, DEFAULT_EXECUTION_CONFIG } from '../src/engine/backtest';
import { REGISTERED_CANDIDATES } from '../src/engine/strategies';

const cachePath = join(process.cwd(), 'server_data', 'real_market_cache.json');
const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));
const bars5m = parseYahooChartResponse(raw.ucg, raw.banking_etf, raw.ftse_mib);
const features = enrichWithMultiHorizonFeatures(bars5m);
const bars1m = generate1mProxyFrom5m(bars5m);

const devSessions = new Set(Array.from(new Set(bars5m.map((b) => b.session_date))).sort().slice(0, 40));

console.log('================================================================');
console.log('COMPARISON: HONEST 5M DIRECT EXECUTION VS 1M PROXY INTERPOLATION');
console.log('================================================================');

for (const cand of REGISTERED_CANDIDATES) {
  const cfg = { ...DEFAULT_EXECUTION_CONFIG, holding_minutes: 60 };
  const res1m = runBacktest(bars1m, features, cand, cfg, devSessions);
  const res5m = runBacktest5m(features, cand, cfg, devSessions);

  const pnl1m = res1m.trades.reduce((a, t) => a + t.net_pnl, 0);
  const pnl5m = res5m.trades.reduce((a, t) => a + t.net_pnl, 0);

  console.log(`\nCandidate: ${cand.id.padEnd(20)} (${cand.name})`);
  console.log(`  1M Proxy: Trades=${res1m.trades.length.toString().padStart(3)} | Net PnL=€${pnl1m.toFixed(2).padStart(8)} | Wins=${res1m.trades.filter(t => t.net_pnl > 0).length}`);
  console.log(`  5M Direct: Trades=${res5m.trades.length.toString().padStart(3)} | Net PnL=€${pnl5m.toFixed(2).padStart(8)} | Wins=${res5m.trades.filter(t => t.net_pnl > 0).length}`);
}
