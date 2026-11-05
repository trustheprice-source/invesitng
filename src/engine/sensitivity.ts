import { Bar1m, Candidate, ExecutionConfig, FeatureRow, SensitivityScenario } from '../types';
import { runBacktest } from './backtest';
import { summarizePerformance } from './statistics';

export function runSensitivityAnalysis(
  bars1m: Bar1m[],
  features: FeatureRow[],
  candidate: Candidate,
  baseConfig: ExecutionConfig,
  sessionFilter?: Set<string>
): SensitivityScenario[] {
  const scenariosToTest: {
    name: string;
    spread_bps: number;
    slippage_bps: number;
    latency_minutes: number;
    min_fee: number;
  }[] = [
    {
      name: 'Baseline Reality',
      spread_bps: baseConfig.round_trip_spread_bps,
      slippage_bps: baseConfig.slippage_bps_per_side,
      latency_minutes: baseConfig.latency_minutes,
      min_fee: baseConfig.minimum_commission,
    },
    {
      name: 'Tight Spread (5 bps)',
      spread_bps: 5.0,
      slippage_bps: 1.0,
      latency_minutes: 1,
      min_fee: 3.0,
    },
    {
      name: 'Wider Spread (15 bps)',
      spread_bps: 15.0,
      slippage_bps: 3.0,
      latency_minutes: 1,
      min_fee: 3.0,
    },
    {
      name: 'Heavy Slippage (5 bps/side)',
      spread_bps: 10.0,
      slippage_bps: 5.0,
      latency_minutes: 1,
      min_fee: 3.0,
    },
    {
      name: '2-Minute Execution Latency',
      spread_bps: 10.0,
      slippage_bps: 2.0,
      latency_minutes: 2,
      min_fee: 3.0,
    },
    {
      name: '3-Minute Execution Latency',
      spread_bps: 10.0,
      slippage_bps: 2.0,
      latency_minutes: 3,
      min_fee: 3.0,
    },
    {
      name: 'Zero Minimum Ticket (€0 Fee)',
      spread_bps: 10.0,
      slippage_bps: 2.0,
      latency_minutes: 1,
      min_fee: 0.0,
    },
    {
      name: 'Extreme Cost Stress (20 bps / €5)',
      spread_bps: 20.0,
      slippage_bps: 8.0,
      latency_minutes: 2,
      min_fee: 5.0,
    },
  ];

  return scenariosToTest.map((sc) => {
    const testConfig: ExecutionConfig = {
      ...baseConfig,
      round_trip_spread_bps: sc.spread_bps,
      slippage_bps_per_side: sc.slippage_bps,
      latency_minutes: sc.latency_minutes,
      minimum_commission: sc.min_fee,
    };

    const res = runBacktest(bars1m, features, candidate, testConfig, sessionFilter);
    const metrics = summarizePerformance(res.equity, res.trades, testConfig.initial_cash, 12);

    return {
      name: sc.name,
      spread_bps: sc.spread_bps,
      slippage_bps: sc.slippage_bps,
      latency_minutes: sc.latency_minutes,
      min_fee: sc.min_fee,
      net_return: metrics.net_return,
      max_drawdown: metrics.max_drawdown,
      win_rate: metrics.win_rate,
      profit_factor: metrics.profit_factor,
      trades_count: metrics.trades,
    };
  });
}
