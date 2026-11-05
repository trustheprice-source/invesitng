import { Bar1m, Candidate, DailyEquity, ExecutionConfig, FeatureRow, Trade } from '../types';
import { generateSignals } from './strategies';

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  initial_cash: 10000.0,
  allocation_fraction: 0.25,
  commission_rate: 0.0005,
  minimum_commission: 3.0,
  round_trip_spread_bps: 10.0,
  slippage_bps_per_side: 2.0,
  execution_mode: 'bar_proxy',
  latency_minutes: 1,
  holding_minutes: 30,
  stop_loss_pct: 0.01,
  daily_loss_limit_pct: 0.02,
  score_threshold: 0.0,
  cooldown_minutes: 5,
};

function calculateFee(notional: number, config: ExecutionConfig): number {
  return Math.max(config.minimum_commission, notional * config.commission_rate);
}

export function runBacktest(
  bars1m: Bar1m[],
  features: FeatureRow[],
  candidate: Candidate,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG,
  sessionFilter?: Set<string>
): {
  trades: Trade[];
  equity: DailyEquity[];
} {
  // Pre-generate feature signals
  const signals = generateSignals(features, candidate);

  // Group 1-minute bars by session
  const sessionDates = Array.from(new Set(bars1m.map((b) => b.session_date)))
    .filter((d) => (sessionFilter ? sessionFilter.has(d) : true))
    .sort();

  const barsBySession: Map<string, Bar1m[]> = new Map();
  for (const b of bars1m) {
    if (sessionFilter && !sessionFilter.has(b.session_date)) continue;
    if (!barsBySession.has(b.session_date)) {
      barsBySession.set(b.session_date, []);
    }
    barsBySession.get(b.session_date)!.push(b);
  }

  // Map 5m feature timestamps for easy lookup
  const featureTimestamps = new Set(features.map((f) => f.timestamp));

  let currentCash = config.initial_cash;
  let peakEquity = config.initial_cash;
  const allTrades: Trade[] = [];
  const dailyEquityRows: DailyEquity[] = [];

  let tradeIdCounter = 1;

  for (const sessionDate of sessionDates) {
    const sessionBars = barsBySession.get(sessionDate) || [];
    if (sessionBars.length === 0) continue;

    const sessionStartEquity = currentCash;
    let sessionPnl = 0;
    let sessionTradesCount = 0;
    let dailyBrakeTriggered = false;

    let inPosition = false;
    let activeTrade: Partial<Trade> | null = null;
    let entryBarIndex = -1;
    let stopPrice = 0;
    let lastSignalState = false;
    let cooldownUntil = 0;

    const totalBars = sessionBars.length;
    const liquidationBarIndex = totalBars - 6; // Liquidate 5 minutes before close

    const effectiveHoldingMinutes =
      (typeof candidate.parameters?.holding_minutes === 'number' && candidate.parameters.holding_minutes > 0)
        ? candidate.parameters.holding_minutes
        : candidate.target_horizon_minutes
        ? candidate.target_horizon_minutes
        : config.holding_minutes;

    for (let i = 0; i < totalBars; i++) {
      const bar = sessionBars[i];

      // 1. Check open position exit conditions FIRST (intrabar stop, holding period, or session end)
      if (inPosition && activeTrade) {
        let exitTriggered = false;
        let exitReason: Trade['exit_reason'] = 'time_exit';
        let rawExitPrice = bar.open;

        // Check stop-loss
        if (bar.low <= stopPrice) {
          exitTriggered = true;
          exitReason = 'stop_loss';
          // Intrabar stop approximation at min(open, stopPrice)
          rawExitPrice = Math.min(bar.open, stopPrice);
        } else if (i >= entryBarIndex + effectiveHoldingMinutes) {
          // Time exit
          exitTriggered = true;
          exitReason = 'time_exit';
          rawExitPrice = bar.open;
        } else if (i >= liquidationBarIndex) {
          // Mandatory end-of-session liquidation
          exitTriggered = true;
          exitReason = 'session_end';
          rawExitPrice = bar.open;
        }

        if (exitTriggered) {
          const exitFriction = (config.round_trip_spread_bps / 2 + config.slippage_bps_per_side) / 10000;
          const exitPrice = Math.round(rawExitPrice * (1 - exitFriction) * 1000) / 1000;
          const exitNotional = activeTrade.quantity! * exitPrice;
          const exitFee = Math.round(calculateFee(exitNotional, config) * 100) / 100;
          const entryFee = activeTrade.entry_fee!;
          const totalFees = Math.round((entryFee + exitFee) * 100) / 100;

          const grossPnl = Math.round((exitPrice - activeTrade.entry_price!) * activeTrade.quantity! * 100) / 100;
          const netPnl = Math.round((grossPnl - totalFees) * 100) / 100;
          const netReturn = Math.round((netPnl / (activeTrade.quantity! * activeTrade.entry_price!)) * 10000) / 10000;

          currentCash += exitNotional - exitFee;
          sessionPnl += netPnl;
          sessionTradesCount++;

          const holdingDurationMinutes = entryBarIndex >= 0 ? (i - entryBarIndex) : effectiveHoldingMinutes;

          const completedTrade: Trade = {
            id: `TRD-${tradeIdCounter++}`,
            candidate_id: candidate.id,
            session_date: sessionDate,
            entry_time: activeTrade.entry_time!,
            exit_time: bar.timestamp,
            quantity: activeTrade.quantity!,
            entry_price: activeTrade.entry_price!,
            exit_price: exitPrice,
            entry_fee: entryFee,
            exit_fee: exitFee,
            total_fees: totalFees,
            gross_pnl: grossPnl,
            net_pnl: netPnl,
            net_return: netReturn,
            exit_reason: exitReason,
            holding_duration_minutes: holdingDurationMinutes,
          };

          allTrades.push(completedTrade);
          inPosition = false;
          activeTrade = null;
          cooldownUntil = i + config.cooldown_minutes;

          // Check daily loss brake
          const currentDailyDrop = (sessionStartEquity - currentCash) / sessionStartEquity;
          if (currentDailyDrop >= config.daily_loss_limit_pct) {
            dailyBrakeTriggered = true;
          }

          continue; // Cannot enter in the same bar as exit
        }
      }

      // 2. Check signal evaluation (only on completed 5m bars)
      if (featureTimestamps.has(bar.timestamp)) {
        const score = signals.get(bar.timestamp) ?? 0;
        const qualifies = score > candidate.score_threshold;

        // One entry per false-to-true signal episode
        const isFreshSignal = qualifies && !lastSignalState;
        lastSignalState = qualifies;

        // Check if we can enter: not in position, not in cooldown, daily brake not triggered, before liquidation
        if (
          isFreshSignal &&
          !inPosition &&
          !dailyBrakeTriggered &&
          i >= cooldownUntil &&
          i < liquidationBarIndex - effectiveHoldingMinutes
        ) {
          // Delayed entry at next 1-minute bar start (latency = 1)
          const entryBar = sessionBars[i + config.latency_minutes] || bar;
          const entryFriction = (config.round_trip_spread_bps / 2 + config.slippage_bps_per_side) / 10000;
          const entryPrice = Math.round(entryBar.open * (1 + entryFriction) * 1000) / 1000;

          // Sizing: whole shares based on allocation fraction
          const maxAllocation = currentCash * config.allocation_fraction;
          const quantity = Math.floor(maxAllocation / entryPrice);

          if (quantity > 0) {
            const entryNotional = quantity * entryPrice;
            const entryFee = Math.round(calculateFee(entryNotional, config) * 100) / 100;

            if (currentCash >= entryNotional + entryFee) {
              currentCash -= entryNotional + entryFee;
              inPosition = true;
              entryBarIndex = i + config.latency_minutes;
              stopPrice = Math.round(entryPrice * (1 - config.stop_loss_pct) * 1000) / 1000;

              activeTrade = {
                entry_time: entryBar.timestamp,
                entry_price: entryPrice,
                quantity,
                entry_fee: entryFee,
              };
            }
          }
        }
      }
    }

    // End of session record
    const sessionCloseEquity = Math.round(currentCash * 100) / 100;
    if (sessionCloseEquity > peakEquity) {
      peakEquity = sessionCloseEquity;
    }
    const ddPct = Math.round(((peakEquity - sessionCloseEquity) / peakEquity) * 10000) / 100;
    const dailyReturn = sessionStartEquity > 0 ? (sessionCloseEquity - sessionStartEquity) / sessionStartEquity : 0;

    dailyEquityRows.push({
      session_date: sessionDate,
      equity: sessionCloseEquity,
      daily_return: Math.round(dailyReturn * 10000) / 10000,
      net_pnl: Math.round(sessionPnl * 100) / 100,
      trade_count: sessionTradesCount,
      drawdown_pct: ddPct,
    });
  }

  return {
    trades: allTrades,
    equity: dailyEquityRows,
  };
}

/**
 * Honest non-interpolated backtest directly on verified 5-minute Euronext Milan observations.
 * Eliminates artificial 1-minute interpolation paths.
 */
export function runBacktest5m(
  features: FeatureRow[],
  candidate: Candidate,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG,
  sessionFilter?: Set<string>
): {
  trades: Trade[];
  equity: DailyEquity[];
} {
  const signals = generateSignals(features, candidate);

  const sessionDates = Array.from(new Set(features.map((f) => f.session_date)))
    .filter((d) => (sessionFilter ? sessionFilter.has(d) : true))
    .sort();

  const featuresBySession: Map<string, FeatureRow[]> = new Map();
  for (const f of features) {
    if (sessionFilter && !sessionFilter.has(f.session_date)) continue;
    if (!featuresBySession.has(f.session_date)) {
      featuresBySession.set(f.session_date, []);
    }
    featuresBySession.get(f.session_date)!.push(f);
  }

  let currentCash = config.initial_cash;
  let peakEquity = config.initial_cash;
  const allTrades: Trade[] = [];
  const dailyEquityRows: DailyEquity[] = [];
  let tradeIdCounter = 1;

  const effectiveHoldingMinutes =
    (typeof candidate.parameters?.holding_minutes === 'number' && candidate.parameters.holding_minutes > 0)
      ? candidate.parameters.holding_minutes
      : candidate.target_horizon_minutes
      ? candidate.target_horizon_minutes
      : config.holding_minutes;

  const holdingBars = Math.max(1, Math.round(effectiveHoldingMinutes / 5));

  for (const sessionDate of sessionDates) {
    const sessionBars = featuresBySession.get(sessionDate) || [];
    if (sessionBars.length === 0) continue;

    const sessionStartEquity = currentCash;
    let sessionPnl = 0;
    let sessionTradesCount = 0;
    let dailyBrakeTriggered = false;

    let inPosition = false;
    let activeTrade: Partial<Trade> | null = null;
    let entryBarIndex = -1;
    let stopPrice = 0;
    let lastSignalState = false;
    let cooldownUntil = 0;

    const totalBars = sessionBars.length;
    const liquidationBarIndex = totalBars - 2; // Liquidate at bar 101 (17:25 CET), preserving FTT exemption

    for (let i = 0; i < totalBars; i++) {
      const bar = sessionBars[i];

      // 1. Check open position exit conditions on real 5m bars
      if (inPosition && activeTrade) {
        let exitTriggered = false;
        let exitReason: Trade['exit_reason'] = 'time_exit';
        let rawExitPrice = bar.open;

        if (bar.low <= stopPrice) {
          exitTriggered = true;
          exitReason = 'stop_loss';
          rawExitPrice = Math.min(bar.open, stopPrice);
        } else if (i >= entryBarIndex + holdingBars) {
          exitTriggered = true;
          exitReason = 'time_exit';
          rawExitPrice = bar.open;
        } else if (i >= liquidationBarIndex) {
          exitTriggered = true;
          exitReason = 'session_end';
          rawExitPrice = bar.open;
        }

        if (exitTriggered) {
          const exitFriction = (config.round_trip_spread_bps / 2 + config.slippage_bps_per_side) / 10000;
          const exitPrice = Math.round(rawExitPrice * (1 - exitFriction) * 1000) / 1000;
          const exitNotional = activeTrade.quantity! * exitPrice;
          const exitFee = Math.round(calculateFee(exitNotional, config) * 100) / 100;
          const entryFee = activeTrade.entry_fee!;
          const totalFees = Math.round((entryFee + exitFee) * 100) / 100;

          const grossPnl = Math.round((exitPrice - activeTrade.entry_price!) * activeTrade.quantity! * 100) / 100;
          const netPnl = Math.round((grossPnl - totalFees) * 100) / 100;
          const netReturn = Math.round((netPnl / (activeTrade.quantity! * activeTrade.entry_price!)) * 10000) / 10000;

          currentCash += exitNotional - exitFee;
          sessionPnl += netPnl;
          sessionTradesCount++;

          const holdingDurationMinutes = entryBarIndex >= 0 ? (i - entryBarIndex) * 5 : effectiveHoldingMinutes;

          const completedTrade: Trade = {
            id: `TRD-5M-${tradeIdCounter++}`,
            candidate_id: candidate.id,
            session_date: sessionDate,
            entry_time: activeTrade.entry_time!,
            exit_time: bar.timestamp,
            quantity: activeTrade.quantity!,
            entry_price: activeTrade.entry_price!,
            exit_price: exitPrice,
            entry_fee: entryFee,
            exit_fee: exitFee,
            total_fees: totalFees,
            gross_pnl: grossPnl,
            net_pnl: netPnl,
            net_return: netReturn,
            exit_reason: exitReason,
            holding_duration_minutes: holdingDurationMinutes,
          };

          allTrades.push(completedTrade);
          inPosition = false;
          activeTrade = null;
          cooldownUntil = i + Math.max(1, Math.round(config.cooldown_minutes / 5));

          const currentDailyDrop = (sessionStartEquity - currentCash) / sessionStartEquity;
          if (currentDailyDrop >= config.daily_loss_limit_pct) {
            dailyBrakeTriggered = true;
          }

          continue;
        }
      }

      // 2. Check signal evaluation on bar close
      const score = signals.get(bar.timestamp) ?? 0;
      const qualifies = score > candidate.score_threshold;
      const isFreshSignal = qualifies && !lastSignalState;
      lastSignalState = qualifies;

      if (
        isFreshSignal &&
        !inPosition &&
        !dailyBrakeTriggered &&
        i >= cooldownUntil &&
        i < liquidationBarIndex - holdingBars &&
        i + 1 < totalBars
      ) {
        // Honest next-bar open entry (1 bar = 5m execution latency)
        const entryBar = sessionBars[i + 1];
        const entryFriction = (config.round_trip_spread_bps / 2 + config.slippage_bps_per_side) / 10000;
        const entryPrice = Math.round(entryBar.open * (1 + entryFriction) * 1000) / 1000;

        const maxAllocation = currentCash * config.allocation_fraction;
        const quantity = Math.floor(maxAllocation / entryPrice);

        if (quantity > 0) {
          const entryNotional = quantity * entryPrice;
          const entryFee = Math.round(calculateFee(entryNotional, config) * 100) / 100;

          if (currentCash >= entryNotional + entryFee) {
            currentCash -= entryNotional + entryFee;
            inPosition = true;
            entryBarIndex = i + 1;
            stopPrice = Math.round(entryPrice * (1 - config.stop_loss_pct) * 1000) / 1000;

            activeTrade = {
              entry_time: entryBar.timestamp,
              entry_price: entryPrice,
              quantity,
              entry_fee: entryFee,
            };
          }
        }
      }
    }

    const sessionCloseEquity = Math.round(currentCash * 100) / 100;
    if (sessionCloseEquity > peakEquity) {
      peakEquity = sessionCloseEquity;
    }
    const ddPct = Math.round(((peakEquity - sessionCloseEquity) / peakEquity) * 10000) / 100;
    const dailyReturn = sessionStartEquity > 0 ? (sessionCloseEquity - sessionStartEquity) / sessionStartEquity : 0;

    dailyEquityRows.push({
      session_date: sessionDate,
      equity: sessionCloseEquity,
      daily_return: Math.round(dailyReturn * 10000) / 10000,
      net_pnl: Math.round(sessionPnl * 100) / 100,
      trade_count: sessionTradesCount,
      drawdown_pct: ddPct,
    });
  }

  return {
    trades: allTrades,
    equity: dailyEquityRows,
  };
}
