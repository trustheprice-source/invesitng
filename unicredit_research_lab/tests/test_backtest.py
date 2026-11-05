"""Literal financial fixtures; no dependency on synthetic generator."""
import unittest
import pandas as pd
from ucg_lab.backtest import run_backtest, build_forward_labels, commission


def fixture(prices=None, minutes=20, date='2024-01-02'):
    start = pd.Timestamp(date + 'T08:00:00Z')
    prices = prices if prices is not None else [100.] * minutes
    bars = pd.DataFrame({'timestamp': pd.date_range(start, periods=len(prices), freq='min'),
                         'open': prices, 'high': prices, 'low': prices,
                         'close': prices, 'volume': 1000.})
    sessions = pd.DataFrame([{'session_date': date, 'open': start,
                              'close': start + pd.Timedelta(minutes=len(prices))}])
    return bars, sessions


def signals(*items):
    return pd.DataFrame({'decision_time': [pd.Timestamp('2024-01-02T08:00:00Z') + pd.Timedelta(minutes=m) for m, _ in items],
                         'score': [s for _, s in items]})


FREE = dict(initial_cash=1000., allocation_fraction=1., commission_rate=0.,
            minimum_commission=0., round_trip_spread_bps=0., slippage_bps_per_side=0.,
            latency_minutes=1, holding_minutes=2, stop_loss_pct=.5,
            daily_loss_limit_pct=.5, cooldown_minutes=0)


class BacktestTests(unittest.TestCase):
    def test_hand_derived_fees_whole_shares_and_delayed_open(self):
        bars, sessions = fixture([10.] * 7 + [11.] * 13)
        bars.loc[6, ['open','high','low','close']] = 10.
        cfg = dict(FREE, initial_cash=100., commission_rate=.01, minimum_commission=1., holding_minutes=1)
        result = run_backtest(bars, sessions, signals((5, 1)), cfg)
        trade = result.trades.iloc[0]
        self.assertEqual(trade.entry_time, bars.timestamp.iloc[6])
        self.assertEqual(trade.exit_time, bars.timestamp.iloc[7])
        self.assertEqual(trade.quantity, 9)
        self.assertEqual(trade.entry_fee, 1.)
        self.assertEqual(trade.exit_fee, 1.)
        self.assertEqual(trade.gross_pnl, 9.)
        self.assertEqual(trade.net_pnl, 7.)
        self.assertAlmostEqual(trade.net_return, 7 / 91)
        self.assertEqual(result.equity.iloc[0].equity, 107.)
        self.assertAlmostEqual(result.equity.iloc[0].daily_return, .07)

    def test_entry_allocation_excludes_fee_but_total_must_fit_cash(self):
        bars, sessions = fixture([10.] * 20)
        result = run_backtest(bars, sessions, signals((1, 1)), dict(FREE, initial_cash=100., allocation_fraction=.5, minimum_commission=3.))
        self.assertEqual(result.trades.iloc[0].quantity, 5)
        self.assertEqual(result.equity.iloc[0].equity, 94.)

    def test_persistent_signal_one_episode_then_false_rearms(self):
        bars, sessions = fixture()
        result = run_backtest(bars, sessions, signals((1,1), (4,1), (5,1), (6,0), (7,1)), FREE)
        self.assertEqual(list(result.trades.entry_time), [bars.timestamp.iloc[2], bars.timestamp.iloc[8]])

    def test_episode_while_open_does_not_queue(self):
        bars, sessions = fixture()
        result = run_backtest(bars, sessions, signals((1,1), (2,0), (3,1)), dict(FREE, holding_minutes=5))
        self.assertEqual(len(result.trades), 1)

    def test_later_false_cancels_pending_entry(self):
        bars, sessions = fixture()
        result = run_backtest(bars, sessions, signals((1,1), (2,0)), dict(FREE, latency_minutes=3))
        self.assertTrue(result.trades.empty)
        self.assertIn('pending_entry_cancelled', [e['type'] for e in result.events])

    def test_zero_volume_entry_and_exit_skip_to_valid_minute(self):
        bars, sessions = fixture()
        bars.loc[[2,5], 'volume'] = 0
        result = run_backtest(bars, sessions, signals((1,1)), FREE)
        self.assertEqual(result.trades.iloc[0].entry_time, bars.timestamp.iloc[3])
        self.assertEqual(result.trades.iloc[0].exit_time, bars.timestamp.iloc[6])

    def test_final_minute_open_exit_and_no_new_entry(self):
        bars, sessions = fixture(minutes=10)
        result = run_backtest(bars, sessions, signals((5,1)), dict(FREE, holding_minutes=30))
        self.assertEqual(result.trades.iloc[0].exit_time, bars.timestamp.iloc[9])
        self.assertEqual(result.trades.iloc[0].exit_reason, 'session_close')
        late = run_backtest(bars, sessions, signals((8,1)), FREE)
        self.assertTrue(late.trades.empty)

    def test_no_closing_liquidity_raises_instead_of_overnight_position(self):
        bars, sessions = fixture(minutes=10)
        bars.loc[9, 'volume'] = 0
        with self.assertRaisesRegex(ValueError, 'liquidat|clos|overnight'):
            run_backtest(bars, sessions, signals((5,1)), dict(FREE, holding_minutes=30))

    def test_quote_spread_is_not_double_counted(self):
        bars, sessions = fixture()
        bars['bid_open'], bars['ask_open'] = 99., 101.
        result = run_backtest(bars, sessions, signals((1,1)), dict(FREE, execution_mode='quote_snapshot', round_trip_spread_bps=500., slippage_bps_per_side=10.))
        t = result.trades.iloc[0]
        self.assertAlmostEqual(t.entry_price, 101.101)
        self.assertAlmostEqual(t.exit_price, 98.901)
        self.assertEqual(t.quantity, 9)

    def test_bar_proxy_spread_and_slippage_applied_per_side(self):
        bars, sessions = fixture()
        result = run_backtest(bars, sessions, signals((1,1)), dict(FREE, round_trip_spread_bps=10., slippage_bps_per_side=2.))
        self.assertAlmostEqual(result.trades.iloc[0].entry_price, 100.07)
        self.assertAlmostEqual(result.trades.iloc[0].exit_price, 99.93)

    def test_gap_stop_uses_gap_open_not_stop_level(self):
        bars, sessions = fixture([100.] * 3 + [90.] * 17)
        result = run_backtest(bars, sessions, signals((1,1)), dict(FREE, holding_minutes=10, stop_loss_pct=.02))
        t = result.trades.iloc[0]
        self.assertEqual(t.exit_price, 90.)
        self.assertEqual(t.exit_reason, 'stop_loss')
        self.assertEqual(t.net_pnl, -100.)

    def test_intrabar_stop_uses_stop_reference(self):
        bars, sessions = fixture()
        bars.loc[3, 'low'] = 97.
        result = run_backtest(bars, sessions, signals((1,1)), dict(FREE, holding_minutes=10, stop_loss_pct=.02))
        self.assertEqual(result.trades.iloc[0].exit_price, 98.)

    def test_daily_brake_blocks_later_episode(self):
        bars, sessions = fixture([100.] * 3 + [90.] * 17)
        result = run_backtest(bars, sessions, signals((1,1), (4,0), (5,1)), dict(FREE, holding_minutes=1, daily_loss_limit_pct=.05))
        self.assertEqual(len(result.trades), 1)
        self.assertIn('daily_loss_brake', [e['type'] for e in result.events])

    def test_exit_prevents_reentry_on_same_bar(self):
        bars, sessions = fixture()
        result = run_backtest(bars, sessions, signals((1,1), (2,0), (4,1)), dict(FREE, latency_minutes=0))
        self.assertEqual(len(result.trades), 2)
        self.assertEqual(result.trades.iloc[1].entry_time, bars.timestamp.iloc[4])
        blocked = run_backtest(bars, sessions, signals((1,1), (2,0), (3,1)), dict(FREE, latency_minutes=0))
        self.assertEqual(len(blocked.trades), 1)

    def test_no_trade_session_in_equity_and_fixed_empty_schema(self):
        bars, sessions = fixture()
        result = run_backtest(bars, sessions, signals((1,0)), FREE)
        self.assertEqual(len(result.equity), 1)
        self.assertEqual(result.equity.iloc[0].daily_return, 0.)
        self.assertIn('entry_fee', result.trades.columns)
        self.assertIn('net_return', result.trades.columns)

    def test_quote_mode_requires_paired_quotes(self):
        bars, sessions = fixture()
        with self.assertRaisesRegex(ValueError, 'quote|bid|ask'):
            run_backtest(bars, sessions, signals((1,1)), dict(FREE, execution_mode='quote_snapshot'))

    def test_session_reset_allows_next_day_true_and_daily_equity_includes_both(self):
        b1, s1 = fixture()
        b2, s2 = fixture(date='2024-01-03')
        sig = pd.DataFrame({'decision_time': [b1.timestamp.iloc[1], b2.timestamp.iloc[1]], 'score': [1.,1.]})
        result = run_backtest(pd.concat([b1,b2], ignore_index=True), pd.concat([s1,s2], ignore_index=True), sig, FREE)
        self.assertEqual(len(result.trades), 2)
        self.assertEqual(list(result.equity.trade_count), [1,1])
        self.assertEqual(result.trades.iloc[1].entry_time, b2.timestamp.iloc[2])

    def test_unfilled_entry_does_not_carry_to_next_session(self):
        b1, s1 = fixture()
        b2, s2 = fixture(date='2024-01-03')
        result = run_backtest(pd.concat([b1,b2], ignore_index=True), pd.concat([s1,s2], ignore_index=True), signals((19,1)), FREE)
        self.assertTrue(result.trades.empty)
        self.assertEqual(len(result.equity), 2)

    def test_stop_touched_without_volume_waits_for_actual_next_open(self):
        bars, sessions = fixture()
        bars.loc[3, ['open','high','low','close','volume']] = [100.,100.,97.,100.,0.]
        bars.loc[4, ['open','high','low','close']] = 101.
        result = run_backtest(bars, sessions, signals((1,1)), dict(FREE, stop_loss_pct=.02, holding_minutes=10))
        self.assertEqual(result.trades.iloc[0].exit_time, bars.timestamp.iloc[4])
        self.assertEqual(result.trades.iloc[0].exit_price, 101.)
        self.assertEqual(result.trades.iloc[0].exit_reason, 'stop_loss')

    def test_quote_stop_discloses_ohlc_proxy(self):
        bars, sessions = fixture()
        bars['bid_open'], bars['ask_open'] = 99.,101.
        bars.loc[3,'low'] = 95.
        result = run_backtest(bars, sessions, signals((1,1)), dict(FREE, execution_mode='quote_snapshot', stop_loss_pct=.02, holding_minutes=10))
        self.assertAlmostEqual(result.trades.iloc[0].exit_price, 98.98)
        self.assertIn('stop_execution_proxy', [e['type'] for e in result.events])

    def test_score_equality_is_false_and_rearms_episode(self):
        bars, sessions = fixture()
        result = run_backtest(bars, sessions, signals((1,1), (5,.5), (6,1)), dict(FREE, score_threshold=.5))
        self.assertEqual(len(result.trades), 2)
        result = run_backtest(bars, sessions, signals((1,.5)), dict(FREE, score_threshold=.5))
        self.assertTrue(result.trades.empty)

    def test_cooldown_consumes_episode_without_stale_later_fill(self):
        bars, sessions = fixture()
        result = run_backtest(bars, sessions, signals((1,1), (3,0), (5,1), (11,1)), dict(FREE, cooldown_minutes=5))
        self.assertEqual(len(result.trades), 1)
        self.assertIn('cooldown', [e.get('reason') for e in result.events])

    def test_input_frames_are_not_mutated_and_events_json_serializable(self):
        import json
        bars, sessions = fixture()
        sig = signals((1,1))
        originals = [f.copy(deep=True) for f in (bars,sessions,sig)]
        result = run_backtest(bars, sessions, sig, FREE)
        for original, actual in zip(originals, (bars,sessions,sig)):
            pd.testing.assert_frame_equal(original,actual)
        json.dumps(result.events, allow_nan=False)

    def test_unaffordable_single_share_does_not_create_position(self):
        bars, sessions = fixture()
        result = run_backtest(bars, sessions, signals((1,1)), dict(FREE, initial_cash=100., minimum_commission=3.))
        self.assertTrue(result.trades.empty)
        self.assertEqual(result.equity.iloc[0].equity, 100.)

    def test_exhausted_account_retains_zero_equity_on_later_sessions(self):
        # EUR 100 pays 97 + 3 to enter; gap exit receives 3 - 3 = 0.
        b1, s1 = fixture([97.,97.,97.,3.,3.])
        b2, s2 = fixture([3.] * 5, date='2024-01-03')
        b3, s3 = fixture([3.] * 5, date='2024-01-04')
        sig = pd.DataFrame({'decision_time': [b1.timestamp.iloc[1], b3.timestamp.iloc[1]], 'score': [1.,1.]})
        result = run_backtest(pd.concat([b1,b2,b3], ignore_index=True),
                              pd.concat([s1,s2,s3], ignore_index=True), sig,
                              dict(FREE, initial_cash=100., minimum_commission=3.,
                                   stop_loss_pct=.01, daily_loss_limit_pct=.02))
        self.assertEqual(len(result.trades), 1)
        trade = result.trades.iloc[0]
        self.assertEqual(trade.quantity, 1)
        self.assertEqual(trade.entry_price, 97.)
        self.assertEqual(trade.entry_fee, 3.)
        self.assertEqual(trade.exit_price, 3.)
        self.assertEqual(trade.exit_fee, 3.)
        self.assertEqual(trade.net_pnl, -100.)
        self.assertEqual(list(result.equity.equity), [0.,0.,0.])
        self.assertEqual(list(result.equity.daily_return), [-1.,0.,0.])
        self.assertEqual(list(result.equity.net_pnl), [-100.,0.,0.])
        self.assertEqual(list(result.equity.trade_count), [1,0,0])
        self.assertIn('account_exhausted', [e['type'] for e in result.events])

    def test_exit_fee_liability_exceeding_equity_raises_insolvency_error(self):
        # EUR 100 pays 97 + 3; sale returns 2 against a 3 fee: EUR -1.
        bars, sessions = fixture([97.,97.,97.,2.,2.])
        with self.assertRaisesRegex(ValueError, 'fee liability exceeds account equity'):
            run_backtest(bars, sessions, signals((1,1)),
                         dict(FREE, initial_cash=100., minimum_commission=3.,
                              stop_loss_pct=.01, daily_loss_limit_pct=.02))

    def test_commission_uses_larger_of_minimum_or_rate(self):
        self.assertEqual(commission(100., dict(commission_rate=.001, minimum_commission=3.)), 3.)
        self.assertEqual(commission(10000., dict(commission_rate=.001, minimum_commission=3.)), 10.)


class ForwardLabelTests(unittest.TestCase):
    def test_labels_match_fixed_costed_trade_and_never_span_sessions(self):
        bars, sessions = fixture([10.] * 7 + [11.] * 13)
        f = signals((5,1), (18,1)).drop(columns='score')
        labels = build_forward_labels(f, bars, sessions, dict(FREE, initial_cash=100., commission_rate=.01, minimum_commission=1., holding_minutes=1))
        self.assertEqual(len(labels), 1)
        self.assertEqual(labels.iloc[0].decision_time, f.decision_time.iloc[0])
        self.assertEqual(labels.iloc[0].label_end, bars.timestamp.iloc[7])
        self.assertAlmostEqual(labels.iloc[0].target_return, 7 / 91)

    def test_label_ignores_stop_and_zero_volume_uses_actual_fill_time(self):
        bars, sessions = fixture()
        bars.loc[2, 'volume'] = 0
        bars.loc[4, ['open','high','low','close']] = 90.
        labels = build_forward_labels(signals((1,1)), bars, sessions, dict(FREE, holding_minutes=1, stop_loss_pct=.01))
        self.assertEqual(labels.iloc[0].label_end, bars.timestamp.iloc[4])
        self.assertAlmostEqual(labels.iloc[0].target_return, -.1)

    def test_label_cannot_take_next_session_open_as_exit(self):
        b1, s1 = fixture(minutes=10)
        b2, s2 = fixture(minutes=10, date='2024-01-03')
        f = signals((7,1))
        labels = build_forward_labels(f, pd.concat([b1,b2], ignore_index=True), pd.concat([s1,s2], ignore_index=True), dict(FREE, holding_minutes=5))
        self.assertTrue(labels.empty)

    def test_label_zero_volume_exit_waits_and_does_not_fabricate_final_fill(self):
        bars, sessions = fixture(minutes=10)
        bars.loc[4,'volume'] = 0.
        labels = build_forward_labels(signals((1,1)), bars, sessions, FREE)
        self.assertEqual(labels.iloc[0].label_end, bars.timestamp.iloc[5])
        bars.loc[4:,'volume'] = 0.
        labels = build_forward_labels(signals((1,1)), bars, sessions, FREE)
        self.assertTrue(labels.empty)

    def test_labels_do_not_shorten_holding_at_session_end(self):
        bars, sessions = fixture(minutes=10)
        labels = build_forward_labels(signals((7,1)), bars, sessions, dict(FREE, holding_minutes=3))
        self.assertTrue(labels.empty)
        self.assertEqual(list(labels.columns), ['decision_time','target_return','label_end'])


if __name__ == '__main__':
    unittest.main()
