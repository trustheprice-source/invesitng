import fs from 'fs';
import { parseYahooChartResponse, enrichWithMultiHorizonFeatures, generate1mProxyFrom5m } from '../src/engine/realMarketData';
import { DEFAULT_EXECUTION_CONFIG, runBacktest } from '../src/engine/backtest';
import { summarizePerformance, assessEvidence, blockBootstrapMeanCI } from '../src/engine/statistics';
import { Bar1m, Bar5m, Candidate, ExecutionConfig, FeatureRow } from '../src/types';

function testCombinedAlpha() {
  const rawCache = JSON.parse(fs.readFileSync('server_data/real_market_cache.json', 'utf-8'));
  const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
  const bars1m = generate1mProxyFrom5m(bars5m);
  const features = enrichWithMultiHorizonFeatures(bars5m);

  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
  const devSessions = new Set(sessionDates.slice(0, 30));

  console.log('Testing Combined Structural Alpha Candidates on Dev Partition (30 sessions)...');

  // Candidate 1: Gap Momentum Breakout (Only take OR breakouts on positive gap days with RVOL > 1.3, hold 120m)
  const candidateGapORB: Candidate = {
    id: 'gap_orb_120m',
    kind: 'rule',
    name: 'opening_breakout',
    description: 'Breakout above OR high conditioned on positive gap and RVOL, 120m holding',
    parameters: {
      rvol_threshold: 1.3,
      min_minute: 35,
      max_minute: 240,
    },
    score_threshold: 0.0,
  };

  // Modify features or signals to test this hypothesis
  // We can write a custom signal evaluator:
  interface CustomCandidate {
    id: string;
    name: string;
    holdingMin: number;
    eval: (f: FeatureRow) => boolean;
  }

  const candidates: CustomCandidate[] = [
    {
      id: 'gap_orb_120m',
      name: 'Positive Gap + OR Breakout (120m)',
      holdingMin: 120,
      eval: (f) => f.gap_return > 0.002 && f.or_ready && f.or_high !== null && f.close > f.or_high && f.rvol >= 1.3 && f.minute_of_day <= 240,
    },
    {
      id: 'deep_dip_reversal_120m',
      name: 'Deep VWAP Dip (< -0.6%) + Lagging Banks (120m)',
      holdingMin: 120,
      eval: (f) => (f.close - f.vwap) / f.vwap < -0.006 && f.sector_spread_15m !== undefined && f.sector_spread_15m < 0 && f.rvol >= 1.2 && f.minute_of_day >= 60 && f.minute_of_day <= 360,
    },
    {
      id: 'midday_drift_120m',
      name: 'Midday Trend Continuation (12:00 CET, 120m)',
      holdingMin: 120,
      eval: (f) => f.minute_of_day === 180 && f.close > f.vwap && f.gap_return > 0,
    },
    {
      id: 'selective_low_frequency_swing',
      name: 'Selective Morning Momentum (Gap > 0.3%, OR Breakout, RVOL > 1.5, Hold till 17:00)',
      holdingMin: 420,
      eval: (f) => f.gap_return > 0.003 && f.or_ready && f.or_high !== null && f.close > f.or_high && f.rvol >= 1.5 && f.minute_of_day <= 120,
    },
  ];

  for (const c of candidates) {
    // Sizing: test on €10,000 standard (€2,500 notional) and €40,000 (€10,000 notional)
    for (const notionalTier of [
      { cap: 10000, alloc: 0.25, name: '€10k cap (€2.5k notional, 38 bps)' },
      { cap: 40000, alloc: 0.25, name: '€40k cap (€10k notional, 24 bps)' },
    ]) {
      let cash = notionalTier.cap;
      const startCash = cash;
      let peakCash = cash;
      let maxDD = 0;
      const trades: any[] = [];
      const dailyEquity: number[] = [];

      for (const sDate of sessionDates.slice(0, 30)) {
        const sBars1m = bars1m.filter((b) => b.session_date === sDate);
        const sFeatures = features.filter((f) => f.session_date === sDate);
        if (sBars1m.length < 480) continue;

        let inPos = false;
        let entryPrice = 0;
        let entryIdx = 0;
        let qty = 0;
        let entryFee = 0;
        let stopPrice = 0;

        for (let i = 0; i < sBars1m.length; i++) {
          const b = sBars1m[i];
          const fIdx = sFeatures.findIndex((f) => f.timestamp === b.timestamp);

          if (inPos) {
            // Check stop loss (1%) or holding time or EOD
            let exitReason = '';
            let rawExit = b.open;

            if (b.low <= stopPrice) {
              exitReason = 'stop_loss';
              rawExit = Math.min(b.open, stopPrice);
            } else if (i >= entryIdx + c.holdingMin) {
              exitReason = 'holding_exit';
              rawExit = b.open;
            } else if (i >= 480) {
              exitReason = 'session_close';
              rawExit = b.open;
            }

            if (exitReason) {
              const friction = (DEFAULT_EXECUTION_CONFIG.round_trip_spread_bps / 2 + DEFAULT_EXECUTION_CONFIG.slippage_bps_per_side) / 10000;
              const exitPrice = rawExit * (1 - friction);
              const exitFee = Math.max(3.0, qty * exitPrice * 0.0005);
              const grossPnl = qty * (exitPrice - entryPrice);
              const netPnl = grossPnl - entryFee - exitFee;
              cash += qty * exitPrice - exitFee;
              trades.push({ session: sDate, grossPnl, netPnl, win: netPnl > 0, ret: netPnl / (qty * entryPrice), reason: exitReason });
              inPos = false;
            }
          } else if (!inPos && fIdx >= 0 && i < 420) {
            const f = sFeatures[fIdx];
            if (c.eval(f)) {
              const friction = (DEFAULT_EXECUTION_CONFIG.round_trip_spread_bps / 2 + DEFAULT_EXECUTION_CONFIG.slippage_bps_per_side) / 10000;
              const nextBar = sBars1m[i + 1] || b;
              entryPrice = nextBar.open * (1 + friction);
              const notional = cash * notionalTier.alloc;
              qty = Math.floor(notional / entryPrice);
              if (qty > 0) {
                entryFee = Math.max(3.0, qty * entryPrice * 0.0005);
                if (cash >= qty * entryPrice + entryFee) {
                  cash -= qty * entryPrice + entryFee;
                  entryIdx = i + 1;
                  stopPrice = entryPrice * 0.99; // 1% stop loss
                  inPos = true;
                }
              }
            }
          }
        }

        if (cash > peakCash) peakCash = cash;
        const curDD = (peakCash - cash) / peakCash;
        if (curDD > maxDD) maxDD = curDD;
      }

      const wins = trades.filter((t) => t.win).length;
      const winRate = trades.length ? wins / trades.length : 0;
      const netReturn = (cash - startCash) / startCash;
      const totalFees = trades.reduce((acc, t) => acc + (t.grossPnl - t.netPnl), 0);

      console.log(`[${c.name}] (${notionalTier.name}) | Trades: ${trades.length} | Win Rate: ${(winRate * 100).toFixed(1)}% | Net Ret: ${(netReturn * 100).toFixed(2)}% | Max DD: ${(maxDD * 100).toFixed(2)}% | Net PnL: €${(cash - startCash).toFixed(2)} | Fees: €${totalFees.toFixed(2)}`);
    }
  }
}

testCombinedAlpha();
