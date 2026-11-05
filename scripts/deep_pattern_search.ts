import fs from 'fs';
import { parseYahooChartResponse, enrichWithMultiHorizonFeatures, generate1mProxyFrom5m } from '../src/engine/realMarketData';
import { DEFAULT_EXECUTION_CONFIG, runBacktest } from '../src/engine/backtest';
import { summarizePerformance, assessEvidence, blockBootstrapMeanCI } from '../src/engine/statistics';
import { Bar1m, Bar5m, Candidate, ExecutionConfig, FeatureRow } from '../src/types';

function runDeepSearch() {
  const rawCache = JSON.parse(fs.readFileSync('server_data/real_market_cache.json', 'utf-8'));
  const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
  const bars1m = generate1mProxyFrom5m(bars5m);
  const features = enrichWithMultiHorizonFeatures(bars5m);

  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
  const devSessions = new Set(sessionDates.slice(0, 30));
  const holdoutSessions = new Set(sessionDates.slice(30));

  console.log(`Audited ${bars5m.length} 5m bars across ${sessionDates.length} sessions.`);
  console.log(`Dev: ${sessionDates[0]} to ${sessionDates[29]}`);

  // Test 1: Fixed Intraday Time Rules across different entry/exit windows
  console.log('\n--- 1. SYSTEMATIC INTRADAY TIME RULES (Dev Partition) ---');
  const timeWindows = [
    { entryMin: 30, exitMin: 480, name: '09:30 to 17:00 CET' }, // 09:30 to 17:00
    { entryMin: 30, exitMin: 420, name: '09:30 to 16:00 CET' }, // Morning to pre-close
    { entryMin: 45, exitMin: 480, name: '09:45 to 17:00 CET' }, // Post opening auction
    { entryMin: 60, exitMin: 480, name: '10:00 to 17:00 CET' }, // 10:00 to 17:00
    { entryMin: 30, exitMin: 240, name: '09:30 to 13:00 CET (Morning only)' },
    { entryMin: 240, exitMin: 480, name: '13:00 to 17:00 CET (Afternoon only)' },
    { entryMin: 390, exitMin: 480, name: '15:30 to 17:00 CET (US Open only)' },
  ];

  for (const tw of timeWindows) {
    let cash = 10000;
    const trades: any[] = [];
    const dailyReturns: number[] = [];

    for (const sDate of sessionDates.slice(0, 30)) {
      const sBars = bars1m.filter((b) => b.session_date === sDate);
      if (sBars.length <= tw.exitMin) continue;

      const entryBar = sBars[tw.entryMin];
      const exitBar = sBars[tw.exitMin];
      const friction = (DEFAULT_EXECUTION_CONFIG.round_trip_spread_bps / 2 + DEFAULT_EXECUTION_CONFIG.slippage_bps_per_side) / 10000;
      const entryP = entryBar.open * (1 + friction);
      const exitP = exitBar.open * (1 - friction);
      const notional = cash * DEFAULT_EXECUTION_CONFIG.allocation_fraction;
      const qty = Math.floor(notional / entryP);

      if (qty > 0) {
        const entryFee = Math.max(3.0, qty * entryP * 0.0005);
        const exitFee = Math.max(3.0, qty * exitP * 0.0005);
        const grossPnl = qty * (exitP - entryP);
        const netPnl = grossPnl - entryFee - exitFee;
        const netRet = netPnl / (qty * entryP);
        trades.push({ grossPnl, netPnl, netRet, win: netPnl > 0 });
        const startCash = cash;
        cash += netPnl;
        dailyReturns.push((cash - startCash) / startCash);
      }
    }

    const wins = trades.filter((t) => t.win).length;
    const winRate = trades.length ? wins / trades.length : 0;
    const netReturn = (cash - 10000) / 10000;
    console.log(`[Time Window: ${tw.name}] Trades: ${trades.length} | Win Rate: ${(winRate * 100).toFixed(1)}% | Net Return: ${(netReturn * 100).toFixed(2)}% | Net PnL: €${(cash - 10000).toFixed(2)}`);
  }

  // Test 2: Directional Regime Filtering (Trend Filter + Sector Spread + Volume)
  console.log('\n--- 2. ADVANCED SECTOR & MOMENTUM CHALLENGERS (Dev Partition) ---');
  // Challenger A: Bank Sector Relative Momentum (trade UCG when UCG outperforming banking ETF by > 0.3% over 60m with RVOL > 1.2)
  // Challenger B: Morning Trend Continuation (Enter at 10:00 if 09:00-10:00 return > +0.5% and RVOL > 1.2, exit at 17:00)
  // Challenger C: Mean Reversion with Volatility Threshold (Only enter if 30m volatility > 40 bps, holding 60m)

  const candidates: { id: string; name: string; desc: string; evalSignal: (f: FeatureRow, prevBars: FeatureRow[]) => boolean; holdingMin: number }[] = [
    {
      id: 'morning_trend_continuation_60m',
      name: 'morning_trend_continuation',
      desc: 'Enter if 09:00-10:00 return > +0.3% with high RVOL, hold 60m',
      evalSignal: (f) => f.minute_of_day === 60 && f.ret_60m > 0.003 && f.rvol >= 1.2,
      holdingMin: 60,
    },
    {
      id: 'morning_trend_day_hold',
      name: 'morning_trend_day_hold',
      desc: 'Enter at 10:00 if 09:00-10:00 return > +0.3% with high RVOL, hold till 17:00',
      evalSignal: (f) => f.minute_of_day === 60 && f.ret_60m > 0.003 && f.rvol >= 1.2,
      holdingMin: 420,
    },
    {
      id: 'sector_relative_momentum_60m',
      name: 'sector_relative_momentum',
      desc: 'UCG outperforming European Banking ETF (EXV1.DE) by > 0.25% with RVOL > 1.2',
      evalSignal: (f) => f.minute_of_day >= 60 && f.minute_of_day <= 360 && f.sector_spread_15m !== undefined && f.sector_spread_15m > 0.0025 && f.rvol >= 1.2,
      holdingMin: 60,
    },
    {
      id: 'high_vol_reversal_60m',
      name: 'high_vol_reversal',
      desc: 'Oversold stretch from VWAP (< -0.5%) ONLY during high volatility (> 40 bps), hold 60m',
      evalSignal: (f) => f.minute_of_day >= 60 && f.minute_of_day <= 390 && (f.close - f.vwap) / f.vwap < -0.005 && f.volatility_30m >= 0.004 && f.rvol >= 1.2,
      holdingMin: 60,
    },
    {
      id: 'us_open_momentum_60m',
      name: 'us_open_momentum',
      desc: 'Enter at 15:35 CET (US Market Open) if UCG broke 15m high with volume expansion',
      evalSignal: (f) => f.minute_of_day === 395 && f.ret_15m > 0.002 && f.rvol >= 1.3,
      holdingMin: 60,
    },
  ];

  for (const c of candidates) {
    let cash = 10000;
    const trades: any[] = [];
    const dailyPnl: Map<string, number> = new Map();

    for (const sDate of sessionDates.slice(0, 30)) {
      const sBars1m = bars1m.filter((b) => b.session_date === sDate);
      const sFeatures = features.filter((f) => f.session_date === sDate);
      if (sBars1m.length < 480) continue;

      let inPos = false;
      let entryPrice = 0;
      let entryIdx = 0;
      let qty = 0;
      let entryFee = 0;

      for (let i = 0; i < sBars1m.length; i++) {
        const b = sBars1m[i];
        const fIdx = sFeatures.findIndex((f) => f.timestamp === b.timestamp);

        if (inPos) {
          // Exit on holdingMin or session end (minute 480)
          if (i >= entryIdx + c.holdingMin || i >= 480) {
            const friction = (DEFAULT_EXECUTION_CONFIG.round_trip_spread_bps / 2 + DEFAULT_EXECUTION_CONFIG.slippage_bps_per_side) / 10000;
            const exitPrice = b.open * (1 - friction);
            const exitFee = Math.max(3.0, qty * exitPrice * 0.0005);
            const grossPnl = qty * (exitPrice - entryPrice);
            const netPnl = grossPnl - entryFee - exitFee;
            cash += qty * exitPrice - exitFee;
            trades.push({ session: sDate, grossPnl, netPnl, win: netPnl > 0, return: netPnl / (qty * entryPrice) });
            dailyPnl.set(sDate, (dailyPnl.get(sDate) || 0) + netPnl);
            inPos = false;
          }
        } else if (!inPos && fIdx >= 0 && i < 450) {
          const f = sFeatures[fIdx];
          if (c.evalSignal(f, sFeatures.slice(0, fIdx))) {
            const friction = (DEFAULT_EXECUTION_CONFIG.round_trip_spread_bps / 2 + DEFAULT_EXECUTION_CONFIG.slippage_bps_per_side) / 10000;
            const nextBar = sBars1m[i + 1] || b;
            entryPrice = nextBar.open * (1 + friction);
            const notional = cash * DEFAULT_EXECUTION_CONFIG.allocation_fraction;
            qty = Math.floor(notional / entryPrice);
            if (qty > 0) {
              entryFee = Math.max(3.0, qty * entryPrice * 0.0005);
              if (cash >= qty * entryPrice + entryFee) {
                cash -= qty * entryPrice + entryFee;
                entryIdx = i + 1;
                inPos = true;
              }
            }
          }
        }
      }
    }

    const wins = trades.filter((t) => t.win).length;
    const winRate = trades.length ? wins / trades.length : 0;
    const netReturn = (cash - 10000) / 10000;
    const fees = trades.length * 6.0; // approx €6 round trip
    console.log(`[${c.name}] Trades: ${trades.length} | Win Rate: ${(winRate * 100).toFixed(1)}% | Net Return: ${(netReturn * 100).toFixed(2)}% | Net PnL: €${(cash - 10000).toFixed(2)} | Fees: ~€${fees.toFixed(2)}`);
  }
}

runDeepSearch();
