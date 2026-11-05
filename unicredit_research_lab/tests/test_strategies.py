import unittest
import pandas as pd
from ucg_lab.strategies import generate_rule_signals


class StrategyTests(unittest.TestCase):
    def frame(self):
        return pd.DataFrame({'decision_time': pd.date_range('2024-01-02T08:05:00Z', periods=3, freq='5min'),
            'session_date': ['2024-01-02'] * 3, 'rvol_ready': [True, False, True], 'opening_range_ready': [True, True, False],
            'rvol': [2., 2., 2.], 'return_60m': [.01, .01, .01], 'return_5m': [-.001, -.001, .001],
            'vwap_distance': [.001,.001,.001], 'last_price': [102.,102.,102.], 'opening_range_high': [101.,101.,101.]})

    def test_rule_names_and_readiness(self):
        f = self.frame()
        self.assertEqual(list(generate_rule_signals(f, 'trend_pullback').score), [0.,0.,1.])
        self.assertEqual(list(generate_rule_signals(f, 'opening_breakout').score), [1.,0.,0.])
        f['vwap_distance'] = -.01
        self.assertEqual(list(generate_rule_signals(f, 'mean_reversion').score), [1.,0.,0.])

    def test_nan_inputs_do_not_signal_and_input_is_unchanged(self):
        f = self.frame()
        f.loc[0,'rvol'] = float('nan')
        before = f.copy(deep=True)
        result = generate_rule_signals(f, 'trend_pullback')
        self.assertEqual(result.score.iloc[0], 0.)
        pd.testing.assert_frame_equal(f,before)
        self.assertEqual(list(result.columns), ['decision_time','score'])

    def test_pullback_history_resets_by_session(self):
        f = self.frame()
        f.loc[2,'session_date'] = '2024-01-03'
        self.assertEqual(generate_rule_signals(f, 'trend_pullback').score.sum(), 0.)

    def test_rule_rejects_unsorted_decisions_and_infinite_features(self):
        f = self.frame().iloc[::-1]
        with self.assertRaisesRegex(ValueError, 'chronolog|sort'):
            generate_rule_signals(f, 'trend_pullback')
        f = self.frame()
        f.loc[0,'rvol'] = float('inf')
        with self.assertRaisesRegex(ValueError, 'finite|infinite'):
            generate_rule_signals(f, 'opening_breakout')

    def test_explicit_threshold_and_unknown_rule(self):
        self.assertEqual(generate_rule_signals(self.frame(), 'opening_breakout', {'min_rvol':3.}).score.sum(), 0.)
        with self.assertRaises(ValueError):
            generate_rule_signals(self.frame(), 'unknown')


if __name__ == '__main__':
    unittest.main()
