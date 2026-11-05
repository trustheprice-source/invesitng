# UniCredit Research Lab: Quantitative Intraday Workstation (v0.2.0)

An institutional quantitative research and simulation workstation for UniCredit (`UCG.MI`) intraday equities. Combines responsive in-browser exploration with a **server-side Python-enforced holdout gate and SQLite ledger** to guarantee rigorous statistical validation. Features four core workspaces: Data Audit, Research & Backtesting, Holdout Gate, and Paper Terminal with an institutional dark terminal design.

***

## User Review & Critical Decisions

> [!IMPORTANT]
> **Key Architectural Mandates (Confirmed & Incorporated)**:
> - **Server-Enforced Holdout Gate**: Research and exploratory backtests execute with sub-50ms responsiveness, but **candidate freezing and final holdout evaluation are strictly executed and locked by the server-side Python backend** (`ucg_lab` execution engine and SQLite ledger). A browser-side record can be reset or cleared; the server's ledger guarantees tamper-resistant, one-shot out-of-sample evaluation.
> - **Four Core Workspaces**:
>   1. **Data Audit**: 1-minute CSV uploads, UTC timestamp validation, calendar completeness, volume anomaly detection, and source provenance hashes.
>   2. **Research & Backtesting**: Interactive 5-minute candlesticks, same-clock RVOL, VWAP, strategy rule comparisons (`trend_pullback`, `opening_breakout`, `mean_reversion`), Ridge regression, equity curves, transaction friction audit, and historical pattern analogs.
>   3. **Holdout Gate**: Server-governed candidate freeze, dataset-level out-of-sample protection, stationary block bootstrap confidence intervals with Bonferroni adjustment, and permanent lockouts against repeat testing.
>   4. **Paper Terminal**: Simulated quote book, manual/automated paper order routing, whole-share sizing, latency delays, execution ledger, and paper-only OpenClaw handoff payload generation.
> - **Anti-Overfitting & Guardrails**: Every demo run is explicitly tagged `SYNTHETIC_DEMO`, evidence state is strictly reported (`SYNTHETIC_DEMO`, `RESEARCH_ONLY`, `HISTORICAL_CANDIDATE`, `PAPER_CANDIDATE`), and `eligible_for_live: false` is permanently enforced.
> - **Institutional Dark Interface**: High-density Bloomberg/Refinitiv terminal aesthetic, tabular figures (`tabular-nums`), zero decorative clutter, and single-elevation layouts.

***

## 1. Overview & Core Concept

### What It Does
The **UniCredit Research Lab** is a full-stack quantitative workstation bridging institutional research rigor with modern interactive ergonomics:
- **Interactive Exploration**: Systematic researchers can inspect data profiles, adjust trade friction parameters (commissions, minimum ticket fees, spread, slippage, stop-loss, and daily loss brake), and instantly evaluate hypothesis strategies across development sessions.
- **Backend Statistical Verification**: When a researcher selects a viable strategy candidate, the application calls the server-side Python backend (`ucg_lab`) to record an immutable trial in a persistent SQLite ledger, freeze code/config/dataset hashes, and execute a **single, irreversible holdout test**. Repeated attempts to test the holdout period on the same study are strictly blocked by the backend.
- **Paper Execution Core**: Simulates realistic market microstructure fills with delayed execution, size limits, and generates validated JSON contracts for OpenClaw integration.

### Target Audience & Persona
Quantitative equity researchers, systematic portfolio managers, and risk engineers seeking to test whether genuine, repeatable intraday statistical edges exist in UniCredit shares after accounting for all real-world execution costs.

### Key Value
Prevents false discoveries and selection bias through strict causal data boundaries, realistic European market frictions, and server-enforced holdout protection.

***

## 2. User Experience & Visual Design

### Key User Flows

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  1. DATA AUDIT   │ ───► │ 2. RESEARCH LAB  │ ───► │ 3. HOLDOUT GATE  │ ───► │ 4. PAPER CORE    │
│ Upload / inspect │      │ Interactive test │      │ Server freeze &  │      │ Live simulated   │
│ 1-min UCG bars & │      │ of rules, ridge, │      │ one-shot Python  │      │ book, executions │
│ volume baselines │      │ equity & analogs │      │ holdout verdict  │      │ & OpenClaw export│
└──────────────────┘      └──────────────────┘      └──────────────────┘      └──────────────────┘
```

1. **Top Bar & Workspace Navigation**:
   - Strict 3-zone contract:
     - **Zone 1 (Brand)**: `UniCredit Research Lab` wordmark with `UCG.MI · Intraday v0.2.0` context.
     - **Zone 2 (Nav Links)**: Clean, single-line text links: `Data Audit`, `Research & Backtesting`, `Holdout Gate`, `Paper Terminal`.
     - **Zone 3 (Actions)**: Primary simulation button (`Run Backtest`) and quick export (`Download Research Bundle`).
2. **Data Audit Workspace**:
   - File dropzone supporting canonical CSVs (`bars.csv`, `sessions.csv`, `context.csv`, `news.csv`, `manifest.json`) or pre-loaded 180-session synthetic dataset.
   - Audit report cards: Timestamp monotonicity, missing minute intervals, OHLC consistency ($H \ge \max(O,C)$ and $L \le \min(O,C)$), finite values, and SHA-256 provenance hashes.
3. **Research & Backtesting Workspace**:
   - **Left Control Panel**: Strategy hypothesis selector (`trend_pullback`, `opening_breakout`, `mean_reversion`, `ridge_regression`), capital allocation fraction, stop-loss %, daily loss brake %, commission rate (€3 min fee), and slippage/spread settings.
   - **Main Chart Viewport**:
     - 5-minute candlestick chart with interactive crosshair, 30-minute opening range band, and approximate VWAP overlay.
     - Sub-chart: Completed bar volume paired with same-clock prior-session relative volume (`rvol`) baseline.
   - **Performance Tear Sheet**: Cumulative net equity curve, underwater drawdown chart (% from peak), trade win rate, profit factor, active day/week fraction, longest no-trade stretch, and historical pattern analogs modal.
4. **Holdout Gate Workspace (Server-Enforced)**:
   - Candidate registry displaying trial count, search budget (12 trials max), and candidate parameter signatures.
   - **Action: "Freeze Candidate & Evaluate Holdout"**: Transmits freeze request to the Python backend API (`/api/holdout/evaluate`).
   - If previously evaluated, the server rejects the request with HTTP 409 and returns the existing immutable verdict.
   - Displays final holdout tear sheet, dependent block bootstrap confidence interval (5,000 resamples, Bonferroni-adjusted $\alpha$), and explicit evidence badge (`SYNTHETIC_DEMO` / `HISTORICAL_CANDIDATE`).
5. **Paper Terminal Workspace**:
   - Order book quote simulator showing bid/ask depth, virtual cash balance, active positions, and real-time execution log.
   - Simulated order submission with 1-minute execution delay and display size enforcement.
   - One-click OpenClaw JSON handoff generator matching `paper_handoff.schema.json`.

### Visual Identity & Theme

- **Aesthetic Direction**: Institutional dark financial terminal. High data density, flat single-elevation surfaces, hairline dividers, zero decorative clutter or floating pill badges.
- **Color Tokens**:
  - Neutral Canvas (60%): `#090D16` (Deep Obsidian Void) and `#0F172A` (Terminal Slate).
  - Structural Surfaces (30%): `#111827` (Card Field), `#1F2937` (Dividers & Table Headers), `#374151` (Hairline Borders).
  - High-Intent Accents (10%):
    - Primary Cyan: `#06B6D4` / `#0EA5E9` (Active navigation, focus borders, chart crosshairs).
    - Profit Green: `#10B981` (Positive P&L, passing checks, buy fills).
    - Loss / Alert Amber & Red: `#F59E0B` (Risk brake active, warning caveats) and `#EF4444` (Stop-loss hit, drawdown, failed checks).
- **Typography**:
  - Headings: `Plus Jakarta Sans` (SemiBold / Bold, tight tracking).
  - Body Prose: `Plus Jakarta Sans` (13px–15px).
  - Telemetry & Financials: `JetBrains Mono` / `font-mono tabular-nums` strictly for all numeric metrics, prices, dates, timestamps, P&L, and quantities.

***

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Hybrid Client Simulation + Server-Authoritative Holdout Enforcement
- **Chosen Approach**:
  - **In-Browser Engine**: Runs interactive backtesting on development periods for immediate researcher feedback during parameter tuning.
  - **Server-Side Python Engine & SQLite Ledger**: Holds the authoritative copy of dataset manifests, locks candidate configurations into `study.db`, executes `ucg_lab.workflow.evaluate_holdout` using Python, and seals the result.
- **Why**: Protects statistical integrity. In a client-only architecture, any user could clear cache or edit code in devtools to re-run holdout tests repeatedly until an anomalous positive result appears. The server ledger prevents multiple holdout evaluations for a study.
- **Trade-off**: Requires a lightweight Express backend proxy (`server.ts`) that executes Python commands or calls the `ucg_lab` module via IPC/REST.

### Decision 2: Realistic European Equity Microstructure Friction Model
- **Chosen Approach**: Model whole shares only, minimum ticket commission (€3.00 or 0.05%), 10 bps round-trip spread, 2 bps slippage per side, 1-minute latency before bar execution, intrabar stop-loss approximation at $\min(\text{Open}, \text{Stop})$, and an intraday loss brake (-2% of starting session equity).
- **Why**: European banking shares have real-world friction. Friction-free backtests routinely display illusionary alpha that evaporates in live execution.

### Decision 3: Explicit Evidence Grading & Synthetic Watermark
- **Chosen Approach**: Prominently display `SYNTHETIC_DEMO` across all headers, reports, and JSON exports whenever synthetic data is utilized. Explicitly declare `eligible_for_live: false` in all states.
- **Why**: Complies with the ethical research constitution of `PROJECT.md` and `AGENTS.md`. Prevents accidental conflation of simulated demonstration data with verified real-world market proof.

***

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UNICREDIT RESEARCH LAB                          │
│               Institutional Dark Terminal (Desktop 1440px)             │
├────────────────────────────────────────────────────────────────────────┤
│  Top Bar: [Brand: UCG Lab] ── [Audit | Research | Holdout | Paper] ── [Run Backtest] │
├────────────────────────────┬───────────────────────────────────────────┤
│    INTERACTIVE CONTROLS    │           WORKSTATION VIEWPORT            │
│  - Data Profile Selector   │  ┌─────────────────────────────────────┐  │
│    (180-day Synthetic /    │  │ Interactive Candlestick & RVOL View │  │
│     Custom CSV Upload)     │  │ (5-min bars, VWAP, Opening Range)   │  │
│  - Strategy Hypotheses     │  └─────────────────────────────────────┘  │
│    (Pullback, Breakout,    │  ┌──────────────────┬──────────────────┐  │
│     Mean Rev, Ridge)       │  │ Cumulative Net   │ Underwater DD %  │  │
│  - Execution Parameters    │  │ Equity Curve     │ Curve            │  │
│    (Cash, fees, spread,    │  └──────────────────┴──────────────────┘  │
│     stops, brakes)         │  ┌─────────────────────────────────────┐  │
│  - Server Freeze & Holdout │  │ Performance Tear Sheet (Bootstrap   │  │
│    Action Gate             │  │ 95% CI, Sharpe, Win Rate, Stretches)│  │
│                            │  └─────────────────────────────────────┘  │
│                            │  ┌─────────────────────────────────────┐  │
│                            │  │ Trade Execution Ledger & Audit Log  │  │
│                            │  └─────────────────────────────────────┘  │
└────────────────────────────┴───────────────────────────────────────────┘
                                   │
                                   ▼ HTTP REST / IPC
┌────────────────────────────────────────────────────────────────────────┐
│               FULL-STACK SERVER (server.ts / Node.js)                  │
├────────────────────────────────────────────────────────────────────────┤
│  - /api/audit: Data verification & SHA-256 hashing                     │
│  - /api/research/run: Server-side reference run validator              │
│  - /api/holdout/freeze: Immutably freeze candidate in study registry   │
│  - /api/holdout/evaluate: ONE-SHOT Python holdout evaluation runner    │
│  - /api/paper/order: Simulated paper broker order processing           │
│  - /api/bundle/export: Packaged ZIP generator for Codex local handoff   │
├────────────────────────────────────────────────────────────────────────┤
│                       PYTHON ENGINE (ucg_lab)                          │
│  - SQLite Ledger (study.db): Tracks trials, candidate freezes & hashes │
│  - Python Backtester & Bootstrap CI Engine (scipy / numpy / pandas)    │
│  - One-shot Holdout Evaluator with anti-tamper lock                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Mapping & State Stores

1. **Server-Side Engine (`server.ts` & Python bridge)**:
   - Sets up Express backend on port 3000 mounting Vite middleware.
   - Unpacks the local `unicredit_research_lab` package in the workspace.
   - Provides `/api/status`, `/api/audit`, `/api/holdout/freeze`, `/api/holdout/evaluate`, and `/api/export-bundle` endpoints.
   - Executes `python -m ucg_lab` CLI/functions to record immutable candidate freeze state in SQLite and evaluate holdout only once.
2. **Client-Side Quant Engine (`src/engine/`)**:
   - `dataStore.ts`: Loads synthetic data (or user CSVs), parses 1-minute bars into completed 5-minute intervals.
   - `features.ts`: Same-clock relative volume (`rvol`), 30-minute opening range high/low, VWAP approximation, and momentum.
   - `strategies.ts`: Evaluates `trend_pullback`, `opening_breakout`, `mean_reversion`, and `ridge_regression`.
   - `backtest.ts`: Chronological portfolio simulator enforcing delay, whole shares, minimum commissions, spread, slippage, intrabar stops, and daily brakes.
   - `statistics.ts`: Dependent block bootstrap calculations for rapid development tear sheets.
   - `paperCore.ts`: Quote feed simulator and OpenClaw handoff payload generator.
3. **Workstation Views (`src/components/`)**:
   - `TopBar.tsx`: Complies with strict 3-zone contract.
   - `AuditView.tsx`: CSV validator, calendar missing-minute checker, volume inspector, and hash audit.
   - `ResearchView.tsx`: Interactive candlestick + volume chart, cumulative equity & drawdown visualizers, trade ledger, and historical pattern analogs.
   - `HoldoutView.tsx`: Freeze gate status, server freeze action button, holdout tear sheet, bootstrap CI interval visualization, and evidence grade badge.
   - `PaperTerminalView.tsx`: Live simulated book, virtual portfolio balances, order entry tickets, and OpenClaw JSON handoff exporter.
   - `ConfigDrawer.tsx`: Friction adjustments (broker commissions, spread, slippage, stop-loss, daily brake).

### Verification & Testing Plan
- Execute Python test suite (`python -m unittest discover -s tests -v`) to confirm 126 tests pass.
- Verify that repeated calls to the holdout gate endpoint are rejected by the server ledger.
- Verify interactive browser backtests respond in $<50\text{ms}$ upon parameter modifications.
- Test bundle download capability delivering the complete `unicredit_research_lab` package.
- Ensure strict TypeScript compilation and lint verification (`compile_applet` and `lint_applet`).
