import { AnalogMatch, FeatureRow, PredictionHorizon } from '../types';

export function findHistoricalAnalogs(
  targetFeature: FeatureRow,
  allFeatures: FeatureRow[],
  maxCases: number = 10
): {
  analogs: AnalogMatch[];
  summary: {
    total_matches: number;
    win_rate_30m: number;
    median_return_30m: number;
    mean_return_30m: number;
    horizon_means: Record<PredictionHorizon, number>;
  };
} {
  const targetNormVwap = targetFeature.vwap > 0 ? (targetFeature.close - targetFeature.vwap) / targetFeature.vwap : 0;
  const targetRvol = targetFeature.rvol;
  const targetRet15m = targetFeature.ret_15m;
  const targetVol = targetFeature.volatility_30m;

  const candidates: { feature: FeatureRow; distance: number }[] = [];

  for (const f of allFeatures) {
    // Avoid comparing against identical current session
    if (f.session_date === targetFeature.session_date) continue;
    // Only compare if valid forward outcomes exist
    if (f.fwd_ret_30m === undefined || !f.rvol_ready) continue;

    const fNormVwap = f.vwap > 0 ? (f.close - f.vwap) / f.vwap : 0;
    const fRvol = f.rvol;
    const fRet15m = f.ret_15m;
    const fVol = f.volatility_30m;

    // Euclidean distance in standardized feature space
    const dVwap = Math.pow((targetNormVwap - fNormVwap) / 0.005, 2);
    const dRvol = Math.pow((targetRvol - fRvol) / 0.6, 2);
    const dRet = Math.pow((targetRet15m - fRet15m) / 0.004, 2);
    const dVol = Math.pow((targetVol - fVol) / 0.003, 2);
    const dTime = Math.pow((targetFeature.minute_of_day - f.minute_of_day) / 60, 2);

    const distance = Math.sqrt(dVwap * 2.0 + dRvol * 1.5 + dRet * 1.5 + dVol * 1.0 + dTime * 0.8);
    candidates.push({ feature: f, distance });
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const topCases = candidates.slice(0, maxCases);

  const analogs: AnalogMatch[] = topCases.map(({ feature: f, distance }) => {
    const similarity = Math.max(0, Math.round((1 / (1 + distance * 0.4)) * 100));
    return {
      session_date: f.session_date,
      time_label: f.time_label,
      similarity_score: similarity,
      historical_price: f.close,
      rvol: f.rvol,
      fwd_return_5m: f.fwd_ret_5m ?? 0,
      fwd_return_15m: f.fwd_ret_15m ?? 0,
      fwd_return_30m: f.fwd_ret_30m ?? 0,
      fwd_return_60m: f.fwd_ret_60m ?? 0,
      fwd_return_120m: f.fwd_ret_120m ?? 0,
      is_winner_30m: (f.fwd_ret_30m ?? 0) > 0,
    };
  });

  const winners30m = analogs.filter((a) => a.is_winner_30m);
  const winRate30m = analogs.length > 0 ? winners30m.length / analogs.length : 0;
  const rets30m = analogs.map((a) => a.fwd_return_30m).sort((a, b) => a - b);
  const medianRet30m = rets30m.length > 0 ? rets30m[Math.floor(rets30m.length / 2)] : 0;
  const meanRet30m = rets30m.length > 0 ? rets30m.reduce((a, b) => a + b, 0) / rets30m.length : 0;

  const horizonMeans: Record<PredictionHorizon, number> = {
    5: analogs.length > 0 ? analogs.reduce((a, b) => a + b.fwd_return_5m, 0) / analogs.length : 0,
    15: analogs.length > 0 ? analogs.reduce((a, b) => a + b.fwd_return_15m, 0) / analogs.length : 0,
    30: meanRet30m,
    60: analogs.length > 0 ? analogs.reduce((a, b) => a + b.fwd_return_60m, 0) / analogs.length : 0,
    120: analogs.length > 0 ? analogs.reduce((a, b) => a + b.fwd_return_120m, 0) / analogs.length : 0,
  };

  return {
    analogs,
    summary: {
      total_matches: analogs.length,
      win_rate_30m: Math.round(winRate30m * 1000) / 1000,
      median_return_30m: Math.round(medianRet30m * 10000) / 10000,
      mean_return_30m: Math.round(meanRet30m * 10000) / 10000,
      horizon_means: horizonMeans,
    },
  };
}
