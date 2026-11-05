import { Candidate, ExecutionConfig, PaperOrder, PaperPosition, PaperQuote } from '../types';

export function generateSimulatedQuote(lastPrice: number, timeStr: string): PaperQuote {
  const spreadBps = 10.0;
  const halfSpread = (lastPrice * spreadBps) / 20000;
  const bid = Math.round((lastPrice - halfSpread) * 1000) / 1000;
  const ask = Math.round((lastPrice + halfSpread) * 1000) / 1000;

  return {
    symbol: 'UCG.MI',
    timestamp: timeStr,
    bid,
    ask,
    bid_size: 4500,
    ask_size: 3800,
    spread_bps: spreadBps,
  };
}

export function generateOpenClawHandoff(
  candidate: Candidate,
  config: ExecutionConfig,
  currentPrice: number = 10.5
) {
  return {
    $schema: 'https://ucg-lab.internal/schemas/paper_handoff.schema.json',
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    system: 'UniCredit Research Lab',
    target: {
      symbol: 'UCG.MI',
      exchange: 'MTAA',
      currency: 'EUR',
    },
    candidate_summary: {
      id: candidate.id,
      strategy_name: candidate.name,
      kind: candidate.kind,
      parameters: candidate.parameters,
      score_threshold: candidate.score_threshold,
      eligible_for_live: false,
      authorized_environment: 'PAPER_TRADING_ONLY',
    },
    risk_mandate: {
      initial_capital_eur: config.initial_cash,
      max_position_fraction: config.allocation_fraction,
      stop_loss_pct: config.stop_loss_pct,
      daily_loss_limit_pct: config.daily_loss_limit_pct,
      mandatory_session_exit_time_cet: '17:25:00',
    },
    execution_policy: {
      mode: 'simulated_broker_direct',
      min_commission_eur: config.minimum_commission,
      commission_rate: config.commission_rate,
      max_slippage_bps: config.slippage_bps_per_side * 2,
      latency_enforcement_seconds: config.latency_minutes * 60,
    },
    openclaw_commands: [
      {
        action: 'SCHEDULE_SIGNAL_OBSERVER',
        interval: '5m',
        symbol: 'UCG.MI',
        trigger_rule: candidate.name,
      },
      {
        action: 'ENFORCE_DAILY_BRAKE',
        threshold_pct: config.daily_loss_limit_pct,
      },
      {
        action: 'LIQUIDATE_ALL_BEFORE_CLOSE',
        time_utc: '15:25:00',
      },
    ],
  };
}
