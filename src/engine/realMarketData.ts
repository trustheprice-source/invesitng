import { Bar1m, Bar5m, FeatureRow } from '../types';

export interface RealMarketDataset {
  symbol: string;
  exchange: string;
  currency: string;
  current_price: number;
  bars5m: Bar5m[];
  bars1m: Bar1m[];
  sessions: { session_date: string; is_holdout: boolean; minutes_count: number }[];
  datasetHash: string;
  source_provenance: 'REAL_EURONEXT_MILAN' | 'SYNTHETIC_FALLBACK';
}

export function parseYahooChartResponse(
  json: any,
  sectorJson?: any,
  mibJson?: any
): Bar5m[] {
  if (!json?.chart?.result?.[0]) return [];

  const result = json.chart.result[0];
  const timestamps: number[] = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens: number[] = quote.open || [];
  const highs: number[] = quote.high || [];
  const lows: number[] = quote.low || [];
  const closes: number[] = quote.close || [];
  const volumes: number[] = quote.volume || [];

  // Sector and MIB lookups by timestamp
  const sectorCloses = new Map<number, number>();
  if (sectorJson?.chart?.result?.[0]?.timestamp) {
    const sTs = sectorJson.chart.result[0].timestamp;
    const sClose = sectorJson.chart.result[0].indicators?.quote?.[0]?.close || [];
    for (let i = 0; i < sTs.length; i++) {
      if (sClose[i] !== null) sectorCloses.set(sTs[i], sClose[i]);
    }
  }

  const mibCloses = new Map<number, number>();
  if (mibJson?.chart?.result?.[0]?.timestamp) {
    const mTs = mibJson.chart.result[0].timestamp;
    const mClose = mibJson.chart.result[0].indicators?.quote?.[0]?.close || [];
    for (let i = 0; i < mTs.length; i++) {
      if (mClose[i] !== null) mibCloses.set(mTs[i], mClose[i]);
    }
  }

  const bars: Bar5m[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const tsSec = timestamps[i];
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i];

    // Filter null or non-finite points
    if (o == null || h == null || l == null || c == null || !isFinite(o) || !isFinite(c)) {
      continue;
    }

    const date = new Date(tsSec * 1000);
    // Parse Europe/Rome local time (continuous trading 09:00 to 17:30 CET/CEST)
    const romeTimeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const hours = parseInt(romeTimeParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minutes = parseInt(romeTimeParts.find((p) => p.type === 'minute')?.value || '0', 10);
    const sessionDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(date);
    const timeLabel = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const minuteOfDay = (hours - 9) * 60 + minutes; // Relative to 09:00 Rome continuous open

    // Filter only exchange active hours (09:00 to 17:30 Rome time)
    if (minuteOfDay < 0 || minuteOfDay > 510) continue;

    bars.push({
      timestamp: date.toISOString(),
      time_label: timeLabel,
      open: Math.round(o * 1000) / 1000,
      high: Math.round(Math.max(o, c, h) * 1000) / 1000,
      low: Math.round(Math.min(o, c, l) * 1000) / 1000,
      close: Math.round(c * 1000) / 1000,
      volume: Math.max(10, Math.floor(v || 1000)),
      session_date: sessionDate,
      minute_of_day: minuteOfDay,
      banking_etf_close: sectorCloses.get(tsSec),
      ftse_mib_close: mibCloses.get(tsSec),
    });
  }

  return bars;
}

// Compute multi-horizon forward returns and advanced sector features
export function enrichWithMultiHorizonFeatures(bars5m: Bar5m[]): FeatureRow[] {
  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();
  const historicalBucketVolumes: Map<number, number[]> = new Map();
  const features: FeatureRow[] = [];

  let prevSessionClose: number | null = null;

  for (const sDate of sessionDates) {
    const sessionBars = bars5m.filter((b) => b.session_date === sDate);
    if (sessionBars.length === 0) continue;

    let cumVolume = 0;
    let cumVolPrice = 0;
    let orHigh: number | null = null;
    let orLow: number | null = null;
    const sessionOpenPrice = sessionBars[0].open;
    const gapReturn = prevSessionClose ? (sessionOpenPrice - prevSessionClose) / prevSessionClose : 0;

    for (let i = 0; i < sessionBars.length; i++) {
      const b = sessionBars[i];
      cumVolume += b.volume;
      cumVolPrice += b.close * b.volume;
      const vwap = cumVolume > 0 ? cumVolPrice / cumVolume : b.close;

      // 30-minute opening range
      if (b.minute_of_day === 30 || (b.minute_of_day >= 30 && orHigh === null)) {
        let maxH = -Infinity;
        let minL = Infinity;
        for (let j = 0; j <= i; j++) {
          if (sessionBars[j].high > maxH) maxH = sessionBars[j].high;
          if (sessionBars[j].low < minL) minL = sessionBars[j].low;
        }
        orHigh = maxH;
        orLow = minL;
      }
      const orReady = b.minute_of_day >= 30 && orHigh !== null && orLow !== null;

      // Same-clock relative volume
      const priorVols = historicalBucketVolumes.get(b.minute_of_day) || [];
      const rvolReady = priorVols.length >= 5;
      let rvol = 1.0;
      if (priorVols.length > 0) {
        const lookback = priorVols.slice(-20);
        const meanVol = lookback.reduce((acc, v) => acc + v, 0) / lookback.length;
        rvol = meanVol > 0 ? b.volume / meanVol : 1.0;
      }

      // Rolling returns
      const ret15m = i >= 3 ? (b.close - sessionBars[i - 3].close) / sessionBars[i - 3].close : 0;
      const ret60m = i >= 12 ? (b.close - sessionBars[i - 12].close) / sessionBars[i - 12].close : 0;

      // Volatility
      let vol30m = 0;
      if (i >= 5) {
        const changes: number[] = [];
        for (let k = i - 5; k <= i; k++) {
          changes.push((sessionBars[k].high - sessionBars[k].low) / sessionBars[k].close);
        }
        const meanChg = changes.reduce((acc, v) => acc + v, 0) / changes.length;
        const variance = changes.reduce((acc, v) => acc + Math.pow(v - meanChg, 2), 0) / changes.length;
        vol30m = Math.sqrt(variance);
      }

      // Sector spread (relative to European banking ETF)
      let sectorSpread15m = 0;
      if (b.banking_etf_close && i >= 3 && sessionBars[i - 3].banking_etf_close) {
        const bankRet15m = (b.banking_etf_close - sessionBars[i - 3].banking_etf_close!) / sessionBars[i - 3].banking_etf_close!;
        sectorSpread15m = ret15m - bankRet15m;
      }

      // Multi-horizon forward returns (5m = 1 bar, 15m = 3 bars, 30m = 6 bars, 60m = 12 bars, 120m = 24 bars)
      const fwdRet5m = i + 1 < sessionBars.length ? (sessionBars[i + 1].close - b.close) / b.close : undefined;
      const fwdRet15m = i + 3 < sessionBars.length ? (sessionBars[i + 3].close - b.close) / b.close : undefined;
      const fwdRet30m = i + 6 < sessionBars.length ? (sessionBars[i + 6].close - b.close) / b.close : undefined;
      const fwdRet60m = i + 12 < sessionBars.length ? (sessionBars[i + 12].close - b.close) / b.close : undefined;
      const fwdRet120m = i + 24 < sessionBars.length ? (sessionBars[i + 24].close - b.close) / b.close : undefined;

      features.push({
        ...b,
        rvol: Math.round(rvol * 100) / 100,
        rvol_ready: rvolReady,
        or_high: orHigh,
        or_low: orLow,
        or_ready: orReady,
        vwap: Math.round(vwap * 1000) / 1000,
        ret_15m: Math.round(ret15m * 10000) / 10000,
        ret_60m: Math.round(ret60m * 10000) / 10000,
        volatility_30m: Math.round(vol30m * 10000) / 10000,
        gap_return: Math.round(gapReturn * 10000) / 10000,
        news_count_60m: 0,
        sector_spread_15m: Math.round(sectorSpread15m * 10000) / 10000,
        fwd_ret_5m: fwdRet5m !== undefined ? Math.round(fwdRet5m * 10000) / 10000 : undefined,
        fwd_ret_15m: fwdRet15m !== undefined ? Math.round(fwdRet15m * 10000) / 10000 : undefined,
        fwd_ret_30m: fwdRet30m !== undefined ? Math.round(fwdRet30m * 10000) / 10000 : undefined,
        fwd_ret_60m: fwdRet60m !== undefined ? Math.round(fwdRet60m * 10000) / 10000 : undefined,
        fwd_ret_120m: fwdRet120m !== undefined ? Math.round(fwdRet120m * 10000) / 10000 : undefined,
      });
    }

    for (const b of sessionBars) {
      if (!historicalBucketVolumes.has(b.minute_of_day)) {
        historicalBucketVolumes.set(b.minute_of_day, []);
      }
      historicalBucketVolumes.get(b.minute_of_day)!.push(b.volume);
    }

    prevSessionClose = sessionBars[sessionBars.length - 1].close;
  }

  return features;
}

// Convert 5m bars to 1m proxy bars for backtester compatibility
export function generate1mProxyFrom5m(bars5m: Bar5m[]): Bar1m[] {
  const bars1m: Bar1m[] = [];

  for (const b5 of bars5m) {
    const baseDate = new Date(b5.timestamp);
    const open = b5.open;
    const close = b5.close;
    const high = b5.high;
    const low = b5.low;
    const volPerMin = Math.floor(b5.volume / 5);

    for (let m = 0; m < 5; m++) {
      const minDate = new Date(baseDate.getTime() - (4 - m) * 60 * 1000);
      const frac = m / 4;
      const mOpen = open + (close - open) * (m / 5);
      const mClose = open + (close - open) * ((m + 1) / 5);
      const mHigh = m === 2 ? high : Math.max(mOpen, mClose);
      const mLow = m === 1 ? low : Math.min(mOpen, mClose);

      bars1m.push({
        timestamp: minDate.toISOString(),
        session_date: b5.session_date,
        open: Math.round(mOpen * 1000) / 1000,
        high: Math.round(mHigh * 1000) / 1000,
        low: Math.round(mLow * 1000) / 1000,
        close: Math.round(mClose * 1000) / 1000,
        volume: volPerMin,
      });
    }
  }

  return bars1m;
}
