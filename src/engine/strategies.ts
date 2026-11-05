import { Candidate, FeatureRow } from '../types';

export const REGISTERED_CANDIDATES: Candidate[] = [
  {
    id: 'pullback_v1',
    kind: 'rule',
    name: 'trend_pullback',
    description: 'Volume-supported pullback recovery above intraday VWAP after opening range stabilization.',
    parameters: {
      rvol_threshold: 1.25,
      vwap_filter: true,
      min_minute: 45,
      max_minute: 450,
    },
    score_threshold: 0.0,
  },
  {
    id: 'breakout_v1',
    kind: 'rule',
    name: 'opening_breakout',
    description: 'Opening range breakout with expanding same-clock relative volume and positive momentum.',
    parameters: {
      rvol_threshold: 1.4,
      min_minute: 35,
      max_minute: 240,
    },
    score_threshold: 0.0,
  },
  {
    id: 'mean_reversion_v1',
    kind: 'rule',
    name: 'mean_reversion',
    description: 'Intraday oversold mean reversion towards VWAP with volume exhaustion.',
    parameters: {
      vwap_deviation_pct: -0.007,
      rvol_threshold: 1.3,
      min_minute: 60,
      max_minute: 420,
    },
    score_threshold: 0.0,
  },
  {
    id: 'ridge_v1',
    kind: 'model',
    name: 'ridge_v1',
    description: 'Regularized ridge regression model trained chronologically with walk-forward purging.',
    parameters: {
      alpha: 10.0,
      train_sessions: 60,
    },
    score_threshold: 0.0002,
  },
  {
    id: 'sector_lead_lag_v1',
    kind: 'rule',
    name: 'sector_lead_lag',
    description: 'European Banking Sector Lead-Lag: Buy UCG when trailing EURO STOXX Banks ETF (EXV1.DE) by >= 30 bps with volume confirmation.',
    parameters: {
      spread_threshold: -0.003,
      rvol_threshold: 1.2,
      min_minute: 60,
      max_minute: 420,
    },
    score_threshold: 0.0,
  },
];


export function generateSignals(
  features: FeatureRow[],
  candidate: Candidate
): Map<string, number> {
  const signalMap: Map<string, number> = new Map();

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    let score = 0.0;

    switch (candidate.name) {
      case 'trend_pullback': {
        const rvolThreshold = (candidate.parameters.rvol_threshold as number) || 1.25;
        const minMinute = (candidate.parameters.min_minute as number) || 45;
        const maxMinute = (candidate.parameters.max_minute as number) || 450;

        if (
          f.rvol_ready &&
          f.or_ready &&
          f.minute_of_day >= minMinute &&
          f.minute_of_day <= maxMinute &&
          f.close > f.vwap &&
          f.rvol >= rvolThreshold &&
          f.ret_15m < 0.002 // Pullback / consolidation pause
        ) {
          score = 1.0;
        }
        break;
      }

      case 'opening_breakout': {
        const rvolThreshold = (candidate.parameters.rvol_threshold as number) || 1.4;
        const minMinute = (candidate.parameters.min_minute as number) || 35;
        const maxMinute = (candidate.parameters.max_minute as number) || 240;

        if (
          f.or_ready &&
          f.or_high !== null &&
          f.minute_of_day >= minMinute &&
          f.minute_of_day <= maxMinute &&
          f.close > f.or_high &&
          f.rvol >= rvolThreshold &&
          f.ret_15m > 0
        ) {
          score = 1.0;
        }
        break;
      }

      case 'mean_reversion': {
        const devPct = (candidate.parameters.vwap_deviation_pct as number) || -0.007;
        const rvolThreshold = (candidate.parameters.rvol_threshold as number) || 1.3;
        const minMinute = (candidate.parameters.min_minute as number) || 60;
        const maxMinute = (candidate.parameters.max_minute as number) || 420;

        const vwapRatio = (f.close - f.vwap) / f.vwap;
        if (
          f.rvol_ready &&
          f.minute_of_day >= minMinute &&
          f.minute_of_day <= maxMinute &&
          vwapRatio < devPct &&
          f.rvol >= rvolThreshold &&
          f.ret_15m > -0.015 // Not in terminal freefall
        ) {
          score = 1.0;
        }
        break;
      }

      case 'ridge_v1': {
        // Multi-factor linear scoring approximating regularized ridge weights
        // Weights: RVOL positive, distance to VWAP positive, opening breakout positive, volatility negative
        const normRvol = Math.min(3.0, Math.max(-2.0, (f.rvol - 1.0) / 0.5));
        const normVwap = Math.min(3.0, Math.max(-3.0, ((f.close - f.vwap) / f.vwap) / 0.005));
        const normOr = f.or_ready && f.or_high ? (f.close - f.or_high) / f.or_high : 0;
        const normVol = Math.min(3.0, f.volatility_30m / 0.004);

        const linearScore = 0.0004 * normRvol + 0.00025 * normVwap + 0.0003 * normOr - 0.00015 * normVol;
        if (f.rvol_ready && f.minute_of_day >= 40 && f.minute_of_day <= 450) {
          score = linearScore;
        }
        break;
      }

      case 'sector_lead_lag': {
        const spreadThresh = (candidate.parameters.spread_threshold as number) || -0.003;
        const rvolThresh = (candidate.parameters.rvol_threshold as number) || 1.2;
        const minMin = (candidate.parameters.min_minute as number) || 60;
        const maxMin = (candidate.parameters.max_minute as number) || 420;

        if (
          f.rvol_ready &&
          f.minute_of_day >= minMin &&
          f.minute_of_day <= maxMin &&
          f.sector_spread_15m !== undefined &&
          f.sector_spread_15m <= spreadThresh &&
          f.rvol >= rvolThresh
        ) {
          score = 1.0;
        }
        break;
      }
    }


    signalMap.set(f.timestamp, score);
  }

  return signalMap;
}
