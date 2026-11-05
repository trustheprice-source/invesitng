import fs from 'fs';
import { parseYahooChartResponse, enrichWithMultiHorizonFeatures, generate1mProxyFrom5m } from '../src/engine/realMarketData';
import { blockBootstrapMeanCI } from '../src/engine/statistics';

function optimizeSectorCatchup() {
  console.log('=== OPTIMIZING SECTOR LEAD-LAG CATCHUP ON UCG.MI ===');
  const rawCache = JSON.parse(fs.readFileSync('server_data/real_market_cache.json', 'utf-8'));
  const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
  const bars1m = generate1mProxyFrom5m(bars5m);
  const features = enrichWithMultiHorizonFeatures(bars5m);

  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
  const devDates = sessionDates.slice(0, 40); // 40 sessions dev

  // Let's test holding horizons: 30m, 45m, 60m, 90m, 120m, or dynamic exit (when sector spread crosses 0)
  // Let's test spread thresholds: -0.002, -0.003, -0.004, -0.005
  // Sizing: €50k capital, 25% allocation (€12,500 notional)

  const spreadThresholds = [-0.002, -0.0025, -0.003, -0.0035, -0.004];
  const holdingHorizons = [30, 45, 60, 90, 120];

  const cfg = {
    capital: 50000,
    alloc: 0.25,
    minComm: 3.0,
    commRate: 0.0005,
    spreadBps: 10.0,
    slipBps: 2.0,
  };

  console.log('| Spread Thresh | Hold Min | Trades | Win Rate | Gross PnL | Net PnL | Net Ret | Max DD | Profit Factor |');
  console.log('|---|---|---|---|---|---|---|---|---|');

  for (const thresh of spreadThresholds) {
    for (const hold of holdingHorizons) {
      let cash = cfg.capital;
      let peakCash = cash;
      let maxDD = 0;
      const trades: any[] = [];

      for (const sDate of devDates) {
        const sBars5m = features.filter((f) => f.session_date === sDate);
        const sBars1m = bars1m.filter((b) => b.session_date === sDate);
        if (sBars1m.length < 500) continue;

        let inPos = false;
        let entryPrice = 0;
        let entryIdx = 0;
        let qty = 0;

        for (let i = 0; i < sBars1m.length; i++) {
          const b1m = sBars1m[i];
          const fIdx = sBars5m.findIndex((f) => f.timestamp === b1m.timestamp);

          if (inPos) {
            let exitReason = '';
            let rawExit = b1m.open;

            // Check dynamic exit: if sector spread caught up (>= 0) or time expired or EOD
            const curF = fIdx >= 0 ? sBars5m[fIdx] : null;
            if (curF && curF.sector_spread_15m !== undefined && curF.sector_spread_15m >= 0 && i >= entryIdx + 15) {
              exitReason = 'SECTOR_CAUGHT_UP';
              rawExit = b1m.open;
            } else if (i >= entryIdx + hold) {
              exitReason = 'HOLDING_EXPIRED';
              rawExit = b1m.open;
            } else if (i >= 505) {
              exitReason = 'EOD_CLOSE';
              rawExit = b1m.open;
            }

            if (exitReason) {
              const friction = (cfg.spreadBps / 2 + cfg.slipBps) / 10000;
              const exitPrice = rawExit * (1 - friction);
              const notional = qty * exitPrice;
              const exitFee = Math.max(cfg.minComm, notional * cfg.commRate);
              const grossPnl = qty * (exitPrice - entryPrice);
              const netPnl = grossPnl - Math.max(cfg.minComm, qty * entryPrice * cfg.commRate) - exitFee;
              cash += notional - exitFee;

              trades.push({ grossPnl, netPnl, win: netPnl > 0 });
              inPos = false;
            }
          } else if (!inPos && fIdx >= 0 && i >= 60 && i <= 390) {
            const f = sBars5m[fIdx];
            if (f.sector_spread_15m !== undefined && f.sector_spread_15m <= thresh && f.rvol >= 1.2) {
              const friction = (cfg.spreadBps / 2 + cfg.slipBps) / 10000;
              const nextBar = sBars1m[i + 1] || b1m;
              entryPrice = nextBar.open * (1 + friction);
              const notional = cash * cfg.alloc;
              qty = Math.floor(notional / entryPrice);

              if (qty > 0) {
                const entryFee = Math.max(cfg.minComm, qty * entryPrice * cfg.commRate);
                if (cash >= qty * entryPrice + entryFee) {
                  cash -= qty * entryPrice + entryFee;
                  entryIdx = i + 1;
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
      const gross = trades.reduce((a, b) => a + b.grossPnl, 0);
      const net = trades.reduce((a, b) => a + b.netPnl, 0);
      const netRet = (cash - cfg.capital) / cfg.capital;
      const posNet = trades.filter((t) => t.netPnl > 0).reduce((a, b) => a + b.netPnl, 0);
      const negNet = Math.abs(trades.filter((t) => t.netPnl < 0).reduce((a, b) => a + b.netPnl, 0));
      const pf = negNet === 0 ? 99.9 : posNet / (negNet || 1);

      if (net > 0 && winRate >= 0.5) {
        console.log(`| ${(thresh * 10000).toFixed(0).padStart(13)} | ${hold.toString().padStart(8)} | ${trades.length.toString().padStart(6)} | ${(winRate * 100).toFixed(1).padStart(7)}% | €${gross.toFixed(1).padStart(8)} | €${net.toFixed(1).padStart(7)} | ${(netRet * 100).toFixed(2).padStart(6)}% | ${(maxDD * 100).toFixed(2).padStart(5)}% | ${pf.toFixed(2).padStart(13)} | *** PROFITABLE ***`);
      } else {
        console.log(`| ${(thresh * 10000).toFixed(0).padStart(13)} | ${hold.toString().padStart(8)} | ${trades.length.toString().padStart(6)} | ${(winRate * 100).toFixed(1).padStart(7)}% | €${gross.toFixed(1).padStart(8)} | €${net.toFixed(1).padStart(7)} | ${(netRet * 100).toFixed(2).padStart(6)}% | ${(maxDD * 100).toFixed(2).padStart(5)}% | ${pf.toFixed(2).padStart(13)} |`);
      }
    }
  }
}

optimizeSectorCatchup();
