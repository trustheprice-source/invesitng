import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  TrendingDown,
  AlertTriangle,
  Scale,
  Clock,
  Layers,
  Download,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface ReportDoc {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  filename: string;
  summary: string[];
}

const REPORT_METADATA: ReportDoc[] = [
  {
    id: 'data_verification',
    title: 'Data Verification & Audit',
    subtitle: 'Forensic audit of 60 Euronext Milan trading sessions & DST handling',
    badge: 'Audited & Verified',
    badgeColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/30',
    filename: 'DATA_VERIFICATION_REPORT.md',
    summary: [
      'Resolved 6,121 5m bars = 60 complete 510-minute trading sessions across 84 calendar days.',
      'UTC to Europe/Rome daylight saving shift on 2026-10-25 (CEST UTC+2 to CET UTC+1) verified.',
      '0 null prices, 0 duplicate timestamps, 61 zero-volume bars (treated as illiquid non-executable).',
      'Commercial tick license blocker formally recorded for 5-10 year 1m/tick depth.',
    ],
  },
  {
    id: 'engine_parity',
    title: 'Engine Parity & Mathematical Alignment',
    subtitle: 'Python ucg_lab vs. TypeScript browser engine parity certification',
    badge: '100% Parity',
    badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30',
    filename: 'ENGINE_PARITY_REPORT.md',
    summary: [
      '6/6 automated test suites in tests/test_engine_parity.ts passed with 0 errors.',
      'Identical non-linear ticket fee: max(€3.00, notional * 0.0005).',
      'Identical 7 bps friction price: open * (1 ± (spread/2 + slippage)).',
      'Intrabar stop-loss filled at min(open, stop_price) * (1 - friction) in both engines.',
      'Italian Tobin Tax (Law 228/2012): same-day flat positions verified exempt; overnight taxed at 0.10%.',
    ],
  },
  {
    id: 'real_baseline',
    title: 'Real Market Baseline Evaluation',
    subtitle: 'Performance on 60 real UCG.MI sessions across 4 strategies & 4 benchmarks',
    badge: 'No Qualifying Strategy',
    badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-950/30',
    filename: 'REAL_MARKET_BASELINE.md',
    summary: [
      'Buy-and-Hold UCG fell -9.33% (€85.12 to €77.18); Fixed Intraday Rule finished +0.81% net.',
      'All 4 intraday strategies generated negative net returns (-3.70% to -28.47%).',
      'The €3.00 ticket fee + 10 bps spread + 4 bps slippage imposes a 38 bps hurdle per trade.',
      'Friction hurdle (38 bps) exceeds typical 30-minute volatility (31 bps), forcing negative expectancy.',
    ],
  },
  {
    id: 'pattern_research',
    title: 'Pattern Research & Sector Relationships',
    subtitle: 'Multi-horizon returns, UCG/EXV1 banking spreads, and decision trees',
    badge: 'Symmetric Drift',
    badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-950/30',
    filename: 'PATTERN_RESEARCH_REPORT.md',
    summary: [
      '5m, 15m, 30m forward returns display strict symmetry (47.6% - 49.8% win fraction).',
      'Volatility expands with sqrt(t): 12.9 bps (5m) to 62.3 bps (120m).',
      'Only 60m-120m horizons provide sufficient variance to overcome the 38 bps hurdle.',
      'UniCredit has a beta of 1.24 to EURO STOXX Banks (EXV1.DE); pair catch-up drift is 8.4 bps gross.',
    ],
  },
  {
    id: 'statistical_validation',
    title: 'Statistical Validation & Gates',
    subtitle: 'Circular block bootstrap, walk-forward gates, and friction stress matrix',
    badge: 'Gate Locked',
    badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-950/30',
    filename: 'STATISTICAL_VALIDATION_REPORT.md',
    summary: [
      'All 4 candidates failed pre-declared acceptance gates; bootstrap 95% CIs strictly non-positive.',
      'Theoretical Zero-Friction yields +2.14% on Mean Reversion, proving underlying signal exists.',
      'Holdout partition (30 sessions) preserved pristine and unviolated in server ledger.',
      'Formal status declared: NO_QUALIFYING_STRATEGY / RESEARCH_ONLY without fabricating edge.',
    ],
  },
  {
    id: 'paper_status',
    title: 'Paper Trading Daemon & OpenClaw',
    subtitle: 'Real-time prospective simulation, execution delays, and contract safety',
    badge: 'Daemon Active',
    badgeColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/30',
    filename: 'PAPER_TRADING_STATUS.md',
    summary: [
      'Paper daemon logs prospective signals before t+1 execution prices occur.',
      'Real-world 2026 price regime (€77.18) enabled as default; synthetic regime retained for tests.',
      'OpenClaw execution contract schema fully implemented in src/engine/paperCore.ts.',
      'OpenClaw export gated and locked until a candidate passes holdout criteria. Live trading disabled.',
    ],
  },
  {
    id: 'next_steps',
    title: 'Next Research Steps & Roadmap',
    subtitle: '6 concrete quantitative initiatives to overcome transaction friction',
    badge: 'Actionable Plan',
    badgeColor: 'text-indigo-400 border-indigo-500/30 bg-indigo-950/30',
    filename: 'NEXT_RESEARCH_STEPS.md',
    summary: [
      'Initiative 1: Transition from 5m scalping to 60m-120m multi-hour intraday swing horizons.',
      'Initiative 2: Increase trade notional (€20k+) so €3.00 ticket fee represents < 3 bps instead of 24 bps.',
      'Initiative 3: Statistical arbitrage cointegration against Intesa Sanpaolo (ISP.MI) and Banco BPM.',
      'Initiative 4: Analyze 17:30 CET Closing Auction (MOC) imbalance dynamics.',
      'Initiative 5: Ingest commercial multi-year tick archives via ready CSV fallback pipeline.',
      'Initiative 6: Train shallow monotonic Gradient Boosted Trees (LightGBM) on 60m targets.',
    ],
  },
];

export const ResearchFindingsView: React.FC = () => {
  const [selectedReportId, setSelectedReportId] = useState<string>('real_baseline');
  const [copied, setCopied] = useState<boolean>(false);

  const activeDoc = REPORT_METADATA.find((d) => d.id === selectedReportId) || REPORT_METADATA[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(`View report: ${activeDoc.filename}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090D16] text-slate-200 overflow-y-auto">
      {/* Top Banner: Research Governance & Integrity Certification */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded">
                Phase 6 Research Review
              </span>
              <span className="text-xs text-slate-400 font-mono">UCG.MI (Euronext Milan)</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Empirical Strategy Discovery & Microstructure Validation
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Independent audit of 60 trading sessions (6,121 5m bars), mathematical engine parity, and friction stress testing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded bg-slate-800/80 border border-slate-700/60 text-right">
              <div className="text-[10px] uppercase font-mono text-slate-400">Formal Verdict</div>
              <div className="text-xs font-bold text-rose-400 font-mono">NO_QUALIFYING_STRATEGY</div>
            </div>
            <div className="px-3 py-1.5 rounded bg-slate-800/80 border border-slate-700/60 text-right">
              <div className="text-[10px] uppercase font-mono text-slate-400">Holdout Partition</div>
              <div className="text-xs font-bold text-cyan-400 font-mono">PRISTINE (LOCKED)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* Section 1: Executive KPI Scoreboard on Real Data */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Buy-and-Hold UCG Benchmark</div>
            <div className="text-xl font-bold font-mono text-rose-400 mt-1">-9.33%</div>
            <div className="text-[11px] text-slate-500 mt-1">€85.12 → €77.18 (60 sessions)</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Fixed Intraday Time Rule</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">+0.81%</div>
            <div className="text-[11px] text-slate-500 mt-1">09:30-17:00 CET (Overnight avoided)</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Intraday Friction Hurdle</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">38.0 bps</div>
            <div className="text-[11px] text-slate-500 mt-1">€6 round fee + 10bps spread + 4bps slip</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">30-Min Asset Volatility</div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">31.2 bps</div>
            <div className="text-[11px] text-slate-500 mt-1">Hurdle exceeds 1.22σ move</div>
          </div>
        </div>

        {/* Section 2: Real Market Baseline Comparison Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-cyan-400" />
                Real Market Baseline Strategy Comparison (60 Euronext Milan Sessions)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic execution replay with €10,000 cash, 25% allocation, €3 minimum fee, 10 bps spread, and 2 bps/side slippage.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">
              Period: 2026-08-14 to 2026-11-05
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="py-2.5 px-3">Candidate / Benchmark</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Trades</th>
                  <th className="py-2.5 px-3 text-right">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">Net Return</th>
                  <th className="py-2.5 px-3 text-right">Max Drawdown</th>
                  <th className="py-2.5 px-3 text-right">Fees Paid</th>
                  <th className="py-2.5 px-3">95% Bootstrap CI</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr className="hover:bg-slate-800/20 bg-slate-800/10">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">1. Cash Holding</td>
                  <td className="py-2.5 px-3 text-slate-400">Risk-Free</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">0</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">0.00%</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">0.00%</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">€0.00</td>
                  <td className="py-2.5 px-3 text-slate-400">[0.00%, 0.00%]</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">BENCHMARK</span>
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/20 bg-slate-800/10">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">2. Buy-and-Hold UCG.MI</td>
                  <td className="py-2.5 px-3 text-slate-400">Passive Equity</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">1</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">0.0%</td>
                  <td className="py-2.5 px-3 text-right text-rose-400 font-bold">-9.33%</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">11.52%</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">€6.00</td>
                  <td className="py-2.5 px-3 text-slate-400">[-0.24%, -0.05%]</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">BENCHMARK</span>
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/20 bg-slate-800/10">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">3. Fixed Intraday Time Rule</td>
                  <td className="py-2.5 px-3 text-slate-400">Time Rule (09:30-17:00)</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">60</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">46.7%</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">+0.81%</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">3.89%</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">€360.00</td>
                  <td className="py-2.5 px-3 text-slate-400">[-0.04%, +0.07%]</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">BENCHMARK</span>
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/20">
                  <td className="py-2.5 px-3 font-semibold text-cyan-400">pullback_v1</td>
                  <td className="py-2.5 px-3 text-slate-400">Trend Pullback</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">172</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">8.1%</td>
                  <td className="py-2.5 px-3 text-right text-rose-400 font-bold">-14.95%</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">14.95%</td>
                  <td className="py-2.5 px-3 text-right text-amber-400">€1,032.00</td>
                  <td className="py-2.5 px-3 text-rose-400">[-0.36%, -0.18%]</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] text-rose-400 bg-rose-950/40 border border-rose-500/30 px-1.5 py-0.5 rounded">REJECTED</span>
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/20">
                  <td className="py-2.5 px-3 font-semibold text-cyan-400">breakout_v1</td>
                  <td className="py-2.5 px-3 text-slate-400">Opening Breakout</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">63</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">11.1%</td>
                  <td className="py-2.5 px-3 text-right text-rose-400 font-bold">-5.35%</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">5.35%</td>
                  <td className="py-2.5 px-3 text-right text-amber-400">€378.00</td>
                  <td className="py-2.5 px-3 text-rose-400">[-0.13%, -0.06%]</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] text-rose-400 bg-rose-950/40 border border-rose-500/30 px-1.5 py-0.5 rounded">REJECTED</span>
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/20">
                  <td className="py-2.5 px-3 font-semibold text-cyan-400">mean_reversion_v1</td>
                  <td className="py-2.5 px-3 text-slate-400">Mean Reversion</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">35</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">17.1%</td>
                  <td className="py-2.5 px-3 text-right text-rose-400 font-bold">-3.70%</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">3.70%</td>
                  <td className="py-2.5 px-3 text-right text-amber-400">€210.00</td>
                  <td className="py-2.5 px-3 text-rose-400">[-0.12%, -0.02%]</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] text-rose-400 bg-rose-950/40 border border-rose-500/30 px-1.5 py-0.5 rounded">REJECTED</span>
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/20">
                  <td className="py-2.5 px-3 font-semibold text-cyan-400">ridge_v1</td>
                  <td className="py-2.5 px-3 text-slate-400">Ridge Regression</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">310</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">7.4%</td>
                  <td className="py-2.5 px-3 text-right text-rose-400 font-bold">-28.47%</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">28.47%</td>
                  <td className="py-2.5 px-3 text-right text-amber-400">€1,860.00</td>
                  <td className="py-2.5 px-3 text-rose-400">[-0.66%, -0.41%]</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] text-rose-400 bg-rose-950/40 border border-rose-500/30 px-1.5 py-0.5 rounded">REJECTED</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Navigation & Document Viewer for the 7 Official Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document List */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 mb-2">
              Deliverable Audit Reports (Phase 6)
            </div>

            {REPORT_METADATA.map((doc) => {
              const isSelected = doc.id === selectedReportId;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedReportId(doc.id)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-cyan-500/50 shadow-sm shadow-cyan-950/40'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                      {doc.title}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${doc.badgeColor}`}>
                      {doc.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{doc.subtitle}</p>
                </button>
              );
            })}
          </div>

          {/* Active Document Detail Inspector */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-lg p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{activeDoc.title}</h3>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${activeDoc.badgeColor}`}>
                      {activeDoc.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{activeDoc.subtitle}</p>
                  <div className="text-[11px] font-mono text-cyan-400 mt-1 flex items-center gap-1">
                    <span>Root File:</span>
                    <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">/{activeDoc.filename}</span>
                  </div>
                </div>

                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Path Copied' : 'Copy Path'}</span>
                </button>
              </div>

              {/* Key Takeaways & Empirical Summary */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Key Findings & Empirical Summary:
                </div>
                <div className="space-y-2">
                  {activeDoc.summary.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded border border-slate-800/60">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Status: Finalized & Saved to Repository Root</span>
              <span className="text-slate-400">ISIN: IT0005239360 · MTAA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
