import fs from 'fs';
import { parseYahooChartResponse, enrichWithMultiHorizonFeatures, generate1mProxyFrom5m } from '../src/engine/realMarketData';
import { DEFAULT_EXECUTION_CONFIG } from '../src/engine/backtest';

function testAsymmetricExits() {
  const rawCache = JSON.parse(fs.readFileSync('server_data/real_market_cache.json', 'utf-8'));
  const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
  const bars1m = generate1mProxyFrom5m(bars5m);
  const features = enrichWithMultiHorizonFeatures(bars5m);
  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();

  console.log('Testing Asymmetric Profit Targets & Trailing Stops (Dev Partition)...');

  const tpSlConfigs = [
    { tp: 0.015, sl: 0.008, name: 'TP +1.5%, SL -0.8% (Reward:Risk 1.88)' },
    { tp: 0.020, sl: 0.010, name: 'TP +2.0%, SL -1.0% (Reward:Risk 2.00)' },
    { tp: 0.012, sl: 0.006, name: 'TP +1.2%, SL -0.6% (Reward:Risk 2.00)' },
    { tp: 0.010, sl: 0.005, name: 'TP +1.0%, SL -0.5% (Reward:Risk 2.00)' },
  ];

  for (const cfg of tpSlConfigs) {
    let cash = 10000;
    const startCash = cash;
    let peakCash = cash;
    let maxDD = 0;
    const trades: any[] = [];

    for (const sDate of sessionDates.slice(0, 30)) {
      const sBars1m = bars1m.filter((b) => b.session_date === sDate);
      const sFeatures = features.filter((f) => f.session_date === sDate);
      if (sBars1m.length < 480) continue;

      let inPos = false;
      let entryPrice = 0;
      let entryIdx = 0;
      let qty = 0;
      let stopP = 0;
      let targetP = 0;

      for (let i = 0; i < sBars1m.length; i++) {
        const b = sBars1m[i];
        const fIdx = sFeatures.findIndex((f) => f.timestamp === b.timestamp);

        if (inPos) {
          let exitReason = '';
          let rawExit = b.open;

          if (b.high >= targetP) {
            exitReason = 'take_profit';
            rawExit = targetP;
          } else if (b.low <= stopP) {
            exitReason = 'stop_loss';
            rawExit = Math.min(b.open, stopP);
          } else if (i >= 480) {
            exitReason = 'session_close';
            rawExit = b.open;
          }

          if (exitReason) {
            const friction = (DEFAULT_EXECUTION_CONFIG.round_trip_spread_bps / 2 + DEFAULT_EXECUTION_CONFIG.slippage_bps_per_side) / 10000;
            const exitPrice = rawExit * (1 - friction);
            const exitFee = Math.max(3.0, qty * exitPrice * 0.0005);
            const grossPnl = qty * (exitPrice - entryPrice);
            const netPnl = grossPnl - (qty * entryPrice * 0.0005 > 3 ? qty * entryPrice * 0.0005 : 3.0) - exitFee;
            cash += qty * exitPrice - exitFee;
            trades.push({ grossPnl, netPnl, win: netPnl > 0, reason: exitReason });
            inPos = false;
          }
        } else if (!inPos && fIdx >= 0 && i < 240) {
          const f = sFeatures[fIdx];
          // Positive Gap + OR Breakout
          if (f.gap_return > 0.002 && f.or_ready && f.or_high !== null && f.close > f.or_high && f.rvol >= 1.3) {
            const friction = (DEFAULT_EXECUTION_CONFIG.round_trip_spread_bps / 2 + DEFAULT_EXECUTION_CONFIG.slippage_bps_per_side) / 10000;
            const nextBar = sBars1m[i + 1] || b;
            entryPrice = nextBar.open * (1 + friction);
            const notional = cash * 0.25;
            qty = Math.floor(notional / entryPrice);
            if (qty > 0) {
              const fee = Math.max(3.0, qty * entryPrice * 0.0005);
              if (cash >= qty * entryPrice + fee) {
                cash -= qty * entryPrice + fee;
                entryIdx = i + 1;
                stopP = entryPrice * (1 - cfg.sl);
                targetP = entryPrice * (1 + cfg.tp);
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
    const netRet = (cash - startCash) / startCash;
    console.log(`[${cfg.name}] Trades: ${trades.length} | Wins: ${wins} (${(winRate * 100).toFixed(1)}%) | Net Ret: ${(netRet * 100).toFixed(2)}% | Net PnL: €${(cash - startCash).toFixed(2)} | Reasons: ${trades.map((t) => t.reason).join(',')}`);
  }
}

testAsymmetricExits();
