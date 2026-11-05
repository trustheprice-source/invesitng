import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Copy,
  Check,
  DollarSign,
  Clock,
  Cpu,
  ShieldAlert,
  Play,
  Square,
  Activity,
} from 'lucide-react';
import { Candidate, ExecutionConfig, PaperOrder, PaperPosition, PaperQuote, VirtualExecutionLogEvent } from '../types';
import { generateOpenClawHandoff, generateSimulatedQuote } from '../engine/paperCore';

interface PaperTerminalViewProps {
  candidate: Candidate;
  config: ExecutionConfig;
}

export const PaperTerminalView: React.FC<PaperTerminalViewProps> = ({ candidate, config }) => {
  const [priceRegime, setPriceRegime] = useState<'current_2026' | 'historical_2020'>('current_2026');
  const [cash, setCash] = useState<number>(config.initial_cash);
  const [position, setPosition] = useState<PaperPosition | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [lastPrice, setLastPrice] = useState<number>(77.2);
  const [quote, setQuote] = useState<PaperQuote>(() =>
    generateSimulatedQuote(77.2, new Date().toISOString().substring(11, 19))
  );

  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [sharesInput, setSharesInput] = useState<number>(50);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [copied, setCopied] = useState<boolean>(false);

  // Phase 4: Autonomous Virtual Trading Daemon state
  const [isDaemonActive, setIsDaemonActive] = useState<boolean>(false);
  const [virtualLogs, setVirtualLogs] = useState<VirtualExecutionLogEvent[]>([]);

  // Switch price regime
  const handleRegimeChange = (regime: 'current_2026' | 'historical_2020') => {
    setPriceRegime(regime);
    const base = regime === 'current_2026' ? 77.2 : 10.5;
    setLastPrice(base);
    setQuote(generateSimulatedQuote(base, new Date().toISOString().substring(11, 19)));
    setSharesInput(regime === 'current_2026' ? 50 : 200);
  };

  // Live simulated tick updates every 2 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setLastPrice((prev) => {
        const stepSize = priceRegime === 'current_2026' ? 0.12 : 0.02;
        const delta = (Math.random() - 0.498) * stepSize;
        const nextPrice = Math.round(Math.max(1.0, prev + delta) * 1000) / 1000;
        const nowStr = new Date().toISOString().substring(11, 19);
        setQuote(generateSimulatedQuote(nextPrice, nowStr));
        return nextPrice;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [priceRegime]);

  // Update position unrealized PnL when last price changes
  useEffect(() => {
    if (position) {
      const unrealizedPnl = (lastPrice - position.average_entry) * position.shares;
      const unrealizedReturn = (unrealizedPnl / (position.average_entry * position.shares)) * 100;
      setPosition((prev) =>
        prev
          ? {
              ...prev,
              current_price: lastPrice,
              unrealized_pnl: unrealizedPnl,
              unrealized_return_pct: unrealizedReturn,
            }
          : null
      );
    }
  }, [lastPrice]);

  // Phase 7: Real Server-Side Autonomous Paper Trading Daemon
  const [daemonState, setDaemonState] = useState<any | null>(null);
  const [journalEvents, setJournalEvents] = useState<any[]>([]);
  const [isEmergencyStopping, setIsEmergencyStopping] = useState<boolean>(false);

  // Poll server daemon state & journal every 3 seconds
  useEffect(() => {
    let isMounted = true;
    const fetchDaemonData = async () => {
      try {
        const [stateRes, journalRes] = await Promise.all([
          fetch('/api/paper/daemon/state'),
          fetch('/api/paper/daemon/journal?limit=60'),
        ]);
        if (stateRes.ok && isMounted) {
          const s = await stateRes.json();
          setDaemonState(s);
          if (s.cash !== undefined) setCash(s.cash);
          if (s.position) {
            setPosition({
              symbol: s.position.symbol,
              shares: s.position.shares,
              average_entry: s.position.average_entry,
              current_price: s.last_provider_price || lastPrice,
              unrealized_pnl: s.unrealized_pnl || 0,
              unrealized_return_pct:
                s.position.average_entry > 0
                  ? ((s.unrealized_pnl || 0) / (s.position.average_entry * s.position.shares)) * 100
                  : 0,
            });
          } else {
            setPosition(null);
          }
        }
        if (journalRes.ok && isMounted) {
          const j = await journalRes.json();
          setJournalEvents(j);
        }
      } catch {}
    };

    fetchDaemonData();
    const timer = setInterval(fetchDaemonData, 3000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [lastPrice]);

  const handleTriggerEmergencyStop = async () => {
    setIsEmergencyStopping(true);
    try {
      const res = await fetch('/api/paper/daemon/emergency-stop', { method: 'POST' });
      const data = await res.json();
      if (data.state) setDaemonState(data.state);
    } catch {}
    setIsEmergencyStopping(false);
  };

  const handleResetSafety = async () => {
    try {
      const res = await fetch('/api/paper/daemon/reset-safety', { method: 'POST' });
      const data = await res.json();
      if (data.state) setDaemonState(data.state);
    } catch {}
  };

  const handlePlaceOrder = () => {
    const fee = Math.max(
      config.minimum_commission,
      sharesInput * (orderSide === 'BUY' ? quote.ask : quote.bid) * config.commission_rate
    );
    const fillPrice = orderSide === 'BUY' ? quote.ask : quote.bid;
    const notional = sharesInput * fillPrice;

    if (orderSide === 'BUY') {
      if (cash < notional + fee) {
        alert('Insufficient cash for order + minimum fee.');
        return;
      }
      setCash((prev) => prev - notional - fee);
      if (position) {
        const totalShares = position.shares + sharesInput;
        const avgEntry = (position.shares * position.average_entry + notional) / totalShares;
        setPosition({
          symbol: 'UCG.MI',
          shares: totalShares,
          average_entry: avgEntry,
          current_price: lastPrice,
          unrealized_pnl: (lastPrice - avgEntry) * totalShares,
          unrealized_return_pct: ((lastPrice - avgEntry) / avgEntry) * 100,
        });
      } else {
        setPosition({
          symbol: 'UCG.MI',
          shares: sharesInput,
          average_entry: fillPrice,
          current_price: lastPrice,
          unrealized_pnl: (lastPrice - fillPrice) * sharesInput,
          unrealized_return_pct: 0,
        });
      }
    } else {
      // SELL
      if (!position || position.shares < sharesInput) {
        alert('Cannot sell more shares than currently held.');
        return;
      }
      setCash((prev) => prev + notional - fee);
      const remainingShares = position.shares - sharesInput;
      if (remainingShares === 0) {
        setPosition(null);
      } else {
        setPosition({
          ...position,
          shares: remainingShares,
          unrealized_pnl: (lastPrice - position.average_entry) * remainingShares,
        });
      }
    }

    const newOrder: PaperOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString().substring(11, 19),
      symbol: 'UCG.MI',
      side: orderSide,
      quantity: sharesInput,
      order_type: orderType,
      status: 'FILLED',
      fill_price: fillPrice,
      fill_time: new Date().toISOString().substring(11, 19),
      fee,
      source: 'MANUAL',
    };

    setOrders((prev) => [newOrder, ...prev]);
  };

  const openClawJson = JSON.stringify(generateOpenClawHandoff(candidate, config, lastPrice), null, 2);

  const handleCopyOpenClaw = () => {
    navigator.clipboard.writeText(openClawJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadOpenClaw = () => {
    const blob = new Blob([openClawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw_paper_handoff_${candidate.id}_v1.1.0.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalEquity = cash + (position ? position.shares * lastPrice : 0);

  return (
    <div className="space-y-6">
      {/* Price Regime Switcher & Market Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111827] border border-slate-800 px-4 py-3 rounded-lg">
        <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
          <span className="text-cyan-400 font-bold">UCG.MI REFERENCE PRICE</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">
            {priceRegime === 'current_2026'
              ? 'Current 2026 Euronext Milan Price (~€77)'
              : 'Historical 2020 Research Dataset (~€10.50)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded">
          <button
            onClick={() => handleRegimeChange('current_2026')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              priceRegime === 'current_2026'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Current Market (~€77)
          </button>
          <button
            onClick={() => handleRegimeChange('historical_2020')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              priceRegime === 'historical_2020'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Historical 2020 (~€10.50)
          </button>
        </div>
      </div>

      {/* Portfolio & Quote Ticker Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg font-mono">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
            Virtual Cash Balance
          </div>
          <div className="text-xl font-bold text-slate-100 tabular-nums">
            €{cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Starting: €{config.initial_cash.toLocaleString()}</div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg font-mono">
          <div className="text-xs text-slate-400 mb-1">Total Account Equity</div>
          <div
            className={`text-xl font-bold tabular-nums ${
              totalEquity >= config.initial_cash ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            €{totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {(((totalEquity - config.initial_cash) / config.initial_cash) * 100).toFixed(2)}% net change
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg font-mono">
          <div className="text-xs text-slate-400 mb-1">Active Position (UCG.MI)</div>
          <div className="text-xl font-bold text-slate-100 tabular-nums">
            {position ? `${position.shares} shares` : 'Flat / Cash'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {position
              ? `Avg: €${position.average_entry.toFixed(3)} · PnL: €${position.unrealized_pnl.toFixed(2)}`
              : 'No open risk exposure'}
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg font-mono">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Live Simulated Quote (10 bps)
          </div>
          <div className="text-lg font-bold text-cyan-300 tabular-nums flex items-center gap-2">
            <span>€{quote.bid.toFixed(3)}</span>
            <span className="text-slate-600 font-normal">/</span>
            <span>€{quote.ask.toFixed(3)}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Bid Sz: {quote.bid_size} · Ask Sz: {quote.ask_size}
          </div>
        </div>
      </div>

      {/* Phase 7: Real Autonomous Paper Trading Daemon Control & Safety Interlocks */}
      <div className="bg-[#111827] border border-slate-800 p-5 rounded-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>Phase 7: Autonomous Paper Trading Daemon</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  SERVER DAEMON ACTIVE
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  daemonState?.feed_status === 'CONNECTED' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  FEED: {daemonState?.feed_status || 'CONNECTED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Evaluates strictly causal signals before execution, applies 1-min delay, enforces 1% stop-loss & 17:25 CET liquidation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {daemonState?.emergency_stop ? (
              <button
                onClick={handleResetSafety}
                className="px-3.5 py-1.5 text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Reset Safety Locks
              </button>
            ) : (
              <button
                onClick={handleTriggerEmergencyStop}
                disabled={isEmergencyStopping}
                className="px-3.5 py-1.5 text-xs font-bold rounded bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Emergency Stop (Kill Switch)
              </button>
            )}
          </div>
        </div>

        {/* Status Indicators Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded flex items-center justify-between">
            <span className="text-slate-400">Cash / Position Reconciliation:</span>
            <span className={`font-bold ${daemonState?.last_reconciliation_ok ? 'text-emerald-400' : 'text-amber-400'}`}>
              {daemonState?.last_reconciliation_ok ? 'VERIFIED OK' : 'RECONCILING'}
            </span>
          </div>
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded flex items-center justify-between">
            <span className="text-slate-400">Daily Loss Brake:</span>
            <span className={`font-bold ${daemonState?.daily_loss_brake_latched ? 'text-red-400' : 'text-slate-200'}`}>
              {daemonState?.daily_loss_brake_latched ? 'LATCHED (2% Limit)' : 'UNLATCHED (Ready)'}
            </span>
          </div>
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded flex items-center justify-between">
            <span className="text-slate-400">Live Execution Guard:</span>
            <span className="text-amber-400 font-bold">eligible_for_live: false</span>
          </div>
        </div>

        {daemonState?.emergency_stop && (
          <div className="p-3 bg-red-950/40 border border-red-800 rounded text-xs font-mono text-red-200 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              EMERGENCY STOP ACTIVE: Open positions liquidated at market. New entries blocked until manually reset.
            </span>
          </div>
        )}
      </div>


      {/* Grid: Order Ticket + OpenClaw Handoff Exporter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Ticket */}
        <div className="bg-[#111827] border border-slate-800 p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Manual Order Entry Ticket
            </div>
            <span className="text-xs text-slate-500 font-mono">1-min delay · whole shares</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setOrderSide('BUY')}
              className={`py-2 text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5 ${
                orderSide === 'BUY'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" /> BUY
            </button>
            <button
              onClick={() => setOrderSide('SELL')}
              className={`py-2 text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5 ${
                orderSide === 'SELL'
                  ? 'bg-red-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" /> SELL
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Quantity (Shares)</label>
              <input
                type="number"
                min="10"
                step="25"
                value={sharesInput}
                onChange={(e) => setSharesInput(parseInt(e.target.value, 10) || 50)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-100 tabular-nums"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Order Type</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-100"
              >
                <option value="MARKET">MARKET</option>
                <option value="LIMIT">LIMIT</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded border border-slate-800 text-xs font-mono space-y-1 text-slate-400">
            <div className="flex justify-between">
              <span>Estimated Execution Price:</span>
              <span className="text-slate-200">
                €{orderSide === 'BUY' ? quote.ask.toFixed(3) : quote.bid.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Order Value:</span>
              <span className="text-slate-200">
                €{(sharesInput * (orderSide === 'BUY' ? quote.ask : quote.bid)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Min Ticket Fee (€3 / 0.05%):</span>
              <span className="text-amber-400">
                €
                {Math.max(
                  config.minimum_commission,
                  sharesInput * (orderSide === 'BUY' ? quote.ask : quote.bid) * config.commission_rate
                ).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            onClick={handlePlaceOrder}
            className={`w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider text-slate-950 transition-colors shadow-sm ${
              orderSide === 'BUY' ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-red-400 hover:bg-red-300'
            }`}
          >
            Submit Paper {orderSide} Order
          </button>
        </div>

        {/* Phase 5: OpenClaw Versioned Handoff Contract */}
        <div className="bg-[#111827] border border-slate-800 p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              Phase 5: OpenClaw Execution Contract (v1.1.0)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyOpenClaw}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownloadOpenClaw}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 font-mono leading-relaxed">
            Deterministic paper execution contract for OpenClaw autonomous agents. Enforces risk mandate, stop-loss, and
            daily loss limit with <code>eligible_for_live: false</code>.
          </p>

          <pre className="bg-slate-950 p-3 rounded border border-slate-800 text-[11px] font-mono text-cyan-300/90 overflow-x-auto max-h-56">
            {openClawJson}
          </pre>
        </div>
      </div>

      {/* Prospective Event Log Table */}
      {virtualLogs.length > 0 && (
        <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg space-y-3">
          <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Prospective Virtual Execution Event Log ({virtualLogs.length} events)
          </div>

          <div className="border border-slate-800 rounded overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Event Type</th>
                  <th className="py-2 px-3">Details</th>
                  <th className="py-2 px-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                {virtualLogs.slice(0, 15).map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-400">{ev.timestamp}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          ev.event_type === 'SIGNAL_RECORDED'
                            ? 'bg-cyan-950 text-cyan-400'
                            : ev.event_type === 'ORDER_FILLED'
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-red-950 text-red-400'
                        }`}
                      >
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{ev.details}</td>
                    <td className="py-2 px-3 text-right text-slate-200 tabular-nums">
                      {ev.price ? `€${ev.price.toFixed(3)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execution Log Table */}
      <div className="bg-[#111827] border border-slate-800 p-4 rounded-lg space-y-3">
        <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          Simulated Paper Execution Ledger ({orders.length} orders)
        </div>

        <div className="border border-slate-800 rounded overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Order ID</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Side</th>
                <th className="py-2.5 px-3 text-right">Shares</th>
                <th className="py-2.5 px-3 text-right">Fill Price</th>
                <th className="py-2.5 px-3 text-right">Fee Paid</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    No simulated orders executed yet in this session.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-cyan-400">{o.id}</td>
                    <td className="py-2 px-3 text-slate-400">{o.timestamp}</td>
                    <td
                      className={`py-2 px-3 font-semibold ${
                        o.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {o.side}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200 tabular-nums">{o.quantity}</td>
                    <td className="py-2 px-3 text-right text-slate-200 tabular-nums">€{o.fill_price?.toFixed(3)}</td>
                    <td className="py-2 px-3 text-right text-slate-400 tabular-nums">€{o.fee?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">{o.source || 'MANUAL'}</td>
                    <td className="py-2 px-3 text-emerald-400">{o.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
