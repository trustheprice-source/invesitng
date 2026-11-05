# UNICREDIT RESEARCH LAB — PAPER TRADING STATUS
**Subsystem:** Autonomous Virtual Trading Daemon & Paper Terminal  
**Market:** UniCredit S.p.A. (`UCG.MI`, MTAA, Euronext Milan)  
**Price Baseline:** Real-World 2026 Regime (€77.18) | **Virtual Capital:** €10,000.00  
**Status:** DAEMON ACTIVE & LOGGING | **OpenClaw Export:** LOCKED (Pending Qualifying Model)  
**Live Execution Mode:** Permanently Disabled (`eligible_for_live: false`)

---

## 1. Subsystem Architecture & Implementation

The Paper Terminal (`src/components/PaperTerminalView.tsx` & `server.ts`) operates an autonomous forward-testing engine that simulates live market interaction without financial risk:

```
[ Real Market Feed / Proxy ]
            │
            ▼
[ Causal Feature Extractor ]
            │
            ▼
[ Signal Evaluation Engine ] ──► [ Pre-Execution Signal Record ] (Recorded at t)
            │
            ▼
[ 1-Minute Latency Buffer ]  ──► (Enforces execution at t + 1m)
            │
            ▼
[ Virtual Order Router ]     ──► [ Slippage & Commission Engine ]
            │
            ▼
[ Persistent Audit Log ]     ──► `server_data/virtual_execution_log.json`
```

### Key Safety Architecture:
1. **Pre-Execution Signal Recording:** Signals are written to the audit log at the moment of evaluation ($t$) *before* subsequent prices at $t+1$ are observed, eliminating lookahead fills in paper mode.
2. **Deterministic 1-Minute Latency:** Orders cannot fill at the signal price; they queue for the subsequent 1-minute open bar.
3. **Price Regime Alignment:** Defaults to real-world €77.18 (with toggle to €10.50 synthetic regime for regression tests).
4. **Permanent Live Safety:** All order objects enforce `is_virtual: true` and `eligible_for_live: false`. The system contains no broker API keys or outbound exchange routing.

---

## 2. Prospective Event Log Audit

The server maintains a persistent JSON audit trail at `server_data/virtual_execution_log.json`.

Recent daemon activity log:
- **Daemon Status:** `RUNNING` (Polled every 5 seconds)
- **Active Price Feed:** Real-world Euronext Milan 5m bar stream / high-density tick proxy (€77.18 reference)
- **Virtual Cash Balance:** €10,000.00
- **Virtual Open Position:** 0 shares (Flat)
- **Active Orders:** None (All entry signals currently gated by `NO_QUALIFYING_STRATEGY` status)

---

## 3. OpenClaw Execution Contract Audit

The system includes a production-grade execution contract generator for future integration with the OpenClaw execution gateway (`src/engine/paperCore.ts`):

```json
{
  "contract_version": "1.0.0",
  "contract_type": "PAPER_EXECUTION_ONLY",
  "symbol": "UCG.MI",
  "isin": "IT0005239360",
  "exchange": "MTAA",
  "currency": "EUR",
  "eligible_for_live": false,
  "execution_rules": {
    "order_type": "MARKET_ON_OPEN_NEXT_BAR",
    "latency_allowance_ms": 60000,
    "max_slippage_bps": 5.0,
    "max_spread_bps": 15.0,
    "daily_loss_limit_pct": 0.02,
    "hard_stop_loss_pct": 0.01,
    "eod_mandatory_liquidation_time_cet": "17:25:00"
  },
  "safety_interlocks": {
    "kill_switch_active": false,
    "forbid_overnight_inventory": true,
    "enforce_italian_ftt_exemption": true
  }
}
```

### Formal OpenClaw Gate Status: `LOCKED: PENDING_QUALIFYING_STRATEGY`
In accordance with quantitative research governance:
- **Rule:** A strategy contract is only exportable to an execution gateway if the underlying strategy has successfully passed **both** the development criteria and the one-shot holdout validation gate.
- **Current State:** Because all current models produced negative net expectancy after transaction costs on real data, the OpenClaw export button remains locked with a descriptive diagnostic notice. Real capital is protected from automated deployment.

---

## 4. Current Paper Terminal Recommendations

1. Maintain the Paper Terminal daemon in continuous background polling mode to monitor live UCG spreads and volatility regimes.
2. Utilize the Terminal's manual and automated paper trade simulator to test prospective fill delays during live Euronext Milan operating hours (09:00–17:30 CET).
3. Do not attempt live broker integration until a model demonstrating positive net expectancy across multi-hour horizons is developed.
