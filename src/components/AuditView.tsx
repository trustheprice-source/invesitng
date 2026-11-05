import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Hash, Database, Clock, ShieldCheck, Download, AlertOctagon } from 'lucide-react';
import { AuditReport, Bar1m } from '../types';

interface AuditViewProps {
  audit: AuditReport;
  sampleBars: Bar1m[];
  dataSource: 'real_mtaa' | 'synthetic_demo';
  onToggleDataSource: (source: 'real_mtaa' | 'synthetic_demo') => void;
  isLoadingRealData?: boolean;
}

export const AuditView: React.FC<AuditViewProps> = ({
  audit,
  sampleBars,
  dataSource,
  onToggleDataSource,
  isLoadingRealData,
}) => {
  const [selectedTab, setSelectedTab] = useState<'checks' | 'blocker_report' | 'sample'>('checks');

  return (
    <div className="space-y-6">
      {/* Data Source Switcher Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111827] border border-slate-800 p-4 rounded-lg">
        <div>
          <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Active Research Data Source
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {dataSource === 'real_mtaa'
              ? 'Real Euronext Milan market data (UCG.MI) + EURO STOXX Banking ETF context'
              : 'Synthetic research calibration dataset (180 trading sessions baseline)'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleDataSource('real_mtaa')}
            disabled={isLoadingRealData}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              dataSource === 'real_mtaa'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {isLoadingRealData ? 'Fetching Real MTAA...' : 'Real Euronext Milan Feed'}
          </button>

          <button
            onClick={() => onToggleDataSource('synthetic_demo')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              dataSource === 'synthetic_demo'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Synthetic Calibration Baseline
          </button>
        </div>
      </div>

      {/* Overview Metric Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            Trading Sessions Loaded
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
            {audit.sessions_count} Sessions
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {audit.start_date} to {audit.end_date}
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Completed Intraday Bars
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
            {audit.bars_count.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {dataSource === 'real_mtaa' ? '5-min bars with sector context' : '1-minute raw ticks'}
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Data Invariant Checks
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            {audit.passed_checks.length} Passed
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {audit.missing_minutes === 0 ? 'Zero calendar gaps' : `${audit.missing_minutes} missing`}
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            Data Provenance
          </div>
          <div
            className={`text-xl font-bold ${
              audit.provenance_verified ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {audit.provenance_verified ? 'Verified Real' : 'Synthetic Demo'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {audit.provenance_verified ? 'Euronext Milan feed verified' : 'Commercial license required'}
          </div>
        </div>
      </div>

      {/* Dataset Hashes & Integrity Box */}
      <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Hash className="w-4 h-4 text-cyan-400" />
          Cryptographic Integrity & Manifest Hashes (SHA-256)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
            <div className="text-slate-500 text-[11px] mb-0.5">DATASET HASH</div>
            <div className="text-cyan-300 truncate" title={audit.dataset_hash}>
              {audit.dataset_hash}
            </div>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
            <div className="text-slate-500 text-[11px] mb-0.5">ENGINE / RESEARCH SPECIFICATION HASH</div>
            <div className="text-slate-300 truncate" title={audit.source_hash}>
              {audit.source_hash}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar for Checks vs Blocker Report vs Sample */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSelectedTab('checks')}
          className={`px-3 py-1 text-xs font-medium rounded ${
            selectedTab === 'checks' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Audit Invariant Checks ({audit.passed_checks.length})
        </button>
        <button
          onClick={() => setSelectedTab('blocker_report')}
          className={`px-3 py-1 text-xs font-medium rounded ${
            selectedTab === 'blocker_report' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Data Guide & Historical Blocker Report
        </button>
        <button
          onClick={() => setSelectedTab('sample')}
          className={`px-3 py-1 text-xs font-medium rounded ${
            selectedTab === 'sample' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Raw Bar Inspection ({sampleBars.length} bars)
        </button>
      </div>

      {selectedTab === 'checks' && (
        <div className="space-y-3">
          <div className="space-y-2">
            {audit.passed_checks.map((check, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded bg-slate-900/40 border border-slate-800/80 text-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300 font-mono">{check}</span>
              </div>
            ))}
          </div>

          {audit.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Research Protocol Caveats & Warnings
              </div>
              {audit.warnings.map((warn, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300/90"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTab === 'blocker_report' && (
        <div className="bg-[#111827] border border-slate-800 p-5 rounded-lg space-y-5 font-mono text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
            <AlertOctagon className="w-5 h-5" />
            <span>Formal Data Access & Historical Sourcing Audit</span>
          </div>

          <div className="bg-slate-900/80 p-4 rounded border border-slate-800 space-y-3">
            <div className="text-slate-200 font-semibold text-sm">1. Currently Verified Available Feeds:</div>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li>
                <strong className="text-slate-300">Yahoo Finance MTAA Feed:</strong> Real Euronext Milan 5-minute bars
                for 60 calendar days (approx. 6,100 completed bars) + FTSE MIB index + EURO STOXX Banks ETF context.
              </li>
              <li>
                <strong className="text-slate-300">1-Minute Horizon:</strong> 7 days of 1-minute historical bars.
              </li>
              <li>
                <strong className="text-slate-300">Daily Horizon:</strong> 10+ years of daily session closes, trading
                volumes, and corporate action adjustments.
              </li>
            </ul>
          </div>

          <div className="bg-amber-950/20 p-4 rounded border border-amber-900/50 space-y-3">
            <div className="text-amber-300 font-semibold text-sm">
              2. Exact Data Blocker: 5–10 Year Intraday 1-Minute Tick Archive
            </div>
            <p className="text-amber-200/90 leading-relaxed">
              Acquiring continuous, verified 1-minute and tick-level historical data across 5–10 years for UniCredit
              (ISIN: IT0005239360, Euronext Milan) requires a commercial market data subscription or institutional
              entitlement. Free public endpoints restrict high-frequency bars to 60 days.
            </p>
            <div className="text-slate-300 font-semibold">Authorized Commercial Providers:</div>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li>Euronext Market Data Solutions (Direct Borsa Italiana Level 1/2 tick historical tape)</li>
              <li>LSEG Refinitiv Tick History / Elektron API</li>
              <li>Bloomberg Data License (B-PIPE Intraday Tick Archive)</li>
              <li>FirstRate Data (Borsa Italiana / Euronext Milan Intraday Equities Package)</li>
            </ul>
          </div>

          <div className="bg-slate-900/80 p-4 rounded border border-slate-800 space-y-3">
            <div className="text-slate-200 font-semibold text-sm">
              3. Canonical Ingestion Pipeline:
            </div>
            <p className="text-slate-400 leading-relaxed">
              The platform implements the canonical ingestion standard specified in <code>docs/DATA_GUIDE.md</code>.
              Researchers with licensed archives can drop <code>bars.csv</code> (fields:{' '}
              <code>timestamp,open,high,low,close,volume</code>) and <code>sessions.csv</code> into the project root to
              seamlessly run multi-year backtests without code changes.
            </p>
          </div>
        </div>
      )}

      {selectedTab === 'sample' && (
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3 text-right">Open (€)</th>
                  <th className="py-2.5 px-3 text-right">High (€)</th>
                  <th className="py-2.5 px-3 text-right">Low (€)</th>
                  <th className="py-2.5 px-3 text-right">Close (€)</th>
                  <th className="py-2.5 px-3 text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                {sampleBars.slice(0, 100).map((bar, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-400">{bar.timestamp}</td>
                    <td className="py-2 px-3 text-right text-slate-200 tabular-nums">{bar.open.toFixed(3)}</td>
                    <td className="py-2 px-3 text-right text-slate-200 tabular-nums">{bar.high.toFixed(3)}</td>
                    <td className="py-2 px-3 text-right text-slate-200 tabular-nums">{bar.low.toFixed(3)}</td>
                    <td className="py-2 px-3 text-right text-cyan-300 tabular-nums font-semibold">
                      {bar.close.toFixed(3)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                      {bar.volume.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
