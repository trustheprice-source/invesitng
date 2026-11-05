import fs from 'fs';
import path from 'path';

export interface PaperDaemonState {
  daemon_enabled: boolean;
  is_running: boolean;
  emergency_stop: boolean;
  cash: number;
  initial_capital: number;
  position: {
    symbol: string;
    shares: number;
    average_entry: number;
    entry_time: string;
    stop_price: number;
    target_exit_time: string;
    entry_fee: number;
  } | null;
  realized_pnl: number;
  unrealized_pnl: number;
  total_fees_paid: number;
  completed_trades_count: number;
  daily_start_equity: number;
  daily_loss_brake_latched: boolean;
  current_session_date: string;
  last_poll_time: string | null;
  last_provider_timestamp: string | null;
  last_provider_price: number;
  feed_status: 'CONNECTED' | 'STALE' | 'DISCONNECTED' | 'MARKET_CLOSED';
  is_market_open: boolean;
  active_candidate_id: string;
  holding_minutes: number;
  allocation_fraction: number;
  commission_rate: number;
  minimum_commission: number;
  round_trip_spread_bps: number;
  slippage_bps_per_side: number;
  daily_loss_limit_pct: number;
  stop_loss_pct: number;
  last_reconciliation_ok: boolean;
  equity: number;
}

export interface JournalEvent {
  id: string;
  timestamp: string; // Server UTC time of recording
  provider_timestamp?: string; // Provider feed timestamp
  event_type:
    | 'DAEMON_INIT'
    | 'FEED_TICK'
    | 'SIGNAL_EVALUATED'
    | 'ORDER_SCHEDULED'
    | 'ORDER_FILLED'
    | 'ORDER_REJECTED'
    | 'POSITION_CLOSED'
    | 'DAILY_BRAKE_LATCHED'
    | 'EMERGENCY_STOP'
    | 'MARKET_STATUS_CHANGE'
    | 'RECONCILIATION_CHECK';
  details: string;
  price?: number;
  shares?: number;
  fee?: number;
  cash?: number;
  equity?: number;
}

export class PaperTradingDaemon {
  private dataDir: string;
  private stateFile: string;
  private journalFile: string;
  private state: PaperDaemonState;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private pendingOrder: {
    scheduled_for_time: number;
    candidate_id: string;
    intended_shares: number;
    signal_score: number;
    signal_time: string;
  } | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.stateFile = path.join(dataDir, 'paper_trading_state.json');
    this.journalFile = path.join(dataDir, 'paper_journal.jsonl');
    this.state = this.loadState();
  }

  private loadState(): PaperDaemonState {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.stateFile)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
        return loaded;
      } catch {
        // Fallback to default
      }
    }

    const defaultState: PaperDaemonState = {
      daemon_enabled: true,
      is_running: false,
      emergency_stop: false,
      cash: 10000.0,
      initial_capital: 10000.0,
      position: null,
      realized_pnl: 0,
      unrealized_pnl: 0,
      total_fees_paid: 0,
      completed_trades_count: 0,
      daily_start_equity: 10000.0,
      daily_loss_brake_latched: false,
      current_session_date: new Date().toISOString().substring(0, 10),
      last_poll_time: null,
      last_provider_timestamp: null,
      last_provider_price: 77.18,
      feed_status: 'CONNECTED',
      is_market_open: false,
      active_candidate_id: 'pullback_v1',
      holding_minutes: 30,
      allocation_fraction: 0.25,
      commission_rate: 0.0005,
      minimum_commission: 3.0,
      round_trip_spread_bps: 10.0,
      slippage_bps_per_side: 2.0,
      daily_loss_limit_pct: 0.02,
      stop_loss_pct: 0.01,
      last_reconciliation_ok: true,
      equity: 10000.0,
    };

    this.saveState(defaultState);
    return defaultState;
  }

  private saveState(state: PaperDaemonState) {
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
  }

  public appendJournal(event: Omit<JournalEvent, 'id' | 'timestamp'>) {
    const fullEvent: JournalEvent = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...event,
      cash: Math.round(this.state.cash * 100) / 100,
      equity: Math.round(this.state.equity * 100) / 100,
    };

    fs.appendFileSync(this.journalFile, JSON.stringify(fullEvent) + '\n');
  }

  public getState(): PaperDaemonState {
    return this.state;
  }

  public getJournal(limit = 100): JournalEvent[] {
    if (!fs.existsSync(this.journalFile)) return [];
    try {
      const lines = fs.readFileSync(this.journalFile, 'utf-8').trim().split('\n').filter(Boolean);
      const events: JournalEvent[] = lines.slice(-limit).map((l) => JSON.parse(l));
      return events.reverse();
    } catch {
      return [];
    }
  }

  // Check Euronext Milan trading hours (09:00 - 17:30 Rome time, Mon-Fri)
  public checkMarketHours(nowDate = new Date()): { isOpen: boolean; sessionDate: string; minuteOfDay: number; minutesToClose: number } {
    const romeTimeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    }).formatToParts(nowDate);

    const weekday = romeTimeParts.find((p) => p.type === 'weekday')?.value;
    const hours = parseInt(romeTimeParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minutes = parseInt(romeTimeParts.find((p) => p.type === 'minute')?.value || '0', 10);
    const sessionDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(nowDate);

    const isWeekend = weekday === 'Sat' || weekday === 'Sun';
    const minuteOfDay = (hours - 9) * 60 + minutes; // 0 at 09:00 CET
    const isOpen = !isWeekend && minuteOfDay >= 0 && minuteOfDay < 510; // 510 minutes = 17:30 CET
    const minutesToClose = isOpen ? 510 - minuteOfDay : 0;

    return { isOpen, sessionDate, minuteOfDay, minutesToClose };
  }

  // Ingest Market Tick / Bar
  public async ingestTick(providerData: {
    symbol: string;
    price: number;
    provider_timestamp?: string;
    volume?: number;
    vwap?: number;
    rvol?: number;
    sector_spread_15m?: number;
  }) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = providerData.provider_timestamp ? new Date(providerData.provider_timestamp) : new Date();
      const { isOpen, sessionDate, minuteOfDay } = this.checkMarketHours(now);

      // Session rollover detection
      if (sessionDate !== this.state.current_session_date) {
        this.state.current_session_date = sessionDate;
        this.state.daily_start_equity = this.state.equity;
        this.state.daily_loss_brake_latched = false;
        this.appendJournal({
          event_type: 'MARKET_STATUS_CHANGE',
          details: `Session rollover to ${sessionDate}. Daily loss brake reset. Starting equity: €${this.state.daily_start_equity.toFixed(2)}`,
        });
      }

      this.state.is_market_open = isOpen;
      this.state.feed_status = isOpen ? 'CONNECTED' : 'MARKET_CLOSED';
      this.state.last_poll_time = now.toISOString();
      this.state.last_provider_timestamp = providerData.provider_timestamp || now.toISOString();
      this.state.last_provider_price = providerData.price;

      // 1. Position Marking and Exit Evaluation
      if (this.state.position) {
        const friction = (this.state.round_trip_spread_bps / 2 + this.state.slippage_bps_per_side) / 10000;
        const currentBid = providerData.price * (1 - friction);
        const unrealized = (currentBid - this.state.position.average_entry) * this.state.position.shares;
        this.state.unrealized_pnl = Math.round(unrealized * 100) / 100;

        let exitReason: string | null = null;
        let exitPrice = currentBid;

        // A. Stop loss check
        if (providerData.price <= this.state.position.stop_price) {
          exitReason = 'STOP_LOSS';
          exitPrice = Math.min(providerData.price, this.state.position.stop_price) * (1 - friction);
        }
        // B. Scheduled Holding Period exit
        else if (new Date(this.state.position.target_exit_time).getTime() <= now.getTime()) {
          exitReason = 'HOLDING_PERIOD_EXPIRATION';
        }
        // C. End of session mandatory exit (17:25 CET, 5m before 17:30 closing auction)
        else if (minuteOfDay >= 505) {
          exitReason = 'SCHEDULED_EOD_LIQUIDATION';
        }
        // D. Emergency stop
        else if (this.state.emergency_stop) {
          exitReason = 'EMERGENCY_STOP_TRIGGERED';
        }

        if (exitReason) {
          this.closePosition(exitPrice, exitReason, providerData.provider_timestamp);
        }
      } else {
        this.state.unrealized_pnl = 0;
      }

      // 2. Pending Order Execution (1-minute latency arrival)
      if (this.pendingOrder && now.getTime() >= this.pendingOrder.scheduled_for_time) {
        if (
          !this.state.position &&
          !this.state.daily_loss_brake_latched &&
          !this.state.emergency_stop &&
          this.state.is_market_open
        ) {
          this.executeScheduledOrder(providerData.price, providerData.provider_timestamp);
        } else {
          this.appendJournal({
            event_type: 'ORDER_REJECTED',
            provider_timestamp: providerData.provider_timestamp,
            details: `Pending order cancelled: position_open=${!!this.state.position}, brake=${this.state.daily_loss_brake_latched}, emergency=${this.state.emergency_stop}, market_open=${this.state.is_market_open}`,
          });
        }
        this.pendingOrder = null;
      }

      // 3. Signal Creation (strictly causal, evaluated before future execution price)
      if (
        !this.state.position &&
        !this.pendingOrder &&
        !this.state.daily_loss_brake_latched &&
        !this.state.emergency_stop &&
        this.state.daemon_enabled &&
        this.state.is_market_open &&
        minuteOfDay >= 30 &&
        minuteOfDay <= 450
      ) {
        this.evaluateCausalSignal(providerData, now);
      }

      // 4. Mark to Market & Equity Reconciliation
      const friction = (this.state.round_trip_spread_bps / 2 + this.state.slippage_bps_per_side) / 10000;
      const currentBid = providerData.price * (1 - friction);
      const positionValue = this.state.position
        ? Math.round(this.state.position.shares * currentBid * 100) / 100
        : 0;

      this.state.equity = Math.round((this.state.cash + positionValue) * 100) / 100;

      // Check daily loss limit brake (2% of session start equity)
      const dailyDrop = (this.state.daily_start_equity - this.state.equity) / this.state.daily_start_equity;
      if (dailyDrop >= this.state.daily_loss_limit_pct && !this.state.daily_loss_brake_latched) {
        this.state.daily_loss_brake_latched = true;
        this.appendJournal({
          event_type: 'DAILY_BRAKE_LATCHED',
          details: `Daily loss limit of 2% breached (${(dailyDrop * 100).toFixed(2)}%). All new prospective entries latched until next session.`,
          equity: this.state.equity,
        });
      }

      // Reconciliation audit check
      const theoreticalEquity =
        this.state.initial_capital +
        this.state.realized_pnl +
        this.state.unrealized_pnl -
        this.state.total_fees_paid;

      const discrepancy = Math.abs(this.state.equity - theoreticalEquity);
      this.state.last_reconciliation_ok = discrepancy <= 0.10;

      this.saveState(this.state);
    } finally {
      this.isProcessing = false;
    }
  }

  private evaluateCausalSignal(
    providerData: { price: number; vwap?: number; rvol?: number; provider_timestamp?: string; sector_spread_15m?: number },
    evalTime: Date
  ) {
    const vwap = providerData.vwap || providerData.price;
    const rvol = providerData.rvol || 1.0;

    let qualifies = false;
    let score = 0.0;
    let reason = '';

    // Strategy qualification based on active candidate
    if (this.state.active_candidate_id === 'pullback_v1') {
      if (providerData.price > vwap && rvol >= 1.25) {
        qualifies = true;
        score = 0.85;
        reason = `Price (€${providerData.price}) > VWAP (€${vwap.toFixed(3)}) with RVOL ${rvol.toFixed(2)} >= 1.25`;
      }
    } else if (this.state.active_candidate_id === 'mean_reversion_v1') {
      const vwapDev = (providerData.price - vwap) / vwap;
      if (vwapDev < -0.007 && rvol >= 1.3) {
        qualifies = true;
        score = 0.78;
        reason = `Oversold deviation ${(vwapDev * 100).toFixed(2)}% < -0.70% with RVOL ${rvol.toFixed(2)} >= 1.3`;
      }
    } else if (this.state.active_candidate_id === 'sector_lead_lag_v1' || this.state.active_candidate_id === 'exp1_sector_lag_catchup') {
      const sectorSpread = providerData.sector_spread_15m !== undefined ? providerData.sector_spread_15m : -0.0035;
      if (sectorSpread <= -0.0035 && rvol >= 1.2) {
        qualifies = true;
        score = 0.92;
        reason = `Sector spread ${(sectorSpread * 10000).toFixed(0)} bps <= -35 bps with RVOL ${rvol.toFixed(2)} >= 1.2 (Lead-Lag Catch-Up)`;
      }
    }


    // Record signal evaluation event BEFORE scheduling execution
    this.appendJournal({
      event_type: 'SIGNAL_EVALUATED',
      provider_timestamp: providerData.provider_timestamp,
      details: `Candidate [${this.state.active_candidate_id}] signal evaluation: score=${score.toFixed(2)}, qualifies=${qualifies}. ${reason || 'Condition not met.'}`,
      price: providerData.price,
    });

    if (qualifies) {
      // Schedule execution with 1-minute latency
      const targetNotional = this.state.cash * this.state.allocation_fraction;
      const estQty = Math.floor(targetNotional / providerData.price);

      if (estQty > 0) {
        this.pendingOrder = {
          scheduled_for_time: evalTime.getTime() + 60 * 1000, // +60s
          candidate_id: this.state.active_candidate_id,
          intended_shares: estQty,
          signal_score: score,
          signal_time: evalTime.toISOString(),
        };

        this.appendJournal({
          event_type: 'ORDER_SCHEDULED',
          provider_timestamp: providerData.provider_timestamp,
          details: `Virtual BUY scheduled: ${estQty} shares for candidate ${this.state.active_candidate_id}. Execution locked at next minute tick (t + 1m).`,
          shares: estQty,
          price: providerData.price,
        });
      }
    }
  }

  private executeScheduledOrder(currentPrice: number, providerTimestamp?: string) {
    if (!this.pendingOrder) return;

    const friction = (this.state.round_trip_spread_bps / 2 + this.state.slippage_bps_per_side) / 10000;
    const fillPrice = Math.round(currentPrice * (1 + friction) * 1000) / 1000;
    const targetNotional = this.state.cash * this.state.allocation_fraction;
    const quantity = Math.floor(targetNotional / fillPrice);

    if (quantity <= 0) {
      this.appendJournal({
        event_type: 'ORDER_REJECTED',
        provider_timestamp: providerTimestamp,
        details: 'Insufficient cash to purchase at least 1 whole share.',
      });
      return;
    }

    const notional = quantity * fillPrice;
    const fee = Math.round(Math.max(this.state.minimum_commission, notional * this.state.commission_rate) * 100) / 100;

    if (this.state.cash < notional + fee) {
      this.appendJournal({
        event_type: 'ORDER_REJECTED',
        provider_timestamp: providerTimestamp,
        details: `Cash balance (€${this.state.cash.toFixed(2)}) insufficient for notional + fee (€${(notional + fee).toFixed(2)}).`,
      });
      return;
    }

    // Debit cash, record position
    this.state.cash = Math.round((this.state.cash - notional - fee) * 100) / 100;
    this.state.total_fees_paid = Math.round((this.state.total_fees_paid + fee) * 100) / 100;

    const entryTime = providerTimestamp ? new Date(providerTimestamp) : new Date();
    const targetExitTime = new Date(entryTime.getTime() + this.state.holding_minutes * 60 * 1000);
    const stopPrice = Math.round(fillPrice * (1 - this.state.stop_loss_pct) * 1000) / 1000;

    this.state.position = {
      symbol: 'UCG.MI',
      shares: quantity,
      average_entry: fillPrice,
      entry_time: entryTime.toISOString(),
      stop_price: stopPrice,
      target_exit_time: targetExitTime.toISOString(),
      entry_fee: fee,
    };

    const currentBid = currentPrice * (1 - friction);
    const initialUnrealized = (currentBid - fillPrice) * quantity;
    this.state.unrealized_pnl = Math.round(initialUnrealized * 100) / 100;

    this.appendJournal({
      event_type: 'ORDER_FILLED',
      provider_timestamp: providerTimestamp,
      details: `Prospective BUY filled: ${quantity} shares @ €${fillPrice.toFixed(3)} (Fee: €${fee.toFixed(2)}, Stop: €${stopPrice.toFixed(3)}, Holding: ${this.state.holding_minutes}m)`,
      shares: quantity,
      price: fillPrice,
      fee,
    });
  }

  private closePosition(rawExitPrice: number, reason: string, providerTimestamp?: string) {
    if (!this.state.position) return;

    const friction = (this.state.round_trip_spread_bps / 2 + this.state.slippage_bps_per_side) / 10000;
    const exitPrice = Math.round(rawExitPrice * (1 - friction) * 1000) / 1000;
    const exitNotional = this.state.position.shares * exitPrice;
    const exitFee = Math.round(Math.max(this.state.minimum_commission, exitNotional * this.state.commission_rate) * 100) / 100;

    const entryNotional = this.state.position.shares * this.state.position.average_entry;
    const grossPnl = Math.round((exitNotional - entryNotional) * 100) / 100;
    const totalTradeFees = Math.round((this.state.position.entry_fee + exitFee) * 100) / 100;
    const netPnl = Math.round((grossPnl - totalTradeFees) * 100) / 100;

    this.state.cash = Math.round((this.state.cash + exitNotional - exitFee) * 100) / 100;
    this.state.realized_pnl = Math.round((this.state.realized_pnl + netPnl) * 100) / 100;
    this.state.total_fees_paid = Math.round((this.state.total_fees_paid + exitFee) * 100) / 100;
    this.state.completed_trades_count += 1;
    this.state.unrealized_pnl = 0;

    this.appendJournal({
      event_type: 'POSITION_CLOSED',
      provider_timestamp: providerTimestamp,
      details: `Prospective position closed (${reason}): ${this.state.position.shares} shares @ €${exitPrice.toFixed(3)}. Gross PnL: €${grossPnl.toFixed(2)}, Net PnL: €${netPnl.toFixed(2)} (Exit Fee: €${exitFee.toFixed(2)})`,
      price: exitPrice,
      shares: this.state.position.shares,
      fee: exitFee,
    });

    this.state.position = null;
  }

  // Emergency stop trigger
  public triggerEmergencyStop() {
    this.state.emergency_stop = true;
    this.pendingOrder = null;
    if (this.state.position) {
      this.closePosition(this.state.last_provider_price, 'MANUAL_EMERGENCY_STOP');
    }
    this.appendJournal({
      event_type: 'EMERGENCY_STOP',
      details: 'Persistent Emergency Stop triggered by risk administrator. Trading halted.',
    });
    this.saveState(this.state);
  }

  public resetEmergencyStop() {
    this.state.emergency_stop = false;
    this.state.daily_loss_brake_latched = false;
    this.appendJournal({
      event_type: 'MARKET_STATUS_CHANGE',
      details: 'Emergency stop and daily brake manually reset by risk administrator.',
    });
    this.saveState(this.state);
  }

  public setActiveCandidate(candidateId: string, holdingMinutes = 60, allocationFraction = 0.25) {
    this.state.active_candidate_id = candidateId;
    this.state.holding_minutes = holdingMinutes;
    this.state.allocation_fraction = allocationFraction;
    this.saveState(this.state);
    this.appendJournal({
      event_type: 'MARKET_STATUS_CHANGE',
      details: `Active strategy candidate updated to [${candidateId}] (holding: ${holdingMinutes}m, allocation: ${(allocationFraction * 100).toFixed(0)}%).`,
    });
  }

  // Start autonomous background loop polling every intervalMs
  public startBackgroundLoop(intervalMs = 5000) {
    if (this.timer) clearInterval(this.timer);
    this.state.is_running = true;
    this.saveState(this.state);

    this.appendJournal({
      event_type: 'DAEMON_INIT',
      details: `Autonomous paper trading daemon initialized. Polling interval: ${intervalMs}ms. Symbol: UCG.MI.`,
    });

    this.timer = setInterval(async () => {
      // In a real environment, this fetches the latest quote or parses cached tick
      try {
        const { isOpen } = this.checkMarketHours();
        // Read latest price from cache or mock tick
        const price = this.state.last_provider_price;
        await this.ingestTick({
          symbol: 'UCG.MI',
          price,
          provider_timestamp: new Date().toISOString(),
          volume: 5000,
          vwap: price * 0.999,
          rvol: 1.1,
        });
      } catch (err: any) {
        console.error('Daemon tick error:', err);
      }
    }, intervalMs);
  }

  public stopBackgroundLoop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.is_running = false;
    this.saveState(this.state);
  }
}
