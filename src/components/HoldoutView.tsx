import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertTriangle, CheckCircle, XCircle, FileText, RefreshCw } from 'lucide-react';
import { Candidate, CandidateResult, HoldoutState } from '../types';

interface HoldoutViewProps {
  holdoutState: HoldoutState;
  frozenCandidate: Candidate | null;
  onEvaluateHoldout: () => Promise<void>;
  onResetStudyDemo: () => Promise<void>;
  isEvaluating: boolean;
  errorMessage: string | null;
}

export const HoldoutView: React.FC<HoldoutViewProps> = ({
  holdoutState,
  frozenCandidate,
  onEvaluateHoldout,
  onResetStudyDemo,
  isEvaluating,
  errorMessage,
}) => {
  const result: CandidateResult | null = holdoutState.result;

  return (
    <div className="space-y-6">
      {/* Top Protocol Status Banner */}
      <div
        className={`p-4 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          holdoutState.evaluated
            ? 'bg-amber-950/20 border-amber-500/60 text-amber-200'
            : frozenCandidate
            ? 'bg-cyan-950/20 border-cyan-500/60 text-cyan-200'
            : 'bg-slate-900/60 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-start gap-3">
          {holdoutState.evaluated ? (
            <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="text-sm font-bold tracking-tight">
              {holdoutState.evaluated
                ? 'HOLDOUT PERIOD SEALED & EVALUATED (ONE-SHOT ENFORCED)'
                : frozenCandidate
                ? `CANDIDATE FROZEN IN SERVER LEDGER: ${frozenCandidate.id} (${frozenCandidate.name})`
                : 'HOLDOUT GATE: NO CANDIDATE FROZEN'}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              {holdoutState.evaluated
                ? `Evaluated on ${holdoutState.evaluation_date}. Server ledger locked against repeat testing.`
                : frozenCandidate
                ? `Frozen on ${holdoutState.frozen_at}. Ready for irrevocable one-shot evaluation.`
                : 'Select and freeze a candidate from the Research & Backtesting tab first.'}
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-3 shrink-0">
          {!holdoutState.evaluated ? (
            <button
              onClick={onEvaluateHoldout}
              disabled={!frozenCandidate || isEvaluating}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 rounded transition-all shadow flex items-center gap-2 whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isEvaluating ? 'Evaluating on Server...' : 'Execute One-Shot Holdout'}</span>
            </button>
          ) : (
            <button
              onClick={onResetStudyDemo}
              title="Demo only: Start new research study with cleared ledger"
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Study (Demo)</span>
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-950/30 border border-red-500/50 rounded-lg text-xs text-red-300 font-mono flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Trial Search Budget Meter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Pre-Declared Search Budget</div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {holdoutState.trial_count} / {holdoutState.search_budget}
          </div>
          <div className="text-xs text-slate-500 mt-1">Bonferroni adjusted family trials</div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Holdout Reserved Sessions</div>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {holdoutState.holdout_sessions} Sessions
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {holdoutState.first_date} through {holdoutState.last_date}
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Evidence State</div>
          <div
            className={`text-xl font-bold font-mono ${
              result ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            {result ? result.evidence.status : 'AWAITING_HOLDOUT'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            eligible_for_live: false
          </div>
        </div>
      </div>

      {/* Evaluated Result Details */}
      {result ? (
        <div className="space-y-4">
          <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Certified Out-of-Sample Holdout Performance Tear Sheet
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <div className="bg-slate-900/80 p-3 rounded border border-slate-800 font-mono">
                <div className="text-slate-500 text-[11px] mb-1">HOLDOUT NET RETURN</div>
                <div
                  className={`text-lg font-bold tabular-nums ${
                    result.metrics.net_return >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {(result.metrics.net_return * 100).toFixed(2)}%
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  €{result.metrics.total_net_pnl.toFixed(2)} Net PnL
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded border border-slate-800 font-mono">
                <div className="text-slate-500 text-[11px] mb-1">MAX HOLDOUT DD</div>
                <div className="text-lg font-bold text-red-400 tabular-nums">
                  {(result.metrics.max_drawdown * 100).toFixed(2)}%
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">Daily close basis</div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded border border-slate-800 font-mono">
                <div className="text-slate-500 text-[11px] mb-1">HOLDOUT TRADES</div>
                <div className="text-lg font-bold text-slate-100 tabular-nums">
                  {result.metrics.trades}
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  {(result.metrics.win_rate * 100).toFixed(1)}% win rate
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded border border-slate-800 font-mono">
                <div className="text-slate-500 text-[11px] mb-1">PROFIT FACTOR</div>
                <div className="text-lg font-bold text-slate-100 tabular-nums">
                  {result.metrics.profit_factor !== null ? result.metrics.profit_factor.toFixed(2) : 'N/A'}
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  €{result.metrics.total_fees.toFixed(2)} fees
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded border border-slate-800 font-mono">
                <div className="text-slate-500 text-[11px] mb-1">ACTIVE WEEKS</div>
                <div className="text-lg font-bold text-slate-100 tabular-nums">
                  {(result.metrics.active_week_fraction * 100).toFixed(1)}%
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">Coverage metric</div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded border border-slate-800 font-mono">
                <div className="text-slate-500 text-[11px] mb-1">95% LOWER CI</div>
                <div
                  className={`text-lg font-bold tabular-nums ${
                    result.metrics.bootstrap_ci.lower > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {(result.metrics.bootstrap_ci.lower * 100).toFixed(3)}%
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">Bonferroni adjusted</div>
              </div>
            </div>

            {/* Scientific Evidence Check Matrix */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Statistical Evidence Gate Checks
              </div>

              {result.evidence.passed_checks.map((chk, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>PASS: {chk}</span>
                </div>
              ))}

              {result.evidence.failed_checks.map((chk, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono text-red-400">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>FAIL: {chk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-[#111827] border border-slate-800 rounded-lg">
          <Lock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <div className="text-sm font-semibold text-slate-300">Holdout Period Locked & Untouched</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            The holdout period covers 30 sessions of reserved historical data. When you are confident in your
            strategy hypothesis, freeze the candidate to trigger the immutable one-shot holdout evaluation.
          </p>
        </div>
      )}
    </div>
  );
};
