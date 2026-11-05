import { BootstrapCI, DailyEquity, EvidenceAssessment, PerformanceMetrics, Trade } from '../types';
import { createRNG } from './syntheticData';

export function blockBootstrapMeanCI(
  returns: number[],
  blockLength: number = 5,
  nBootstrap: number = 2000,
  alpha: number = 0.05,
  seed: number = 17
): BootstrapCI {
  const n = returns.length;
  if (n === 0) {
    return {
      mean: 0,
      lower: 0,
      upper: 0,
      alpha,
      block_length: blockLength,
      n_observations: 0,
      n_bootstrap: nBootstrap,
      method: 'circular_block_bootstrap',
    };
  }

  const sampleMean = returns.reduce((a, b) => a + b, 0) / n;
  const rng = createRNG(seed);
  const bootstrapMeans: number[] = new Float64Array(nBootstrap) as unknown as number[];

  const numBlocks = Math.ceil(n / blockLength);

  for (let b = 0; b < nBootstrap; b++) {
    let sum = 0;
    let count = 0;
    for (let blk = 0; blk < numBlocks; blk++) {
      const startIdx = Math.floor(rng() * n);
      for (let k = 0; k < blockLength; k++) {
        if (count >= n) break;
        const idx = (startIdx + k) % n;
        sum += returns[idx];
        count++;
      }
    }
    bootstrapMeans[b] = sum / n;
  }

  bootstrapMeans.sort((a, b) => a - b);
  const lowerIdx = Math.floor((alpha / 2) * nBootstrap);
  const upperIdx = Math.floor((1 - alpha / 2) * nBootstrap);

  return {
    mean: Math.round(sampleMean * 100000) / 100000,
    lower: Math.round(bootstrapMeans[lowerIdx] * 100000) / 100000,
    upper: Math.round(bootstrapMeans[upperIdx] * 100000) / 100000,
    alpha,
    block_length: blockLength,
    n_observations: n,
    n_bootstrap: nBootstrap,
    method: 'circular_block_bootstrap',
  };
}

export function summarizePerformance(
  equity: DailyEquity[],
  trades: Trade[],
  initialCash: number = 10000.0,
  familySize: number = 12
): PerformanceMetrics {
  const nSessions = equity.length;
  if (nSessions === 0) {
    return {
      net_return: 0,
      annualized_return: 0,
      max_drawdown: 0,
      worst_day: 0,
      worst_week: 0,
      win_rate: 0,
      trades: 0,
      active_day_fraction: 0,
      active_week_fraction: 0,
      longest_no_trade_sessions: 0,
      mean_daily_return: 0,
      mean_trade_net_return: 0,
      profit_factor: null,
      total_fees: 0,
      total_net_pnl: 0,
      sharpe_ratio: 0,
      bootstrap_ci: blockBootstrapMeanCI([]),
    };
  }

  const finalEquity = equity[nSessions - 1].equity;
  const netReturn = (finalEquity - initialCash) / initialCash;
  const annualizedReturn = Math.pow(Math.max(0.01, 1 + netReturn), 252 / nSessions) - 1;

  const maxDrawdown = Math.max(...equity.map((e) => e.drawdown_pct)) / 100;
  const dailyReturns = equity.map((e) => e.daily_return);
  const worstDay = Math.min(...dailyReturns);

  // Group by week (ISO weeks)
  const weeklyReturns: number[] = [];
  let currentWeekProduct = 1.0;
  let currentWeekTradeCount = 0;
  let activeWeeks = 0;
  let totalWeeks = 0;

  for (let i = 0; i < nSessions; i++) {
    currentWeekProduct *= 1 + dailyReturns[i];
    currentWeekTradeCount += equity[i].trade_count;

    if (i % 5 === 4 || i === nSessions - 1) {
      totalWeeks++;
      weeklyReturns.push(currentWeekProduct - 1);
      if (currentWeekTradeCount > 0) activeWeeks++;
      currentWeekProduct = 1.0;
      currentWeekTradeCount = 0;
    }
  }

  const worstWeek = weeklyReturns.length > 0 ? Math.min(...weeklyReturns) : 0;

  // Trades statistics
  const tradeWins = trades.filter((t) => t.net_pnl > 0);
  const tradeLosses = trades.filter((t) => t.net_pnl < 0);
  const winRate = trades.length > 0 ? tradeWins.length / trades.length : 0;

  const grossGains = tradeWins.reduce((acc, t) => acc + t.net_pnl, 0);
  const grossLosses = Math.abs(tradeLosses.reduce((acc, t) => acc + t.net_pnl, 0));
  const profitFactor = grossLosses > 0 ? grossGains / grossLosses : grossGains > 0 ? 99.0 : null;

  const totalFees = trades.reduce((acc, t) => acc + t.total_fees, 0);
  const totalNetPnl = trades.reduce((acc, t) => acc + t.net_pnl, 0);

  const activeDays = equity.filter((e) => e.trade_count > 0).length;
  const activeDayFraction = activeDays / nSessions;
  const activeWeekFraction = totalWeeks > 0 ? activeWeeks / totalWeeks : 0;

  let longestNoTrade = 0;
  let currentNoTrade = 0;
  for (const e of equity) {
    if (e.trade_count === 0) {
      currentNoTrade++;
      if (currentNoTrade > longestNoTrade) longestNoTrade = currentNoTrade;
    } else {
      currentNoTrade = 0;
    }
  }

  const meanDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / nSessions;
  const meanTradeReturn = trades.length > 0 ? trades.reduce((a, t) => a + t.net_return, 0) / trades.length : 0;

  const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - meanDailyReturn, 2), 0) / nSessions;
  const stdDaily = Math.sqrt(variance);
  const sharpeRatio = stdDaily > 0 ? (meanDailyReturn / stdDaily) * Math.sqrt(252) : 0;

  // Bonferroni multiple testing adjustment
  const bonferroniAlpha = 0.05 / Math.max(1, familySize);
  const bootstrapCI = blockBootstrapMeanCI(dailyReturns, 5, 3000, bonferroniAlpha, 17);

  return {
    net_return: Math.round(netReturn * 10000) / 10000,
    annualized_return: Math.round(annualizedReturn * 10000) / 10000,
    max_drawdown: Math.round(maxDrawdown * 10000) / 10000,
    worst_day: Math.round(worstDay * 10000) / 10000,
    worst_week: Math.round(worstWeek * 10000) / 10000,
    win_rate: Math.round(winRate * 1000) / 1000,
    trades: trades.length,
    active_day_fraction: Math.round(activeDayFraction * 1000) / 1000,
    active_week_fraction: Math.round(activeWeekFraction * 1000) / 1000,
    longest_no_trade_sessions: longestNoTrade,
    mean_daily_return: Math.round(meanDailyReturn * 100000) / 100000,
    mean_trade_net_return: Math.round(meanTradeReturn * 100000) / 100000,
    profit_factor: profitFactor !== null ? Math.round(profitFactor * 100) / 100 : null,
    total_fees: Math.round(totalFees * 100) / 100,
    total_net_pnl: Math.round(totalNetPnl * 100) / 100,
    sharpe_ratio: Math.round(sharpeRatio * 100) / 100,
    bootstrap_ci: bootstrapCI,
  };
}

export function assessEvidence(
  metrics: PerformanceMetrics,
  isSynthetic: boolean = true,
  isHoldout: boolean = false,
  provenanceVerified: boolean = false
): EvidenceAssessment {
  const criteria = {
    min_evaluation_sessions: isHoldout ? 30 : 60,
    min_trades: isHoldout ? 15 : 30,
    min_active_week_fraction: 0.6,
    max_drawdown: 0.1,
    min_mean_daily_return: 0.0,
  };

  const passedChecks: string[] = [];
  const failedChecks: string[] = [];

  if (metrics.trades >= criteria.min_trades) {
    passedChecks.push(`Sample trades (${metrics.trades} >= ${criteria.min_trades})`);
  } else {
    failedChecks.push(`Insufficient sample trades (${metrics.trades} < ${criteria.min_trades})`);
  }

  if (metrics.active_week_fraction >= criteria.min_active_week_fraction) {
    passedChecks.push(`Active week frequency (${(metrics.active_week_fraction * 100).toFixed(1)}% >= 60%)`);
  } else {
    failedChecks.push(`Frequency too sparse (${(metrics.active_week_fraction * 100).toFixed(1)}% < 60%)`);
  }

  if (metrics.max_drawdown <= criteria.max_drawdown) {
    passedChecks.push(`Max drawdown bound (${(metrics.max_drawdown * 100).toFixed(1)}% <= 10.0%)`);
  } else {
    failedChecks.push(`Max drawdown violated (${(metrics.max_drawdown * 100).toFixed(1)}% > 10.0%)`);
  }

  if (metrics.bootstrap_ci.lower > criteria.min_mean_daily_return) {
    passedChecks.push(`Bootstrap lower 95% CI bound positive (${metrics.bootstrap_ci.lower} > 0.0)`);
  } else {
    failedChecks.push(`Bootstrap lower bound non-positive (${metrics.bootstrap_ci.lower} <= 0.0)`);
  }

  const caveats: string[] = [
    'Drawdown measured at daily market close; intrabar drawdowns are not bounded.',
    'Assumes 1-minute execution delay and bar proxy fills; actual limit order queue priority is unmodeled.',
    'Execution fees include €3.00 minimum ticket and 10 bps round-trip spread.',
  ];

  let status: EvidenceAssessment['status'] = 'RESEARCH_ONLY';
  if (isSynthetic) {
    status = 'SYNTHETIC_DEMO';
    caveats.unshift('All price, volume, and quote records are synthetic demonstrations; no real UCG data used.');
  } else if (failedChecks.length === 0 && provenanceVerified) {
    status = isHoldout ? 'PAPER_CANDIDATE' : 'HISTORICAL_CANDIDATE';
  }

  return {
    status,
    eligible_for_live: false,
    criteria,
    passed_checks: passedChecks,
    failed_checks: failedChecks,
    caveats,
  };
}
