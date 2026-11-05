# Task B implementation review

Implemented `ucg_lab/strategies.py`, `ucg_lab/backtest.py`, `tests/test_strategies.py`, and `tests/test_backtest.py`. No broker adapter, credentials, network request, Git index operation, or commit was added. Other task-owned files were not edited.

## Rule hypotheses

These thresholds are illustrative and unproven. They were fixed with the coordinating agent before implementation, rather than selected from performance.

- `trend_pullback`: valid relative-volume history, rvol >= 1.2, 60-minute return > 0, VWAP distance >= 0, current completed 5-minute return > 0, immediately previous completed return <= 0 within the same session.
- `opening_breakout`: valid relative-volume history and completed opening range, rvol >= 1.5, price strictly above opening-range high. Optional nonnegative breakout buffer defaults to zero.
- `mean_reversion`: valid relative-volume history, rvol >= 1, VWAP distance <= -0.005, completed 5-minute return < 0.

`RULE_DEFAULTS` documents all exposed thresholds. Unknown rule or parameter names, infinite required numerical inputs, and unsorted or duplicated decision timestamps fail explicitly. NaN unavailable inputs do not generate signals. Inputs are not mutated.

## Timeline and financial semantics

Canonical raw minutes are interval starts. A decision at 08:05 with latency one minute can first enter at 08:06. Decisions available at a raw minute open are processed before actions at that open; a later false decision cancels a pending entry. A persistent true signal produces one opportunity; false re-arms it. Opportunities while holding, under the daily brake, or during cooldown are consumed rather than queued. State resets each session.

Open actions prioritize predetermined final-minute liquidation, pending exits, gap stops, and fixed holding exits before entries. No exit/re-entry occurs on one minute. Intrabar stop touches are assessed after open actions, including a newly opened position. Stop level is executed entry price times one minus stop percentage. A gap stop references the lower of raw open and stop level before friction. A touch with zero volume queues the next positive-volume open and cannot invent a fill at the old stop level.

Whole-share entry notional is limited by allocation times current equity, and total notional plus commission must fit cash. Commission is the larger of minimum fee and proportional fee. Trade `net_return` uses entry notional plus entry fee as its denominator. Daily equity includes every supplied session, even with no trades. The daily brake observes net liquidation equity at raw minute opens and realized exits; it latches for the rest of the session and blocks new entries, without forcing a close.

Bar mode charges half configured round-trip spread plus slippage per side. Quote mode uses ask for entry and bid for ordinary exit plus side slippage, with no additional synthetic spread. Quote stops disclose an OHLC execution proxy event. No fill occurs at zero volume. A position that cannot close by the final minute raises instead of silently carrying overnight.

Labels independently use initial cash and allocation, the same delay/cost/share rules, and a full fixed holding interval within the supplied session. They ignore stops, daily brakes, cooldown and shortened end-of-day exits. A zero-volume observation delays a label's fill, rather than establishing a fill. Unavailable labels are omitted with a fixed empty schema. They are future outcomes only, never feature columns.

## Verification evidence

Test-first evidence: the initial suite failed because implementation modules were absent; interface skeletons then failed with explicit `NotImplementedError` for every tested behavior. Implementation made the financial/rule checks pass. A further causal-rule regression failed on missing chronological validation before its fix. Additional execution cases passed as regression coverage of already implemented contract behavior.

Fresh task-owned tests: 30 backtest/label tests and 5 strategy tests passed in the latest full run. The exact tests are listed below.

Backtest and labels:

- test_bar_proxy_spread_and_slippage_applied_per_side
- test_commission_uses_larger_of_minimum_or_rate
- test_cooldown_consumes_episode_without_stale_later_fill
- test_daily_brake_blocks_later_episode
- test_entry_allocation_excludes_fee_but_total_must_fit_cash
- test_episode_while_open_does_not_queue
- test_exit_prevents_reentry_on_same_bar
- test_final_minute_open_exit_and_no_new_entry
- test_gap_stop_uses_gap_open_not_stop_level
- test_hand_derived_fees_whole_shares_and_delayed_open
- test_input_frames_are_not_mutated_and_events_json_serializable
- test_intrabar_stop_uses_stop_reference
- test_later_false_cancels_pending_entry
- test_no_closing_liquidity_raises_instead_of_overnight_position
- test_no_trade_session_in_equity_and_fixed_empty_schema
- test_persistent_signal_one_episode_then_false_rearms
- test_quote_mode_requires_paired_quotes
- test_quote_spread_is_not_double_counted
- test_quote_stop_discloses_ohlc_proxy
- test_score_equality_is_false_and_rearms_episode
- test_session_reset_allows_next_day_true_and_daily_equity_includes_both
- test_stop_touched_without_volume_waits_for_actual_next_open
- test_unaffordable_single_share_does_not_create_position
- test_unfilled_entry_does_not_carry_to_next_session
- test_zero_volume_entry_and_exit_skip_to_valid_minute
- test_label_cannot_take_next_session_open_as_exit
- test_label_ignores_stop_and_zero_volume_uses_actual_fill_time
- test_label_zero_volume_exit_waits_and_does_not_fabricate_final_fill
- test_labels_do_not_shorten_holding_at_session_end
- test_labels_match_fixed_costed_trade_and_never_span_sessions

Rules:

- test_explicit_threshold_and_unknown_rule
- test_nan_inputs_do_not_signal_and_input_is_unchanged
- test_pullback_history_resets_by_session
- test_rule_names_and_readiness
- test_rule_rejects_unsorted_decisions_and_infinite_features

Full available-suite command: `python -m unittest discover -s tests -v`.

- First integrated run: 86 tests, one non-owned error, `test_data.DataTests.test_event_identifiers_preserve_leading_zero_and_na_strings`, raising `ValueError: news: empty event_id`. Task A subsequently fixed this; it passed on the next run.
- Latest integrated run during parallel build: 89 tests, two non-owned import errors: `test_reporting` (`ucg_lab.reporting` not yet present) and `test_workflow` (`ucg_lab.workflow` not yet present). All 35 task-owned tests passed. These are reported explicitly; this report does not claim the entire project suite was green at that time.
- `git diff --check` returned exit zero. The initial repository files were untracked, so this check alone does not validate their content.

No repository virtual environment existed when work began; the available runtime Python 3.12 was used. CLI and full synthetic workflow verification belong to root's ongoing integration because those modules were not yet present on the latest full-suite run.

## Limits and remaining integration

This is a deterministic bar approximation. Positive volume is an availability gate, not a position-capacity or participation model. There is no depth, queue, partial-fill, market-impact, auction, borrow, tax, settlement or broker model. OHLC cannot reveal actual intrabar order or guarantee stop execution, and a daily loss brake cannot cap gap or intrabar loss. Snapshot quotes do not establish executable depth. Illiquid final-minute positions fail the run rather than fabricating a flat account.

Initial rule defaults, fees and risk limits are research assumptions. No real UCG data or profitability claim was established. Labels deliberately differ from the actual simulator's stop/brake/EOD policy. Root must merge them as targets and purge boundaries as contracted. All output remains research/paper only, with no real-order path.

## Review round 1 — exhausted-account correction

Addressed finding B1 from `docs/reviews/task-b-review.md` with two new literal financial regressions, written and run before the fix:

- `test_exhausted_account_retains_zero_equity_on_later_sessions`: EUR 100 initial cash buys one share for EUR 97 and pays EUR 3 entry commission. The following gap exits at EUR 3 and pays EUR 3 exit commission. The trade loses EUR 100, day-one equity is zero and daily return is -1. A supplied second no-trade session and third session with a new true signal retain equity zero, daily return zero and no new purchases. Before the fix this reproduced `ZeroDivisionError` on the second session. After the fix equity is `[0,0,0]`, daily returns `[-1,0,0]`, net P&L `[-100,0,0]` and trade counts `[1,0,0]`.
- `test_exit_fee_liability_exceeding_equity_raises_insolvency_error`: the same EUR 97 plus EUR 3 entry followed by EUR 2 proceeds and EUR 3 exit fee leaves EUR -1 liability. Before the fix the simulator returned negative cash without a controlled boundary. It now raises `ValueError` explaining that exit fee liability exceeds account equity, including timestamp, exit fee and closing equity. No debt is forgiven or capital restarted. A debt-account model is outside the current simulator.

Zero-equity sessions emit JSON-safe `account_exhausted` events. Their zero daily-return values are an explicit convention for unchanged, already exhausted equity; the entire 100% loss remains on the prior session. Canonical input validation still runs for all supplied sessions before replay, including after exhaustion.

Verification after this correction:

- `python -m unittest discover -s tests -p 'test_backtest.py' -v`: all 32 passed.
- `python -m unittest discover -s tests -v`: 105 tests ran during parallel review fixes; all Task B tests passed. Three non-owned Task C failures were visible and reported to root: `test_inference_diagnostics_full_sample_blocks_and_tail_resolution` and `test_review_fixture_invalid_inference_cannot_promote_real_candidate` raised `KeyError: 'inference_valid'`; `test_missing_or_invalid_inference_diagnostics_fail_closed` saw `PAPER_CANDIDATE` where `RESEARCH_ONLY` was expected. Root-owned workflow tests passed but emitted pandas `FutureWarning` at `workflow.py:102` about concatenating empty/all-NA frames. This is not a claim that the full suite was green at this point.

Only owned `ucg_lab/backtest.py`, `tests/test_backtest.py` and this report changed in this correction. No commit, Git index mutation or subagent was used.
