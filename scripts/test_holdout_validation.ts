import fs from 'fs';
import { parseYahooChartResponse, enrichWithMultiHorizonFeatures, generate1mProxyFrom5m } from '../src/engine/realMarketData';

function testHoldoutValidation() {
  console.log('=== TESTING SECTOR CATCHUP ON HOLDOUT PARTITION (20 SESSIONS) ===');
  const rawCache = JSON.parse(fs.readFileSync('server_data/real_market_cache.json', 'utf-8'));
  const bars5m = parseYahooChartResponse(rawCache.ucg, rawCache.banking_etf, rawCache.ftse_mib);
  const bars1m = generate1mProxyFrom5m(bars5m);
  const features = enrichWithMultiHorizonFeatures(bars5m);

  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
  const devDates = sessionDates.slice(0, 40);
  const holdoutDates = sessionDates.slice(40);

  const cfg = {
    capital: 50000,
    alloc: 0.25,
    minComm: 3.0,
    commRate: 0.0005,
    spreadBps: 10.0,
    slipBps: 2.0,
  };

  function runOnSessions(dates: string[], label: string) {
    let cash = cfg.capital;
    let peakCash = cash;
    let maxDD = 0;
    const trades: any[] = [];

    for (const sDate of dates) {
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

          const curF = fIdx >= 0 ? sBars5m[fIdx] : null;
          if (curF && curF.sector_spread_15m !== undefined && curF.sector_spread_15m >= 0 && i >= entryIdx + 15) {
            exitReason = 'SECTOR_CAUGHT_UP';
            rawExit = b1m.open;
          } else if (i >= entryIdx + 60) {
            exitReason = 'HOLDING_60M_EXPIRED';
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

            trades.push({ session: sDate, grossPnl, netPnl, win: netPnl > 0, reason: exitReason });
            inPos = false;
          }
        } else if (!inPos && fIdx >= 0 && i >= 60 && i <= 390) {
          const f = sBars5m[fIdx];
          if (f.sector_spread_15m !== undefined && f.sector_spread_15m <= -0.0035 && f.rvol >= 1.2) {
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

    console.log(`[${label}] Sessions: ${dates.length} | Trades: ${trades.length} | Win Rate: ${(winRate * 100).toFixed(1)}% | Gross PnL: €${gross.toFixed(2)} | Net PnL: €${net.toFixed(2)} | Net Return: ${(netRet * 100).toFixed(2)}% | Max DD: ${(maxDD * 100).toFixed(2)}% | Profit Factor: ${pf.toFixed(2)}`);
  }

  runOnSessions(devDates, 'DEVELOPMENT (40 Sessions)');
  runOnSessions(holdoutDates, 'HOLDOUT OOS (20 Sessions)');
  runOnSessions(sessionDates, 'FULL SAMPLE (60 Sessions)');
}

testHoldoutValidation();
