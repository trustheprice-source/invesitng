"""Literal financial examples and honest evidence-gate regression tests."""
import json
import unittest
import numpy as np
import pandas as pd
from ucg_lab.validation import block_bootstrap_mean_ci, summarize_performance, assess_evidence


class BootstrapTests(unittest.TestCase):
    def test_constant_series_and_deterministic_circular_blocks(self):
        result = block_bootstrap_mean_ci([.02] * 8, 3, 100, .05, 17)
        self.assertAlmostEqual(result['mean'], .02)
        self.assertAlmostEqual(result['lower'], .02)
        self.assertAlmostEqual(result['upper'], .02)
        # Every 4-observation circular block includes the complete sample.
        result = block_bootstrap_mean_ci([0., 1., 2., 3.], 4, 100, .05, 17)
        self.assertEqual(result['lower'], 1.5)
        self.assertEqual(result['upper'], 1.5)
        a = block_bootstrap_mean_ci([-.1, .2, .3, -.2], 2, 400, .1, 9)
        self.assertEqual(a, block_bootstrap_mean_ci([-.1, .2, .3, -.2], 2, 400, .1, 9))
        self.assertIn('circular', a['method'].lower())
        json.dumps(a, allow_nan=False)

    def test_partial_circular_blocks_wrap_at_last_observation(self):
        # Seed zero selects starts 3 and 2; [4,1,2,3] after truncation.
        result = block_bootstrap_mean_ci([1., 2., 3., 4.], 3, 1, .05, 0)
        self.assertEqual(result['lower'], 2.5)
        self.assertEqual(result['upper'], 2.5)

    def test_inference_diagnostics_full_sample_blocks_and_tail_resolution(self):
        for block_length in (4, 5):
            result = block_bootstrap_mean_ci([-.05, .06, -.05, .06], block_length, 400, .05)
            self.assertFalse(result['inference_valid'])
            self.assertIn('block_length_not_less_than_observations', result['inference_failures'])
            self.assertEqual(result['expected_samples_per_tail'], 10.)
        low_resolution = block_bootstrap_mean_ci([-.05, .06] * 30, 5, 399, .05)
        self.assertFalse(low_resolution['inference_valid'])
        self.assertIn('insufficient_bootstrap_tail_samples', low_resolution['inference_failures'])
        valid_boundary = block_bootstrap_mean_ci([-.05, .06] * 30, 5, 400, .05)
        self.assertTrue(valid_boundary['inference_valid'])
        self.assertEqual(valid_boundary['inference_failures'], [])
        self.assertEqual(valid_boundary['expected_samples_per_tail'], 10.)
        json.dumps(valid_boundary, allow_nan=False)
        # Constant observations can yield a zero-width interval without the
        # known full-sample-block design defect. Do not invent variation.
        constant = block_bootstrap_mean_ci([.02] * 60, 5, 400, .05)
        self.assertTrue(constant['inference_valid'])
        self.assertAlmostEqual(constant['lower'], constant['upper'])

    def test_invalid_inputs_fail(self):
        for values in [[], [np.inf], [np.nan]]:
            with self.assertRaises(ValueError):
                block_bootstrap_mean_ci(values)
        for options in [{'block_length': 0}, {'n_bootstrap': 0}, {'alpha': 1}, {'alpha': 0}]:
            with self.assertRaises(ValueError):
                block_bootstrap_mean_ci([0.], **options)


class PerformanceTests(unittest.TestCase):
    def test_initial_loss_drawdown_compounding_and_activity_include_zeros(self):
        equity = pd.DataFrame({'session_date': ['2024-01-01', '2024-01-02', '2024-01-08', '2024-01-09'],
            'equity': [90., 90., 99., 99.], 'daily_return': [-.1, 0., .1, 0.],
            'net_pnl': [-10., 0., 9., 0.], 'trade_count': [1, 0, 1, 0]})
        trades = pd.DataFrame({'net_pnl': [-10., 9.], 'net_return': [-.1, .1],
                               'entry_fee': [.5, .5], 'exit_fee': [.5, .5]})
        result = summarize_performance(equity, trades,
            {'initial_cash': 100., 'bootstrap_samples': 200, 'family_size': 5, 'alpha': .05})
        self.assertAlmostEqual(result['max_drawdown'], .1)
        self.assertAlmostEqual(result['net_return'], -.01)
        self.assertAlmostEqual(result['worst_week'], -.1)
        self.assertEqual(result['active_day_fraction'], .5)
        self.assertEqual(result['active_week_fraction'], 1.)
        self.assertEqual(result['longest_no_trade_sessions'], 1)
        self.assertEqual(result['total_fees'], 2.)
        self.assertEqual(result['total_net_pnl'], -1.)
        self.assertAlmostEqual(result['profit_factor'], .9)
        self.assertEqual(result['bootstrap_ci']['alpha'], .01)
        self.assertEqual(result['bootstrap_ci']['n_observations'], 4)
        self.assertEqual(result['evaluation_sessions'], 4)
        json.dumps(result, allow_nan=False)

    def test_zero_trade_weeks_and_longest_idle_period(self):
        equity = pd.DataFrame({'session_date': ['2024-01-01', '2024-01-02', '2024-01-08', '2024-01-15'],
            'equity': [100.] * 4, 'daily_return': [0.] * 4, 'net_pnl': [0.] * 4, 'trade_count': [1, 0, 0, 0]})
        result = summarize_performance(equity, pd.DataFrame(), {'initial_cash': 100., 'bootstrap_samples': 100})
        self.assertAlmostEqual(result['active_week_fraction'], 1/3)
        self.assertEqual(result['longest_no_trade_sessions'], 3)
        self.assertIsNone(result['profit_factor'])
        self.assertIsNone(result['win_rate'])
        self.assertIsNone(result['mean_trade_net_return'])
        json.dumps(result, allow_nan=False)

    def test_entirely_inactive_period_keeps_all_sessions_and_weeks(self):
        equity = pd.DataFrame({'session_date': ['2024-01-01', '2024-01-02', '2024-01-08'],
            'equity': [100.] * 3, 'daily_return': [0.] * 3, 'net_pnl': [0.] * 3, 'trade_count': [0] * 3})
        result = summarize_performance(equity, pd.DataFrame(), {'initial_cash': 100., 'bootstrap_samples': 100})
        self.assertEqual(result['active_week_fraction'], 0.)
        self.assertEqual(result['active_day_fraction'], 0.)
        self.assertEqual(result['longest_no_trade_sessions'], 3)
        self.assertEqual(result['evaluation_weeks'], 2)
        self.assertEqual(result['bootstrap_ci']['n_observations'], 3)

    def test_empty_and_bad_equity_raise(self):
        with self.assertRaises(ValueError):
            summarize_performance(pd.DataFrame(), pd.DataFrame())
        equity = pd.DataFrame({'session_date': ['2024-01-01'], 'equity': [np.inf],
            'daily_return': [0.], 'net_pnl': [0.], 'trade_count': [0]})
        with self.assertRaises(ValueError):
            summarize_performance(equity, pd.DataFrame())


class EvidenceTests(unittest.TestCase):
    def good_metrics(self):
        return {'evaluation_sessions': 100, 'trades': 50, 'active_week_fraction': .8,
                'max_drawdown': .02, 'net_return': .1, 'mean_daily_return': .001,
                'bootstrap_ci': {'lower': .0001, 'inference_valid': True, 'inference_failures': []},
                'inference_valid': True, 'inference_failures': []}

    def test_synthetic_never_qualifies_and_live_is_always_false(self):
        self.assertEqual(assess_evidence(self.good_metrics(), 'synthetic', 'holdout', provenance_verified=True)['status'],
                         'SYNTHETIC_DEMO')
        cases = [('real', 'development', True, 'HISTORICAL_CANDIDATE'),
                 ('real', 'holdout', True, 'PAPER_CANDIDATE'),
                 ('real', 'holdout', False, 'RESEARCH_ONLY'),
                 ('synthetic', 'holdout', True, 'SYNTHETIC_DEMO')]
        for kind, phase, provenance, status in cases:
            result = assess_evidence(self.good_metrics(), kind, phase, provenance_verified=provenance)
            self.assertEqual(result['status'], status)
            self.assertIs(result['eligible_for_live'], False)
            self.assertTrue(result['caveats'])
            json.dumps(result, allow_nan=False)

    def test_review_fixture_invalid_inference_cannot_promote_real_candidate(self):
        returns = np.array([-.05, .06] * 30)
        dates = pd.bdate_range('2024-01-01', periods=60).strftime('%Y-%m-%d')
        balances = 10000. * np.cumprod(1 + returns)
        pnls = np.diff(np.r_[10000., balances])
        equity = pd.DataFrame({'session_date': dates, 'equity': balances,
            'daily_return': returns, 'net_pnl': pnls, 'trade_count': 1})
        trades = pd.DataFrame({'net_pnl': pnls, 'net_return': returns,
                               'entry_fee': 0., 'exit_fee': 0.})
        for block_length in (60, 61):
            for samples in (200, 5000):
                metrics = summarize_performance(equity, trades,
                    {'block_length': block_length, 'bootstrap_samples': samples})
                self.assertAlmostEqual(metrics['bootstrap_ci']['lower'], .005)
                self.assertAlmostEqual(metrics['net_return'], .232775846071273)
                self.assertFalse(metrics['inference_valid'])
                self.assertIn('block_length_not_less_than_observations', metrics['inference_failures'])
                for phase in ('development', 'holdout'):
                    evidence = assess_evidence(metrics, 'real', phase, provenance_verified=True)
                    self.assertEqual(evidence['status'], 'RESEARCH_ONLY')
                    self.assertIs(evidence['eligible_for_live'], False)
                    self.assertTrue(any('inference' in check for check in evidence['failed_checks']))
                self.assertEqual(assess_evidence(metrics, 'synthetic', 'holdout', provenance_verified=True)['status'],
                                 'SYNTHETIC_DEMO')
                json.dumps(metrics, allow_nan=False)
        low_resolution = summarize_performance(equity, trades, {'block_length': 5, 'bootstrap_samples': 200})
        self.assertFalse(low_resolution['inference_valid'])
        self.assertIn('insufficient_bootstrap_tail_samples', low_resolution['inference_failures'])
        self.assertEqual(assess_evidence(low_resolution, 'real', 'holdout', provenance_verified=True)['status'],
                         'RESEARCH_ONLY')
        valid = summarize_performance(equity, trades, {'block_length': 5, 'bootstrap_samples': 5000})
        self.assertTrue(valid['inference_valid'])
        self.assertGreaterEqual(valid['bootstrap_ci']['expected_samples_per_tail'], 10)
        self.assertEqual(valid, summarize_performance(equity, trades, {'block_length': 5, 'bootstrap_samples': 5000}))

    def test_missing_or_invalid_inference_diagnostics_fail_closed(self):
        for key in ('inference_valid', 'inference_failures'):
            metrics = self.good_metrics()
            metrics.pop(key)
            self.assertEqual(assess_evidence(metrics, 'real', 'holdout', provenance_verified=True)['status'],
                             'RESEARCH_ONLY')
            metrics = self.good_metrics()
            metrics['bootstrap_ci'].pop(key)
            self.assertEqual(assess_evidence(metrics, 'real', 'holdout', provenance_verified=True)['status'],
                             'RESEARCH_ONLY')
        metrics = self.good_metrics()
        metrics['bootstrap_ci']['inference_valid'] = False
        self.assertEqual(assess_evidence(metrics, 'real', 'holdout', provenance_verified=True)['status'], 'RESEARCH_ONLY')

    def test_numpy_criteria_produce_json_safe_diagnostics(self):
        result = assess_evidence(self.good_metrics(), 'real', 'holdout',
                                 {'min_trades': np.int64(30)}, provenance_verified=True)
        json.dumps(result, allow_nan=False)

    def test_ci_equality_insufficient_data_and_missing_metrics_fail_closed(self):
        metrics = self.good_metrics()
        metrics['bootstrap_ci']['lower'] = 0.
        result = assess_evidence(metrics, 'real', 'holdout', provenance_verified=True)
        self.assertEqual(result['status'], 'RESEARCH_ONLY')
        self.assertTrue(result['failed_checks'])
        self.assertEqual(assess_evidence({}, 'real', 'holdout', provenance_verified=True)['status'], 'RESEARCH_ONLY')
        metrics = self.good_metrics()
        metrics['trades'] = 2
        self.assertEqual(assess_evidence(metrics, 'real', 'holdout', provenance_verified=True)['status'], 'RESEARCH_ONLY')
        metrics = self.good_metrics()
        metrics['max_drawdown'] = np.nan
        self.assertEqual(assess_evidence(metrics, 'real', 'holdout', provenance_verified=True)['status'], 'RESEARCH_ONLY')


if __name__ == '__main__':
    unittest.main()
