import React, { useState, useMemo } from 'react';
import {
  Sliders,
  DollarSign,
  AlertCircle,
  BarChart2,
  Calendar,
  Layers,
  Activity,
  Percent,
  Clock,
  Compass,
  ShieldAlert,
} from 'lucide-react';
import {
  Bar1m,
  Candidate,
  DailyEquity,
  ExecutionConfig,
  FeatureRow,
  PerformanceMetrics,
  PredictionHorizon,
  Trade,
} from '../types';
import { REGISTERED_CANDIDATES } from '../engine/strategies';
import { findHistoricalAnalogs } from '../engine/analogs';
import { runSensitivityAnalysis } from '../engine/sensitivity';

interface ResearchViewProps {
  bars1m: Bar1m[];
  features: FeatureRow[];
  selectedCandidate: Candidate;
  onSelectCandidate: (candidate: Candidate) => void;
  config: ExecutionConfig;
  onUpdateConfig: (config: ExecutionConfig) => void;
  equity: DailyEquity[];
  trades: Trade[];
  metrics: PerformanceMetrics;
  onFreezeCandidate: () => void;
  isHoldoutEvaluated: boolean;
  dataSourceName: string;
}

export const ResearchView: React.FC<ResearchViewProps> = ({
  bars1m,
  features,
  selectedCandidate,
  onSelectCandidate,
  config,
  onUpdateConfig,
  equity,
  trades,
  metrics,
  onFreezeCandidate,
  isHoldoutEvaluated,
  dataSourceName,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'chart' | 'multi_horizon' | 'analogs' | 'sensitivity' | 'trades' | 'bootstrap'
  >('chart');
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>(
    features.length > 0 ? features[features.length - 1].session_date : ''
  );

  // Filter features for currently selected session for intraday chart
  const sessionFeatures = useMemo(() => {
    if (!selectedSessionDate && features.length > 0) {
      return features.filter((f) => f.session_date === features[features.length - 1].session_date);
    }
    return features.filter((f) => f.session_date === selectedSessionDate);
  }, [features, selectedSessionDate]);

  const uniqueSessionDates = useMemo(() => {
    return Array.from(new Set(features.map((f) => f.session_date))).slice(-35);
  }, [features]);

  // Max and min prices for SVG chart scaling
  const chartBounds = useMemo(() => {
    if (sessionFeatures.length === 0) return { min: 70, max: 80 };
    let min = Infinity;
    let max = -Infinity;
    for (const f of sessionFeatures) {
      if (f.low < min) min = f.low;
      if (f.high > max) max = f.high;
      if (f.vwap < min) min = f.vwap;
      if (f.vwap > max) max = f.vwap;
    }
    const padding = (max - min) * 0.08 || 0.5;
    return { min: min - padding, max: max + padding };
  }, [sessionFeatures]);

  // Equity curve bounds
  const equityBounds = useMemo(() => {
    if (equity.length === 0) return { min: 9000, max: 11000 };
    const values = equity.map((e) => e.equity);
    const min = Math.min(...values, config.initial_cash);
    const max = Math.max(...values, config.initial_cash);
    const padding = (max - min) * 0.08 || 200;
    return { min: min - padding, max: max + padding };
  }, [equity, config.initial_cash]);

  // Multi-horizon outcome analysis for the selected candidate
  const horizonStats = useMemo(() => {
    const horizons: PredictionHorizon[] = [5, 15, 30, 60, 120];
    const stats: Record<PredictionHorizon, { mean: number; winRate: number; count: number }> = {
      5: { mean: 0, winRate: 0, count: 0 },
      15: { mean: 0, winRate: 0, count: 0 },
      30: { mean: 0, winRate: 0, count: 0 },
      60: { mean: 0, winRate: 0, count: 0 },
      120: { mean: 0, winRate: 0, count: 0 },
    };

    for (const h of horizons) {
      const valid = features.filter((f) => {
        const val =
          h === 5
            ? f.fwd_ret_5m
            : h === 15
            ? f.fwd_ret_15m
            : h === 30
            ? f.fwd_ret_30m
            : h === 60
            ? f.fwd_ret_60m
            : f.fwd_ret_120m;
        return val !== undefined && f.rvol_ready;
      });

      if (valid.length > 0) {
        const rets = valid.map((f) =>
          h === 5
            ? f.fwd_ret_5m!
            : h === 15
            ? f.fwd_ret_15m!
            : h === 30
            ? f.fwd_ret_30m!
            : h === 60
            ? f.fwd_ret_60m!
            : f.fwd_ret_120m!
        );
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        const wins = rets.filter((r) => r > 0).length;
        stats[h] = {
          mean: Math.round(mean * 10000) / 10000,
          winRate: Math.round((wins / rets.length) * 1000) / 1000,
          count: valid.length,
        };
      }
    }

    return stats;
  }, [features]);

  // Historical Pattern Analogs Search
  const analogsResult = useMemo(() => {
    if (sessionFeatures.length === 0) return null;
    const target = sessionFeatures[Math.floor(sessionFeatures.length / 2)] || sessionFeatures[0];
    return findHistoricalAnalogs(target, features, 10);
  }, [sessionFeatures, features]);

  // Sensitivity Stress Matrix
  const sensitivityScenarios = useMemo(() => {
    return runSensitivityAnalysis(bars1m, features, selectedCandidate, config);
  }, [bars1m, features, selectedCandidate, config]);

  return (
    <div className="space-y-6">
      {/* Strategy Hypothesis & Data Origin Header */}
      <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Strategy Hypotheses & Prediction Models
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">DATASET:</span>
            <span className="text-cyan-400 font-bold">{dataSourceName}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {REGISTERED_CANDIDATES.map((cand) => {
            const isSelected = selectedCandidate.id === cand.id;
            return (
              <button
                key={cand.id}
                onClick={() => onSelectCandidate(cand)}
                className={`p-3 text-left rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-cyan-950/20 border-cyan-500/80 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${isSelected ? 'text-cyan-400' : 'text-slate-200'}`}>
                    {cand.name}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{cand.kind}</span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {cand.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Performance Tear Sheet KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <Percent className="w-3.5 h-3.5 text-cyan-400" />
            Net Account Return
          </div>
          <div
            className={`text-lg font-bold font-mono tabular-nums ${
              metrics.net_return >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {(metrics.net_return * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            €{metrics.total_net_pnl.toFixed(2)} P&L
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            Max Daily Drawdown
          </div>
          <div className="text-lg font-bold font-mono text-red-400 tabular-nums">
            {(metrics.max_drawdown * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">Daily close basis</div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Win Rate / Trades
          </div>
          <div className="text-lg font-bold font-mono text-slate-100 tabular-nums">
            {(metrics.win_rate * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {metrics.trades} completed trades
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            Profit Factor
          </div>
          <div className="text-lg font-bold font-mono text-slate-100 tabular-nums">
            {metrics.profit_factor !== null ? metrics.profit_factor.toFixed(2) : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            €{metrics.total_fees.toFixed(2)} fees paid
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            Active Weeks
          </div>
          <div className="text-lg font-bold font-mono text-slate-100 tabular-nums">
            {(metrics.active_week_fraction * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            Max idle: {metrics.longest_no_trade_sessions} days
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            Sharpe Ratio (Ann.)
          </div>
          <div className="text-lg font-bold font-mono text-slate-100 tabular-nums">
            {metrics.sharpe_ratio.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">252 session scaling</div>
        </div>
      </div>

      {/* Interactive Controls & Parameter Sliders */}
      <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Execution Frictions & Risk Mandate
          </div>
          <button
            onClick={() => {
              onUpdateConfig({
                ...config,
                commission_rate: 0.0005,
                minimum_commission: 3.0,
                round_trip_spread_bps: 10.0,
                slippage_bps_per_side: 2.0,
                stop_loss_pct: 0.01,
                daily_loss_limit_pct: 0.02,
                allocation_fraction: 0.25,
                holding_minutes: 30,
              });
            }}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Reset to Conservative Defaults
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs font-mono">
          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Allocation</label>
            <input
              type="number"
              step="0.05"
              min="0.05"
              max="1.0"
              value={config.allocation_fraction}
              onChange={(e) => onUpdateConfig({ ...config, allocation_fraction: parseFloat(e.target.value) || 0.25 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Min Ticket (€)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={config.minimum_commission}
              onChange={(e) => onUpdateConfig({ ...config, minimum_commission: parseFloat(e.target.value) || 3.0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Spread (bps)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={config.round_trip_spread_bps}
              onChange={(e) => onUpdateConfig({ ...config, round_trip_spread_bps: parseFloat(e.target.value) || 10.0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Slippage/Side</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={config.slippage_bps_per_side}
              onChange={(e) => onUpdateConfig({ ...config, slippage_bps_per_side: parseFloat(e.target.value) || 2.0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Stop Loss %</label>
            <input
              type="number"
              step="0.005"
              min="0.002"
              value={config.stop_loss_pct}
              onChange={(e) => onUpdateConfig({ ...config, stop_loss_pct: parseFloat(e.target.value) || 0.01 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Daily Brake %</label>
            <input
              type="number"
              step="0.005"
              min="0.005"
              value={config.daily_loss_limit_pct}
              onChange={(e) => onUpdateConfig({ ...config, daily_loss_limit_pct: parseFloat(e.target.value) || 0.02 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Holding (min)</label>
            <select
              value={config.holding_minutes}
              onChange={(e) => onUpdateConfig({ ...config, holding_minutes: parseInt(e.target.value, 10) || 30 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100"
            >
              <option value="5">5 min (Scalp)</option>
              <option value="15">15 min (Quick)</option>
              <option value="30">30 min (Standard)</option>
              <option value="60">60 min (Hourly)</option>
              <option value="120">120 min (Regime)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveSubTab('chart')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeSubTab === 'chart' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Equity Curve & Intraday VWAP
          </button>
          <button
            onClick={() => setActiveSubTab('multi_horizon')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeSubTab === 'multi_horizon' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Multi-Horizon Decay (5m–120m)
          </button>
          <button
            onClick={() => setActiveSubTab('analogs')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeSubTab === 'analogs' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Historical Cross-Year Analogs
          </button>
          <button
            onClick={() => setActiveSubTab('sensitivity')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeSubTab === 'sensitivity' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Friction Stress Matrix
          </button>
          <button
            onClick={() => setActiveSubTab('trades')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeSubTab === 'trades' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Trade Log ({trades.length})
          </button>
          <button
            onClick={() => setActiveSubTab('bootstrap')}
            className={`px-3 py-1 text-xs font-medium rounded ${
              activeSubTab === 'bootstrap' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bootstrap Diagnostics (95% CI)
          </button>
        </div>

        {/* Freeze Gate CTA */}
        <button
          onClick={onFreezeCandidate}
          disabled={isHoldoutEvaluated}
          className="px-3 py-1 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 rounded transition-colors whitespace-nowrap"
        >
          {isHoldoutEvaluated ? 'Holdout Evaluated' : `Freeze ${selectedCandidate.id} for Holdout`}
        </button>
      </div>

      {/* Sub-tab 1: Chart & VWAP */}
      {activeSubTab === 'chart' && (
        <div className="space-y-4">
          {/* Cumulative Equity Curve Chart */}
          <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span className="font-semibold text-slate-200">CUMULATIVE NET EQUITY CURVE (€)</span>
              <span>
                Initial: €{config.initial_cash.toLocaleString()} · Final:{' '}
                <span className={metrics.net_return >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  €
                  {equity.length > 0
                    ? equity[equity.length - 1].equity.toLocaleString(undefined, { minimumFractionDigits: 2 })
                    : config.initial_cash}
                </span>
              </span>
            </div>

            <div className="h-44 w-full relative">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 160">
                <line x1="0" y1="40" x2="1000" y2="40" stroke="#1E293B" strokeDasharray="4 4" />
                <line x1="0" y1="80" x2="1000" y2="80" stroke="#1E293B" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="1000" y2="120" stroke="#1E293B" strokeDasharray="4 4" />

                {/* Capital baseline */}
                {(() => {
                  const yBase =
                    160 - ((config.initial_cash - equityBounds.min) / (equityBounds.max - equityBounds.min)) * 160;
                  return (
                    <line
                      x1="0"
                      y1={Math.max(0, Math.min(160, yBase))}
                      x2="1000"
                      y2={Math.max(0, Math.min(160, yBase))}
                      stroke="#475569"
                      strokeWidth="1"
                    />
                  );
                })()}

                {/* Equity Path */}
                {equity.length > 1 && (
                  <path
                    d={equity
                      .map((e, idx) => {
                        const x = (idx / (equity.length - 1)) * 1000;
                        const y = 160 - ((e.equity - equityBounds.min) / (equityBounds.max - equityBounds.min)) * 160;
                        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${Math.max(0, Math.min(160, y)).toFixed(1)}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke={metrics.net_return >= 0 ? '#10B981' : '#EF4444'}
                    strokeWidth="2"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Intraday Candlestick & VWAP */}
          <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-2">
                <span>INTRADAY 5-MINUTE BARS, VWAP & BANKING CONTEXT</span>
                <span className="text-slate-500">·</span>
                <span className="text-cyan-400 font-normal">Session: {selectedSessionDate}</span>
              </div>

              <select
                value={selectedSessionDate}
                onChange={(e) => setSelectedSessionDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs font-mono rounded px-2.5 py-1 text-slate-200"
              >
                {uniqueSessionDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </div>

            {sessionFeatures.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-slate-500 font-mono">
                No 5-minute bars for selected session
              </div>
            ) : (
              <div className="h-56 w-full relative">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 200">
                  <line x1="0" y1="50" x2="1000" y2="50" stroke="#1E293B" strokeDasharray="2 2" />
                  <line x1="0" y1="100" x2="1000" y2="100" stroke="#1E293B" strokeDasharray="2 2" />
                  <line x1="0" y1="150" x2="1000" y2="150" stroke="#1E293B" strokeDasharray="2 2" />

                  {/* 30m Opening Range Band */}
                  {sessionFeatures.length > 6 && sessionFeatures[6].or_high && sessionFeatures[6].or_low && (
                    <rect
                      x="0"
                      y={
                        200 -
                        ((sessionFeatures[6].or_high! - chartBounds.min) / (chartBounds.max - chartBounds.min)) * 200
                      }
                      width="1000"
                      height={Math.max(
                        2,
                        ((sessionFeatures[6].or_high! - sessionFeatures[6].or_low!) /
                          (chartBounds.max - chartBounds.min)) *
                          200
                      )}
                      fill="#06B6D4"
                      fillOpacity="0.08"
                    />
                  )}

                  {/* VWAP Line */}
                  <path
                    d={sessionFeatures
                      .map((f, idx) => {
                        const x = (idx / (sessionFeatures.length - 1)) * 1000;
                        const y = 200 - ((f.vwap - chartBounds.min) / (chartBounds.max - chartBounds.min)) * 200;
                        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${Math.max(0, Math.min(200, y)).toFixed(1)}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />

                  {/* Candlesticks */}
                  {sessionFeatures.map((f, idx) => {
                    const x = (idx / (sessionFeatures.length - 1)) * 1000;
                    const yHigh = 200 - ((f.high - chartBounds.min) / (chartBounds.max - chartBounds.min)) * 200;
                    const yLow = 200 - ((f.low - chartBounds.min) / (chartBounds.max - chartBounds.min)) * 200;
                    const yOpen = 200 - ((f.open - chartBounds.min) / (chartBounds.max - chartBounds.min)) * 200;
                    const yClose = 200 - ((f.close - chartBounds.min) / (chartBounds.max - chartBounds.min)) * 200;
                    const isUp = f.close >= f.open;
                    const barColor = isUp ? '#10B981' : '#EF4444';

                    return (
                      <g key={idx}>
                        <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={barColor} strokeWidth="1" />
                        <rect
                          x={x - 3}
                          y={Math.min(yOpen, yClose)}
                          width="6"
                          height={Math.max(2, Math.abs(yOpen - yClose))}
                          fill={barColor}
                        />
                      </g>
                    );
                  })}
                </svg>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-0.5 bg-cyan-400 inline-block"></span> VWAP
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-cyan-500/20 inline-block border border-cyan-500/40"></span> 30m
                      Opening Range
                    </span>
                  </div>
                  <span>High: €{chartBounds.max.toFixed(3)} · Low: €{chartBounds.min.toFixed(3)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 2: Multi-Horizon Predictive Decay */}
      {activeSubTab === 'multi_horizon' && (
        <div className="bg-[#111827] border border-slate-800 p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Multi-Horizon Forward Edge & Decay Analysis
            </span>
            <span className="text-xs text-slate-500 font-mono">5, 15, 30, 60, and 120 Minutes</span>
          </div>

          <p className="text-xs text-slate-400 font-mono leading-relaxed">
            Measures the persistence and decay of forward price moves following qualifying strategy signals. A true
            statistical edge should withstand longer holding horizons and not rely solely on sub-minute noise.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 font-mono text-xs">
            {([5, 15, 30, 60, 120] as PredictionHorizon[]).map((h) => {
              const stat = horizonStats[h];
              return (
                <div key={h} className="bg-slate-900/80 p-3.5 rounded border border-slate-800">
                  <div className="text-slate-400 font-semibold mb-1">{h}-Minute Horizon</div>
                  <div
                    className={`text-lg font-bold tabular-nums ${
                      stat.mean >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {(stat.mean * 100).toFixed(3)}%
                  </div>
                  <div className="text-slate-500 text-[11px] mt-1">
                    Win Rate: {(stat.winRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-slate-500 text-[11px]">N = {stat.count.toLocaleString()} bars</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tab 3: Historical Cross-Year Analogs */}
      {activeSubTab === 'analogs' && (
        <div className="bg-[#111827] border border-slate-800 p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              Historical Pattern Analogs (Cross-Year Search)
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Includes Losing and Winning Cases without Lookahead
            </span>
          </div>

          <p className="text-xs text-slate-400 font-mono leading-relaxed">
            Compares current intraday price trajectory, same-clock RVOL, and VWAP displacement with historical sessions
            across multiple years.
          </p>

          {analogsResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                  <div className="text-slate-500 mb-0.5">TOP ANALOGS IDENTIFIED</div>
                  <div className="text-lg font-bold text-slate-100">{analogsResult.summary.total_matches} Cases</div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                  <div className="text-slate-500 mb-0.5">30-MIN ANALOG WIN RATE</div>
                  <div className="text-lg font-bold text-cyan-400">
                    {(analogsResult.summary.win_rate_30m * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                  <div className="text-slate-500 mb-0.5">MEDIAN 30M OUTCOME</div>
                  <div
                    className={`text-lg font-bold ${
                      analogsResult.summary.median_return_30m >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {(analogsResult.summary.median_return_30m * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                  <div className="text-slate-500 mb-0.5">MEAN 30M OUTCOME</div>
                  <div
                    className={`text-lg font-bold ${
                      analogsResult.summary.mean_return_30m >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {(analogsResult.summary.mean_return_30m * 100).toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Session Date</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3 text-right">Similarity</th>
                      <th className="py-2.5 px-3 text-right">Price (€)</th>
                      <th className="py-2.5 px-3 text-right">RVOL</th>
                      <th className="py-2.5 px-3 text-right">+5m</th>
                      <th className="py-2.5 px-3 text-right">+15m</th>
                      <th className="py-2.5 px-3 text-right">+30m</th>
                      <th className="py-2.5 px-3 text-right">+60m</th>
                      <th className="py-2.5 px-3 text-right">+120m</th>
                      <th className="py-2.5 px-3">30m Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                    {analogsResult.analogs.map((an, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3 text-cyan-300">{an.session_date}</td>
                        <td className="py-2 px-3 text-slate-400">{an.time_label}</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-200">{an.similarity_score}%</td>
                        <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                          €{an.historical_price.toFixed(3)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300 tabular-nums">{an.rvol.toFixed(2)}x</td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${
                            an.fwd_return_5m >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {(an.fwd_return_5m * 100).toFixed(2)}%
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${
                            an.fwd_return_15m >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {(an.fwd_return_15m * 100).toFixed(2)}%
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-semibold tabular-nums ${
                            an.fwd_return_30m >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {(an.fwd_return_30m * 100).toFixed(2)}%
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${
                            an.fwd_return_60m >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {(an.fwd_return_60m * 100).toFixed(2)}%
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${
                            an.fwd_return_120m >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {(an.fwd_return_120m * 100).toFixed(2)}%
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              an.is_winner_30m ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                            }`}
                          >
                            {an.is_winner_30m ? 'GAIN' : 'LOSS'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 4: Friction Sensitivity Stress Matrix */}
      {activeSubTab === 'sensitivity' && (
        <div className="bg-[#111827] border border-slate-800 p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Execution Friction & Latency Sensitivity Stress Matrix
            </span>
            <span className="text-xs text-slate-500 font-mono">8 Rigorous Stress Scenarios</span>
          </div>

          <p className="text-xs text-slate-400 font-mono leading-relaxed">
            Tests strategy survival under deteriorating market microstructure conditions: wider bid-ask spreads,
            execution latency delays, increased slippage, and higher ticket minimums.
          </p>

          <div className="border border-slate-800 rounded overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Scenario Name</th>
                  <th className="py-2.5 px-3 text-right">Spread</th>
                  <th className="py-2.5 px-3 text-right">Slippage</th>
                  <th className="py-2.5 px-3 text-right">Latency</th>
                  <th className="py-2.5 px-3 text-right">Min Ticket</th>
                  <th className="py-2.5 px-3 text-right">Net Return</th>
                  <th className="py-2.5 px-3 text-right">Max Drawdown</th>
                  <th className="py-2.5 px-3 text-right">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">Profit Factor</th>
                  <th className="py-2.5 px-3 text-right">Trades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                {sensitivityScenarios.map((sc, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-200">{sc.name}</td>
                    <td className="py-2 px-3 text-right text-slate-400 tabular-nums">{sc.spread_bps} bps</td>
                    <td className="py-2 px-3 text-right text-slate-400 tabular-nums">{sc.slippage_bps} bps</td>
                    <td className="py-2 px-3 text-right text-slate-400 tabular-nums">{sc.latency_minutes}m</td>
                    <td className="py-2 px-3 text-right text-slate-400 tabular-nums">€{sc.min_fee.toFixed(1)}</td>
                    <td
                      className={`py-2 px-3 text-right font-bold tabular-nums ${
                        sc.net_return >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {(sc.net_return * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right text-red-400 tabular-nums">
                      {(sc.max_drawdown * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200 tabular-nums">
                      {(sc.win_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200 tabular-nums">
                      {sc.profit_factor !== null ? sc.profit_factor.toFixed(2) : 'N/A'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400 tabular-nums">{sc.trades_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 5: Trades */}
      {activeSubTab === 'trades' && (
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Trade ID</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Entry Time</th>
                  <th className="py-2.5 px-3">Exit Time</th>
                  <th className="py-2.5 px-3 text-right">Shares</th>
                  <th className="py-2.5 px-3 text-right">Entry Price</th>
                  <th className="py-2.5 px-3 text-right">Exit Price</th>
                  <th className="py-2.5 px-3 text-right">Fees (€)</th>
                  <th className="py-2.5 px-3 text-right">Net PnL (€)</th>
                  <th className="py-2.5 px-3 text-right">Net Return</th>
                  <th className="py-2.5 px-3">Exit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500">
                      No trades triggered with current parameters.
                    </td>
                  </tr>
                ) : (
                  trades.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 text-cyan-400">{t.id}</td>
                      <td className="py-2 px-3 text-slate-400">{t.session_date}</td>
                      <td className="py-2 px-3 text-slate-300">{t.entry_time.split('T')[1]?.substring(0, 5)}</td>
                      <td className="py-2 px-3 text-slate-300">{t.exit_time.split('T')[1]?.substring(0, 5)}</td>
                      <td className="py-2 px-3 text-right text-slate-200 tabular-nums">{t.quantity}</td>
                      <td className="py-2 px-3 text-right text-slate-200 tabular-nums">€{t.entry_price.toFixed(3)}</td>
                      <td className="py-2 px-3 text-right text-slate-200 tabular-nums">€{t.exit_price.toFixed(3)}</td>
                      <td className="py-2 px-3 text-right text-slate-400 tabular-nums">€{t.total_fees.toFixed(2)}</td>
                      <td
                        className={`py-2 px-3 text-right font-semibold tabular-nums ${
                          t.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {t.net_pnl >= 0 ? `+€${t.net_pnl.toFixed(2)}` : `-€${Math.abs(t.net_pnl).toFixed(2)}`}
                      </td>
                      <td
                        className={`py-2 px-3 text-right tabular-nums ${
                          t.net_return >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {(t.net_return * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-slate-400 capitalize">{t.exit_reason.replace('_', ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 6: Bootstrap Diagnostics */}
      {activeSubTab === 'bootstrap' && (
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
              Dependent Block Bootstrap Diagnostics
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {metrics.bootstrap_ci.n_bootstrap.toLocaleString()} Resamples · Block Length ={' '}
              {metrics.bootstrap_ci.block_length} Sessions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
              <div className="text-slate-500 mb-1">95% LOWER CI BOUND (BONFERRONI)</div>
              <div
                className={`text-lg font-bold tabular-nums ${
                  metrics.bootstrap_ci.lower > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {(metrics.bootstrap_ci.lower * 100).toFixed(4)}%
              </div>
              <div className="text-slate-500 text-[11px] mt-1">
                Must be &gt; 0.0% to satisfy statistical edge gate
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
              <div className="text-slate-500 mb-1">BOOTSTRAP SAMPLE MEAN</div>
              <div className="text-lg font-bold text-slate-200 tabular-nums">
                {(metrics.bootstrap_ci.mean * 100).toFixed(4)}%
              </div>
              <div className="text-slate-500 text-[11px] mt-1">Expected daily net return</div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
              <div className="text-slate-500 mb-1">95% UPPER CI BOUND</div>
              <div className="text-lg font-bold text-cyan-400 tabular-nums">
                {(metrics.bootstrap_ci.upper * 100).toFixed(4)}%
              </div>
              <div className="text-slate-500 text-[11px] mt-1">Upper statistical dispersion</div>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed font-mono">
            <strong>Methodology</strong>: Uses stationary circular block bootstrap resampling to preserve the
            empirical serial autocorrelation and volatility clustering of daily returns. Bonferroni adjustment (α ={' '}
            {(metrics.bootstrap_ci.alpha * 100).toFixed(3)}%) penalizes multiple testing across the 12-trial research
            budget family.
          </p>
        </div>
      )}
    </div>
  );
};
