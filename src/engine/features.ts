import { Bar1m, Bar5m, FeatureRow } from '../types';

export function aggregateTo5m(bars1m: Bar1m[]): Bar5m[] {
  const bars5m: Bar5m[] = [];
  const sessionGroups: Map<string, Bar1m[]> = new Map();

  for (const bar of bars1m) {
    if (!sessionGroups.has(bar.session_date)) {
      sessionGroups.set(bar.session_date, []);
    }
    sessionGroups.get(bar.session_date)!.push(bar);
  }

  for (const [sessionDate, sessionBars] of sessionGroups) {
    const totalBars = sessionBars.length;
    for (let i = 0; i + 4 < totalBars; i += 5) {
      const chunk = sessionBars.slice(i, i + 5);
      const open = chunk[0].open;
      const close = chunk[4].close;
      let high = -Infinity;
      let low = Infinity;
      let volume = 0;

      for (const b of chunk) {
        if (b.high > high) high = b.high;
        if (b.low < low) low = b.low;
        volume += b.volume;
      }

      const lastBar = chunk[4];
      const timePart = lastBar.timestamp.split('T')[1].substring(0, 5); // HH:MM
      const minuteOfDay = i + 5;

      bars5m.push({
        timestamp: lastBar.timestamp,
        time_label: timePart,
        open,
        high,
        low,
        close,
        volume,
        session_date: sessionDate,
        minute_of_day: minuteOfDay,
      });
    }
  }

  return bars5m;
}

export function computeCausalFeatures(bars5m: Bar5m[]): FeatureRow[] {
  const features: FeatureRow[] = [];
  const sessionDates = Array.from(new Set(bars5m.map((b) => b.session_date))).sort();

  // Volume history matrix: map from minute_of_day -> array of volumes for past sessions
  const historicalBucketVolumes: Map<number, number[]> = new Map();

  // Store previous session closing prices for gap return
  const sessionClosePrices: Map<string, number> = new Map();

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

      // 30-minute opening range is formed after bar 6 (6 * 5m = 30m)
      if (b.minute_of_day === 30) {
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

      // Prior same-clock volume baseline
      const priorVols = historicalBucketVolumes.get(b.minute_of_day) || [];
      const rvolReady = priorVols.length >= 10;
      let rvol = 1.0;
      if (priorVols.length > 0) {
        const lookback = priorVols.slice(-20);
        const meanVol = lookback.reduce((acc, v) => acc + v, 0) / lookback.length;
        rvol = meanVol > 0 ? b.volume / meanVol : 1.0;
      }

      // Rolling returns within same session
      const ret15m = i >= 3 ? (b.close - sessionBars[i - 3].close) / sessionBars[i - 3].close : 0;
      const ret60m = i >= 12 ? (b.close - sessionBars[i - 12].close) / sessionBars[i - 12].close : 0;

      // Rolling 30m volatility (6 bars)
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
      });
    }

    // After session finishes, record bucket volumes into historical baseline
    for (const b of sessionBars) {
      if (!historicalBucketVolumes.has(b.minute_of_day)) {
        historicalBucketVolumes.set(b.minute_of_day, []);
      }
      historicalBucketVolumes.get(b.minute_of_day)!.push(b.volume);
    }

    prevSessionClose = sessionBars[sessionBars.length - 1].close;
    sessionClosePrices.set(sDate, prevSessionClose);
  }

  return features;
}
