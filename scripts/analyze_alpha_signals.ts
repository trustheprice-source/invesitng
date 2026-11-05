import fs from 'fs';
import { parseYahooChartResponse, enrichWithMultiHorizonFeatures } from '../src/engine/realMarketData';

function analyzeAlphaSignals() {
  const rawCache = JSON.parse(fs.readFileSync('server_data/real_market_cache.json', 'utf-8'));
  const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
  const features = enrichWithMultiHorizonFeatures(bars5m);
  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
  const devDates = sessionDates.slice(0, 30);
  const devFeatures = features.filter((f) => devDates.includes(f.session_date));

  console.log(`Analyzing ${devFeatures.length} 5m observations across 30 dev sessions for Gross Alpha...`);

  // We want to analyze forward 15m, 30m, 60m, 120m returns conditional on various features:
  const conditions: { name: string; filter: (f: any) => boolean }[] = [
    { name: 'All Bars (Baseline Unconditional)', filter: () => true },
    { name: 'RVOL > 1.5 (High Volume)', filter: (f) => f.rvol > 1.5 },
    { name: 'RVOL > 2.0 (Extreme Volume)', filter: (f) => f.rvol > 2.0 },
    { name: 'Close > VWAP + 0.3% (Strong Momentum)', filter: (f) => (f.close - f.vwap) / f.vwap > 0.003 },
    { name: 'Close < VWAP - 0.3% (Oversold Dip)', filter: (f) => (f.close - f.vwap) / f.vwap < -0.003 },
    { name: 'Close < VWAP - 0.6% (Deep Oversold Dip)', filter: (f) => (f.close - f.vwap) / f.vwap < -0.006 },
    { name: 'Close > Opening Range High (Breakout)', filter: (f) => f.or_ready && f.or_high && f.close > f.or_high },
    { name: 'Close < Opening Range Low (Breakdown)', filter: (f) => f.or_ready && f.or_low && f.close < f.or_low },
    { name: 'Sector Spread 15m > +0.2% (UCG Outperforming Banks)', filter: (f) => f.sector_spread_15m > 0.002 },
    { name: 'Sector Spread 15m < -0.2% (UCG Lagging Banks)', filter: (f) => f.sector_spread_15m < -0.002 },
    { name: 'Morning Session (09:30 - 11:30 CET)', filter: (f) => f.minute_of_day >= 30 && f.minute_of_day <= 150 },
    { name: 'Midday Session (12:00 - 14:00 CET)', filter: (f) => f.minute_of_day >= 180 && f.minute_of_day <= 300 },
    { name: 'US Open Session (15:30 - 17:00 CET)', filter: (f) => f.minute_of_day >= 390 && f.minute_of_day <= 480 },
    { name: 'Positive Gap Day (Gap > +0.2%)', filter: (f) => f.gap_return > 0.002 },
    { name: 'Negative Gap Day (Gap < -0.2%)', filter: (f) => f.gap_return < -0.002 },
    { name: 'High Volatility Day (30m vol > 35 bps)', filter: (f) => f.volatility_30m > 0.0035 },
    { name: 'Low Volatility Day (30m vol < 20 bps)', filter: (f) => f.volatility_30m < 0.002 },
  ];

  console.log('\n| Condition | Count | Fwd 15m (bps) | Fwd 30m (bps) | Fwd 60m (bps) | Fwd 120m (bps) | Fwd 60m Win% |');
  console.log('|---|---|---|---|---|---|---|');

  for (const c of conditions) {
    const matched = devFeatures.filter(c.filter);
    if (matched.length === 0) continue;

    const getStats = (key: string) => {
      const vals = matched.map((f) => (f as Record<string, any>)[key]).filter((v) => v !== undefined && isFinite(v));
      if (vals.length === 0) return { meanBps: 0, winPct: 0 };
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const wins = vals.filter((v) => v > 0).length / vals.length;
      return { meanBps: mean * 10000, winPct: wins * 100 };
    };

    const s15 = getStats('fwd_ret_15m');
    const s30 = getStats('fwd_ret_30m');
    const s60 = getStats('fwd_ret_60m');
    const s120 = getStats('fwd_ret_120m');

    console.log(`| ${c.name.padEnd(45)} | ${matched.length.toString().padStart(5)} | ${s15.meanBps.toFixed(2).padStart(8)} | ${s30.meanBps.toFixed(2).padStart(8)} | ${s60.meanBps.toFixed(2).padStart(8)} | ${s120.meanBps.toFixed(2).padStart(8)} | ${s60.winPct.toFixed(1).padStart(6)}% |`);
  }
}

analyzeAlphaSignals();
