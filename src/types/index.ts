export interface Bar1m {
  timestamp: string; // ISO UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  session_date: string; // YYYY-MM-DD
}

export interface Bar5m {
  timestamp: string;
  time_label: string; // HH:MM
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  session_date: string;
  minute_of_day: number;
  // Sector & Market Context
  ftse_mib_close?: number;
  banking_etf_close?: number;
}

export interface FeatureRow extends Bar5m {
  rvol: number;
  rvol_ready: boolean;
  or_high: number | null;
  or_low: number | null;
  or_ready: boolean;
  vwap: number;
  ret_15m: number;
  ret_60m: number;
  volatility_30m: number;
  gap_return: number;
  news_count_60m: number;
  // Sector context
  sector_spread_15m?: number;
  // Multi-horizon forward returns
  fwd_ret_5m?: number;
  fwd_ret_15m?: number;
  fwd_ret_30m?: number;
  fwd_ret_60m?: number;
  fwd_ret_120m?: number;
}

export interface ExecutionConfig {
  initial_cash: number;
  allocation_fraction: number;
  commission_rate: number;
  minimum_commission: number;
  round_trip_spread_bps: number;
  slippage_bps_per_side: number;
  execution_mode: 'bar_proxy' | 'quote_snapshot';
  latency_minutes: number;
  holding_minutes: number;
  stop_loss_pct: number;
  daily_loss_limit_pct: number;
  score_threshold: number;
  cooldown_minutes: number;
}

export type CandidateKind = 'rule' | 'model';
export type RuleStrategyName = 'trend_pullback' | 'opening_breakout' | 'mean_reversion' | 'ridge_v1';
export type PredictionHorizon = 5 | 15 | 30 | 60 | 120;

export interface Candidate {
  id: string;
  kind: CandidateKind;
  name: RuleStrategyName;
  description: string;
  parameters: Record<string, number | string | boolean>;
  score_threshold: number;
  target_horizon_minutes?: PredictionHorizon;
}

export interface Trade {
  id: string;
  candidate_id: string;
  session_date: string;
  entry_time: string;
  exit_time: string;
  quantity: number;
  entry_price: number;
  exit_price: number;
  entry_fee: number;
  exit_fee: number;
  total_fees: number;
  gross_pnl: number;
  net_pnl: number;
  net_return: number;
  exit_reason: 'time_exit' | 'stop_loss' | 'session_end' | 'daily_brake';
}

export interface DailyEquity {
  session_date: string;
  equity: number;
  daily_return: number;
  net_pnl: number;
  trade_count: number;
  drawdown_pct: number;
}

export interface BootstrapCI {
  mean: number;
  lower: number;
  upper: number;
  alpha: number;
  block_length: number;
  n_observations: number;
  n_bootstrap: number;
  method: string;
}

export interface PerformanceMetrics {
  net_return: number;
  annualized_return: number;
  max_drawdown: number;
  worst_day: number;
  worst_week: number;
  win_rate: number;
  trades: number;
  active_day_fraction: number;
  active_week_fraction: number;
  longest_no_trade_sessions: number;
  mean_daily_return: number;
  mean_trade_net_return: number;
  profit_factor: number | null;
  total_fees: number;
  total_net_pnl: number;
  sharpe_ratio: number;
  bootstrap_ci: BootstrapCI;
}

export type EvidenceStatus = 'SYNTHETIC_DEMO' | 'RESEARCH_ONLY' | 'HISTORICAL_CANDIDATE' | 'PAPER_CANDIDATE';

export interface EvidenceAssessment {
  status: EvidenceStatus;
  eligible_for_live: false;
  criteria: Record<string, number>;
  passed_checks: string[];
  failed_checks: string[];
  caveats: string[];
}

export interface CandidateResult {
  candidate: Candidate;
  metrics: PerformanceMetrics;
  equity: DailyEquity[];
  trades: Trade[];
  evidence: EvidenceAssessment;
}

export interface AuditReport {
  dataset_hash: string;
  source_hash: string;
  symbol: string;
  sessions_count: number;
  bars_count: number;
  start_date: string;
  end_date: string;
  missing_minutes: number;
  ohlc_inconsistencies: number;
  zero_volume_bars: number;
  quotes_available: boolean;
  provenance_verified: boolean;
  data_source_type: 'real_mtaa' | 'synthetic_demo' | 'canonical_csv';
  warnings: string[];
  passed_checks: string[];
  blocker_status?: {
    is_blocked: boolean;
    reason: string;
    entitlement: string;
    licensing: string;
  };
}

export interface HoldoutState {
  holdout_sessions: number;
  first_date: string;
  last_date: string;
  evaluated: boolean;
  frozen_candidate: Candidate | null;
  frozen_at: string | null;
  evaluation_date: string | null;
  result: CandidateResult | null;
  trial_count: number;
  search_budget: number;
}

export interface PaperQuote {
  symbol: string;
  timestamp: string;
  bid: number;
  ask: number;
  bid_size: number;
  ask_size: number;
  spread_bps: number;
}

export interface PaperOrder {
  id: string;
  timestamp: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  order_type: 'MARKET' | 'LIMIT';
  limit_price?: number;
  status: 'PENDING' | 'FILLED' | 'REJECTED' | 'CANCELLED';
  fill_price?: number;
  fill_time?: string;
  fee?: number;
  rejection_reason?: string;
  source?: 'MANUAL' | 'AUTONOMOUS_DAEMON';
}

export interface PaperPosition {
  symbol: string;
  shares: number;
  average_entry: number;
  current_price: number;
  unrealized_pnl: number;
  unrealized_return_pct: number;
}

export interface AnalogMatch {
  session_date: string;
  time_label: string;
  similarity_score: number;
  historical_price: number;
  rvol: number;
  fwd_return_5m: number;
  fwd_return_15m: number;
  fwd_return_30m: number;
  fwd_return_60m: number;
  fwd_return_120m: number;
  is_winner_30m: boolean;
}

export interface SensitivityScenario {
  name: string;
  spread_bps: number;
  slippage_bps: number;
  latency_minutes: number;
  min_fee: number;
  net_return: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number | null;
  trades_count: number;
}

export interface VirtualExecutionLogEvent {
  id: string;
  timestamp: string;
  event_type: 'SIGNAL_RECORDED' | 'ORDER_QUEUED' | 'ORDER_FILLED' | 'STOP_TRIGGERED' | 'SESSION_LIQUIDATION' | 'DAILY_BRAKE';
  details: string;
  price?: number;
  shares?: number;
  pnl?: number;
}
