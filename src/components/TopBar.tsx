import React from 'react';
import { Download, Play, ShieldAlert } from 'lucide-react';

export type WorkspaceTab = 'audit' | 'research' | 'findings' | 'holdout' | 'paper';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onRunBacktest: () => void;
  onExportBundle: () => void;
  isRunning: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  onRunBacktest,
  onExportBundle,
  isRunning,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-[#090D16] border-b border-slate-800 shrink-0">
      {/* Zone 1: Brand title wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="/"
          className="text-base font-bold tracking-tight text-slate-100 hover:text-white transition-colors whitespace-nowrap"
        >
          UniCredit Research Lab
        </a>
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>UCG.MI</span>
          <span aria-hidden="true">·</span>
          <span>Intraday v0.2.0</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-500/90 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Live Disabled
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => onTabChange('audit')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'audit'
              ? 'bg-slate-800 text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Data Audit
        </button>

        <button
          onClick={() => onTabChange('research')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'research'
              ? 'bg-slate-800 text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Research & Backtesting
        </button>

        <button
          onClick={() => onTabChange('findings')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'findings'
              ? 'bg-slate-800 text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Phase 10 Replication
        </button>

        <button
          onClick={() => onTabChange('holdout')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'holdout'
              ? 'bg-slate-800 text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Holdout Gate
        </button>

        <button
          onClick={() => onTabChange('paper')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'paper'
              ? 'bg-slate-800 text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Paper Terminal
        </button>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onExportBundle}
          title="Download study research bundle & documentation"
          className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Export Bundle</span>
        </button>

        <button
          onClick={onRunBacktest}
          disabled={isRunning}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isRunning ? 'Simulating...' : 'Run Simulation'}</span>
        </button>
      </div>
    </header>
  );
};
