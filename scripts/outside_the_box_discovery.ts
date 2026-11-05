import fs from 'fs';
import { parseYahooChartResponse, enrichWithMultiHorizonFeatures, generate1mProxyFrom5m } from '../src/engine/realMarketData';
import { DEFAULT_EXECUTION_CONFIG } from '../src/engine/backtest';
import { blockBootstrapMeanCI, summarizePerformance } from '../src/engine/statistics';

interface TradeResult {
  session: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  netPnl: number;
  netReturn: number;
  win: boolean;
  reason: string;
}

function runOutsideTheBoxDiscovery() {
  console.log('========================================================================');
  console.log('OUTSIDE-THE-BOX INTRADAY PATTERN DISCOVERY FOR UNICREDIT (UCG.MI)');
  console.log('========================================================================');

  const rawCache = JSON.parse(fs.readFileSync('server_data/real_market_cache.json', 'utf-8'));
  const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
  const bars1m = generate1mProxyFrom5m(bars5m);
  const features = enrichWithMultiHorizonFeatures(bars5m);

  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
  console.log(`Audited ${bars5m.length} 5m bars across ${sessionDates.length} trading sessions (${sessionDates[0]} to ${sessionDates[sessionDates.length - 1]}).`);

  // Reserve the last 20 sessions for holdout validation (pure out-of-sample)
  // Dev sessions: first 40 sessions
  const devDates = sessionDates.slice(0, 40);
  const holdoutDates = sessionDates.slice(40);
  console.log(`Development partition: ${devDates.length} sessions (${devDates[0]} to ${devDates[devDates.length - 1]})`);
  console.log(`Holdout partition (SEALED): ${holdoutDates.length} sessions (${holdoutDates[0]} to ${holdoutDates[holdoutDates.length - 1]})`);

  // Execution assumptions:
  // We test both Standard Retail (€10k capital, 25% alloc = €2,500 notional, 38 bps friction)
  // AND Institutional Sizing (€50k capital, 25% alloc = €12,500 notional, 24 bps friction)
  const retailConfig = {
    capital: 10000,
    alloc: 0.25,
    minComm: 3.0,
    commRate: 0.0005,
    spreadBps: 10.0,
    slipBps: 2.0,
  };

  const instConfig = {
    capital: 50000,
    alloc: 0.25,
    minComm: 3.0,
    commRate: 0.0005,
    spreadBps: 10.0,
    slipBps: 2.0,
  };

  type PatternDef = {
    id: string;
    name: string;
    description: string;
    shouldEnter: (f: any, sessionBars5m: any[], barIdx: number) => boolean;
    exitRule: 'FIXED_TIME' | 'HOLDING_MIN' | 'STOP_OR_TP' | 'EOD_CLOSE';
    exitMinute?: number;
    holdingMinutes?: number;
    takeProfitPct?: number;
    stopLossPct?: number;
  };

  const patterns: PatternDef[] = [
    // 1. The Afternoon MOC Pull: In European equities, VWAP benchmarkers buy depressed large-caps from 16:00 to 17:20
    {
      id: 'moc_pull_afternoon',
      name: 'Afternoon VWAP Reversion (16:00 to 17:20 CET)',
      description: 'Enter at 16:00 CET if UCG is trading below session VWAP by > 0.4%, exit at 17:20 before closing auction',
      shouldEnter: (f) => f.minute_of_day === 420 && (f.close - f.vwap) / f.vwap < -0.004,
      exitRule: 'FIXED_TIME',
      exitMinute: 500, // 17:20 CET
    },

    // 2. Transatlantic US Open Momentum (15:30 to 17:15 CET)
    {
      id: 'us_open_breakout',
      name: 'US Open Trend Follow-Through (15:35 to 17:15 CET)',
      description: 'Enter at 15:35 CET if US open triggers high RVOL (>1.4) and positive 15m return (> +0.25%)',
      shouldEnter: (f) => f.minute_of_day === 395 && f.ret_15m > 0.0025 && f.rvol >= 1.4,
      exitRule: 'FIXED_TIME',
      exitMinute: 495, // 17:15 CET
    },

    // 3. Sector Lead-Lag Catch-Up: European Banks (EXV1.DE) leading UCG
    {
      id: 'sector_catchup_60m',
      name: 'Sector Lead-Lag Catch-up (60m hold)',
      description: 'When EURO STOXX Banks ETF is up > 0.3% over 15m while UCG has lagged (sector_spread < -0.3%), buy UCG for catch-up',
      shouldEnter: (f) => f.minute_of_day >= 60 && f.minute_of_day <= 360 && f.sector_spread_15m < -0.003 && f.rvol >= 1.2,
      exitRule: 'HOLDING_MIN',
      holdingMinutes: 60,
    },

    // 4. Opening Shakeout Reversal: Fade extreme opening drop after 09:30
    {
      id: 'opening_shakeout_fade',
      name: '09:35 Opening Shakeout Reversal (Hold to 12:00 CET)',
      description: 'At 09:35 CET, if 30m return is < -0.8% but FTSE MIB is stable, buy the oversold morning liquidity sweep',
      shouldEnter: (f) => f.minute_of_day === 35 && f.ret_15m < -0.006 && f.rvol >= 1.5,
      exitRule: 'FIXED_TIME',
      exitMinute: 180, // 12:00 CET
    },

    // 5. Positive Gap Morning Runner: Institutional Morning Accumulation (09:30 to 16:30 CET)
    {
      id: 'positive_gap_morning_runner',
      name: 'Positive Gap Morning Runner (09:30 to 16:30 CET)',
      description: 'On positive gap days (> +0.3%) with Opening Range Breakout at 09:30 and RVOL > 1.3, hold all day until 16:30',
      shouldEnter: (f) => f.gap_return > 0.003 && f.minute_of_day === 35 && f.or_ready && f.or_high && f.close > f.or_high && f.rvol >= 1.3,
      exitRule: 'FIXED_TIME',
      exitMinute: 450, // 16:30 CET
    },

    // 6. Midday Lunch Absorption (12:30 to 15:30 CET)
    {
      id: 'lunch_absorption_reversal',
      name: 'Midday Lunch Absorption (12:30 to 15:30 CET)',
      description: 'Buy at 12:30 CET if price is within 0.1% of session low but RVOL is low (selling dried up)',
      shouldEnter: (f, sBars, idx) => {
        if (f.minute_of_day !== 210) return false;
        let minL = Infinity;
        for (let j = 0; j <= idx; j++) {
          if (sBars[j].low < minL) minL = sBars[j].low;
        }
        return f.close <= minL * 1.002 && f.rvol < 0.9;
      },
      exitRule: 'FIXED_TIME',
      exitMinute: 390, // 15:30 CET (US Open)
    },

    // 7. Volatility Expansion Breakout with Trailing Stop
    {
      id: 'vol_expansion_orb',
      name: 'Volatility Expansion Breakout (TP +2.0%, SL -0.8%)',
      description: 'OR breakout on high volatility days (30m vol > 25 bps) with 2:1 asymmetric reward:risk',
      shouldEnter: (f) => f.or_ready && f.or_high && f.close > f.or_high && f.volatility_30m >= 0.0025 && f.rvol >= 1.4 && f.minute_of_day <= 180,
      exitRule: 'STOP_OR_TP',
      takeProfitPct: 0.02,
      stopLossPct: 0.008,
      holdingMinutes: 180,
    },

    // 8. The Anti-Chop Regulated Intraday Trend (Fixed 10:00 to 16:00 on Trend Days)
    {
      id: 'trend_day_regime',
      name: 'Regime Filtered Trend Day (10:00 to 16:00 CET)',
      description: 'Buy at 10:00 CET only if UCG is above VWAP, Banking ETF is up, and Gap is non-negative. Exit 16:00 CET',
      shouldEnter: (f) => f.minute_of_day === 60 && f.close > f.vwap && f.gap_return >= 0 && f.ret_60m > 0.002,
      exitRule: 'FIXED_TIME',
      exitMinute: 420, // 16:00 CET
    },
  ];

  function evaluatePattern(pattern: PatternDef, sessionsToTest: string[], cfg: typeof retailConfig) {
    let cash = cfg.capital;
    let peakCash = cfg.capital;
    let maxDD = 0;
    const trades: TradeResult[] = [];
    const dailyReturns: number[] = [];

    for (const sDate of sessionsToTest) {
      const sBars5m = features.filter((f) => f.session_date === sDate);
      const sBars1m = bars1m.filter((b) => b.session_date === sDate);
      if (sBars1m.length < 500) continue;

      const sessionStartCash = cash;
      let inPos = false;
      let entryPrice = 0;
      let entryIdx = 0;
      let qty = 0;
      let stopP = 0;
      let tpP = 0;
      let entryFee = 0;
      let entryTimeStr = '';

      for (let i = 0; i < sBars1m.length; i++) {
        const b1m = sBars1m[i];
        const fIdx = sBars5m.findIndex((f) => f.timestamp === b1m.timestamp);

        if (inPos) {
          let exitReason = '';
          let rawExit = b1m.open;

          if (pattern.exitRule === 'FIXED_TIME' && i >= pattern.exitMinute!) {
            exitReason = 'FIXED_TIME_EXIT';
            rawExit = b1m.open;
          } else if (pattern.exitRule === 'HOLDING_MIN' && i >= entryIdx + pattern.holdingMinutes!) {
            exitReason = 'HOLDING_MIN_EXPIRATION';
            rawExit = b1m.open;
          } else if (pattern.exitRule === 'STOP_OR_TP') {
            if (b1m.high >= tpP) {
              exitReason = 'TAKE_PROFIT';
              rawExit = tpP;
            } else if (b1m.low <= stopP) {
              exitReason = 'STOP_LOSS';
              rawExit = Math.min(b1m.open, stopP);
            } else if (i >= entryIdx + (pattern.holdingMinutes || 180) || i >= 505) {
              exitReason = 'TIME_EXIT';
              rawExit = b1m.open;
            }
          } else if (i >= 505) {
            // 17:25 CET mandatory close
            exitReason = 'MANDATORY_EOD_CLOSE';
            rawExit = b1m.open;
          }

          if (exitReason) {
            const friction = (cfg.spreadBps / 2 + cfg.slipBps) / 10000;
            const exitPrice = rawExit * (1 - friction);
            const notional = qty * exitPrice;
            const exitFee = Math.max(cfg.minComm, notional * cfg.commRate);
            const grossPnl = qty * (exitPrice - entryPrice);
            const netPnl = grossPnl - entryFee - exitFee;
            const netRet = netPnl / (qty * entryPrice);
            cash += notional - exitFee;

            trades.push({
              session: sDate,
              entryTime: entryTimeStr,
              exitTime: b1m.timestamp,
              entryPrice,
              exitPrice,
              quantity: qty,
              grossPnl,
              netPnl,
              netReturn: netRet,
              win: netPnl > 0,
              reason: exitReason,
            });

            inPos = false;
          }
        } else if (!inPos && fIdx >= 0 && i < 500) {
          const f = sBars5m[fIdx];
          if (pattern.shouldEnter(f, sBars5m, fIdx)) {
            const friction = (cfg.spreadBps / 2 + cfg.slipBps) / 10000;
            const nextBar = sBars1m[i + 1] || b1m;
            entryPrice = nextBar.open * (1 + friction);
            const notional = cash * cfg.alloc;
            qty = Math.floor(notional / entryPrice);

            if (qty > 0) {
              entryFee = Math.max(cfg.minComm, qty * entryPrice * cfg.commRate);
              if (cash >= qty * entryPrice + entryFee) {
                cash -= qty * entryPrice + entryFee;
                entryIdx = i + 1;
                entryTimeStr = nextBar.timestamp;
                stopP = pattern.stopLossPct ? entryPrice * (1 - pattern.stopLossPct) : entryPrice * 0.99;
                tpP = pattern.takeProfitPct ? entryPrice * (1 + pattern.takeProfitPct) : entryPrice * 1.02;
                inPos = true;
              }
            }
          }
        }
      }

      if (cash > peakCash) peakCash = cash;
      const curDD = (peakCash - cash) / peakCash;
      if (curDD > maxDD) maxDD = curDD;

      dailyReturns.push((cash - sessionStartCash) / sessionStartCash);
    }

    const wins = trades.filter((t) => t.win).length;
    const winRate = trades.length ? wins / trades.length : 0;
    const netReturn = (cash - cfg.capital) / cfg.capital;
    const totalGross = trades.reduce((a, b) => a + b.grossPnl, 0);
    const totalFees = trades.reduce((a, b) => a + (b.grossPnl - b.netPnl), 0);
    const profitFactor = trades.filter((t) => t.netPnl < 0).length === 0
      ? 99.9
      : Math.abs(
          trades.filter((t) => t.netPnl > 0).reduce((a, b) => a + b.netPnl, 0) /
            (trades.filter((t) => t.netPnl < 0).reduce((a, b) => a + b.netPnl, 0) || 1)
        );

    // Bootstrap CI
    const ci = trades.length >= 5 ? blockBootstrapMeanCI(dailyReturns, 3, 500, 0.05) : { lower: 0, upper: 0, mean: 0 };

    return {
      tradesCount: trades.length,
      winRate,
      netReturn,
      totalGross,
      totalFees,
      profitFactor,
      maxDD,
      ci,
      trades,
    };
  }

  console.log('\n--- EVALUATING 8 OUTSIDE-THE-BOX PATTERNS ON DEVELOPMENT (40 SESSIONS) ---');
  console.log('Testing under Retail Setup (€10k Cap, €2.5k Notional, 38 bps friction):');
  console.log('| Pattern ID | Trades | Win Rate | Net Ret | Gross PnL | Fees Paid | Max DD | Profit Factor | Status |');
  console.log('|---|---|---|---|---|---|---|---|---|');

  for (const p of patterns) {
    const res = evaluatePattern(p, devDates, retailConfig);
    const status = res.netReturn > 0 && res.winRate > 0.5 ? 'PROFITABLE ✓' : res.netReturn > 0 ? 'MARGINAL' : 'NEGATIVE ✗';
    console.log(
      `| ${p.id.padEnd(25)} | ${res.tradesCount.toString().padStart(6)} | ${(res.winRate * 100).toFixed(1).padStart(7)}% | ${(res.netReturn * 100).toFixed(2).padStart(6)}% | €${res.totalGross.toFixed(1).padStart(8)} | €${res.totalFees.toFixed(1).padStart(8)} | ${(res.maxDD * 100).toFixed(2).padStart(5)}% | ${res.profitFactor.toFixed(2).padStart(12)} | ${status.padEnd(12)} |`
    );
  }

  console.log('\nTesting under Institutional Setup (€50k Cap, €12.5k Notional, 24 bps friction):');
  console.log('| Pattern ID | Trades | Win Rate | Net Ret | Gross PnL | Fees Paid | Max DD | Profit Factor | Status |');
  console.log('|---|---|---|---|---|---|---|---|---|');

  for (const p of patterns) {
    const res = evaluatePattern(p, devDates, instConfig);
    const status = res.netReturn > 0 && res.winRate > 0.5 ? 'PROFITABLE ✓' : res.netReturn > 0 ? 'MARGINAL' : 'NEGATIVE ✗';
    console.log(
      `| ${p.id.padEnd(25)} | ${res.tradesCount.toString().padStart(6)} | ${(res.winRate * 100).toFixed(1).padStart(7)}% | ${(res.netReturn * 100).toFixed(2).padStart(6)}% | €${res.totalGross.toFixed(1).padStart(8)} | €${res.totalFees.toFixed(1).padStart(8)} | ${(res.maxDD * 100).toFixed(2).padStart(5)}% | ${res.profitFactor.toFixed(2).padStart(12)} | ${status.padEnd(12)} |`
    );
  }
}

runOutsideTheBoxDiscovery();
