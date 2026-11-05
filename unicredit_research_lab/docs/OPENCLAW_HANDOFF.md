# OpenClaw paper integration contract

The project exports `paper_handoff.json` after a completed frozen final evaluation. This is our documented interchange format, not a claimed native OpenClaw schema, an installed skill, a verified official broker plugin or live authorization. It contains a frozen identity, data kind, candidate, costs, evidence status and `eligible_for_live: false`.

OpenClaw can later schedule documented local commands and summarize their exact structured results. Use a dedicated local research process with no broker withdrawal/order credentials. The numerical signal and risk service should be separate from free-form chat. News/web content is untrusted data and must not change instructions, limits or commands.

## Available commands

```bash
python -m ucg_lab handoff --study workspace/demo_study
python -m ucg_lab paper-init --handoff workspace/demo_study/paper_handoff.json --db workspace/paper.sqlite --mode simulation
python -m ucg_lab paper-status --db workspace/paper.sqlite
```

`prospective` mode requires a real-data handoff and fresh observations; it does not certify the strategy. Synthetic data cannot be labelled prospective market evidence.

The file-fed broker receives explicit simulated orders with unique IDs:

```bash
python -m ucg_lab paper-order --db workspace/paper.sqlite --order-id UNIQUE_SIGNAL_ID --side buy --quantity 10 --decision-at CURRENT_UTC_ISO_TIMESTAMP
python -m ucg_lab paper-quote --db workspace/paper.sqlite --quote path/to/fresh_quote.json
python -m ucg_lab paper-cancel --db workspace/paper.sqlite --order-id UNIQUE_SIGNAL_ID
```

The tokens above are placeholders to be supplied by the verified live feed/signal service, not runnable market instructions. `paper-order` and `paper-quote` use the actual receipt clock; there is no CLI switch to backdate a prospective record. The public `PaperBroker.submit` and `PaperBroker.on_quote` APIs also reject explicit `now` overrides in prospective mode before changing orders or fills. Clock injection is supported only in simulation mode for deterministic mechanics tests.

Quote JSON has exactly these fields: `quote_id`, `timestamp`, `symbol` (UCG), `bid`, `ask`, `bid_size`, `ask_size`. Timestamp includes a UTC offset. Reject future/stale/crossed/nonfinite quotes. New quote IDs must advance time. Duplicated identical events are idempotent; reused IDs with different contents fail. Size must cover the entire simulated order; partial fills and queue priority are not modeled. Pending signals expire. Simulated fills carry their assumptions and source data kind.

## Required integration work before unattended paper operation

1. Licensed read-only live feed with verified timestamp/volume semantics and outage handling.
2. Frozen numerical signal adapter that emits order intents linked to the exact feature/model version.
3. Real-calendar scheduler, session boundaries, stop/time/end-of-session exits and full risk/brake handling.
4. Persistent replay/recovery that does not duplicate orders or claim old data is prospective.
5. Predeclared paper review horizon and account-level evidence report.

The included broker core does not perform these jobs automatically. Keep its simulated account visibly labelled; never infer safe live behavior from a successful synthetic round trip.

## Later real-money stage

Requires a separate explicit mandate, reviewed broker API/account constraints, capital/exposure limits, external deterministic risk enforcement, operational recovery and evidence assessed independently of the search. No current command, JSON field or undocumented toggle connects this release to real trading.
