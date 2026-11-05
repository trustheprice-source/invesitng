"""Causal numerical model and historical-neighbor regression tests."""
import importlib.util
import unittest

import numpy as np
import pandas as pd

from ucg_lab.models import fit_predict_model, walk_forward_splits, find_analogs


def training(n=40):
    times = pd.date_range('2024-01-01', periods=n, freq='D', tz='UTC')
    return pd.DataFrame({'decision_time': times, 'label_end': times + pd.Timedelta(hours=1),
                         'session_date': times.strftime('%Y-%m-%d'), 'x': np.arange(n, dtype=float),
                         'missing': np.nan, 'target_return': np.arange(n, dtype=float) * .001})


class ModelTests(unittest.TestCase):
    def test_walk_forward_exact_windows_and_short_final_block(self):
        dates = ['2024-01-%02d' % d for d in range(1, 9)]
        self.assertEqual(walk_forward_splits(dates, 3, 2),
                         [(dates[:3], dates[3:5]), (dates[2:5], dates[5:7]), (dates[4:7], dates[7:])])
        for bad in [dates[::-1], dates + [dates[-1]]]:
            with self.assertRaises(ValueError):
                walk_forward_splits(bad, 3, 2)
        with self.assertRaises(ValueError):
            walk_forward_splits(dates, 0, 2)
        self.assertEqual(walk_forward_splits(dates[:3], 3, 2), [])

    def test_purge_outcomes_at_boundary_and_train_scaling(self):
        train = training()
        test = pd.DataFrame({'decision_time': pd.to_datetime(['2024-03-01'], utc=True),
                             'x': [20.0], 'missing': [np.nan]})
        baseline = fit_predict_model(train, test, ['x', 'missing'])
        # Poison a row whose outcome finishes exactly at evaluation start.
        poison = train.iloc[[-1]].copy()
        poison['label_end'] = test.decision_time.iloc[0]
        poison['target_return'] = 1e9
        poison['x'] = -1e9
        np.testing.assert_allclose(fit_predict_model(pd.concat([train, poison]), test, ['x', 'missing']), baseline)
        # A second test point cannot alter train-fitted preprocessing of the first.
        test2 = pd.concat([test, test.assign(x=1e12)], ignore_index=True)
        np.testing.assert_allclose(fit_predict_model(train, test2, ['x', 'missing'])[0], baseline[0])
        self.assertAlmostEqual(float(baseline[0]), .0199, places=7)
        pd.testing.assert_frame_equal(train, training())

    def test_imputation_uses_training_median(self):
        train = training()
        test = pd.DataFrame({'decision_time': pd.to_datetime(['2024-03-01', '2024-03-02'], utc=True),
                             'x': [np.nan, 19.5]})
        predictions = fit_predict_model(train, test, ['x'])
        self.assertAlmostEqual(float(predictions[0]), .0195)
        self.assertAlmostEqual(float(predictions[1]), .0195)

    def test_purge_applies_before_minimum_sample_count_and_no_targets_as_features(self):
        train = training(31)
        test = pd.DataFrame({'decision_time': pd.to_datetime(['2024-01-30'], utc=True), 'x': [1.]})
        with self.assertRaisesRegex(ValueError, '30'):
            fit_predict_model(train, test, ['x'])
        test['decision_time'] = pd.to_datetime(['2024-03-01'], utc=True)
        test['target_return'] = 1.
        with self.assertRaises(ValueError):
            fit_predict_model(train, test, ['x', 'target_return'])

    def test_training_minimum_infinite_features_and_empty_test(self):
        train = training()
        test = pd.DataFrame({'decision_time': pd.to_datetime(['2024-03-01'], utc=True), 'x': [1.]})
        with self.assertRaisesRegex(ValueError, '30'):
            fit_predict_model(train.iloc[:29], test, ['x'])
        for target in ['train', 'test']:
            a, b = train.copy(), test.copy()
            if target == 'train':
                a.loc[0, 'x'] = np.inf
            else:
                b.loc[0, 'x'] = np.inf
            with self.assertRaises(ValueError):
                fit_predict_model(a, b, ['x'])
        with self.assertRaises(ValueError):
            fit_predict_model(train, test.iloc[:0], ['x'])
        with self.assertRaises(ValueError):
            fit_predict_model(train, test, ['x'], model_name='invented')

    @unittest.skipIf(importlib.util.find_spec('lightgbm') is not None, 'LightGBM installed')
    def test_lightgbm_absence_is_explicit(self):
        train = training()
        test = pd.DataFrame({'decision_time': pd.to_datetime(['2024-03-01'], utc=True), 'x': [1.]})
        with self.assertRaisesRegex(ImportError, 'LightGBM'):
            fit_predict_model(train, test, ['x'], 'lightgbm')

    def test_analogs_only_completed_history_one_per_session_no_winner_filter(self):
        train = training(6)
        train['session_date'] = ['2024-01-01', '2024-01-01', '2024-01-03',
                                 '2024-01-04', '2024-01-05', '2024-01-06']
        train['x'] = [0., .1, 2., 3., 0., 0.]
        train['target_return'] = [-.2, .9, -.1, .1, 99., 99.]
        query = pd.Series({'decision_time': pd.Timestamp('2024-01-05', tz='UTC'), 'x': 0.})
        train.loc[3, 'label_end'] = query.decision_time  # excluded at equality
        found = find_analogs(train, query, ['x'], max_cases=10)
        self.assertEqual([r['target_return'] for r in found], [-.2, -.1])
        self.assertEqual([r['session_date'] for r in found], ['2024-01-01', '2024-01-03'])
        self.assertEqual(found[0]['distance'], 0.)
        import json
        json.dumps(found, allow_nan=False)

    def test_analogs_future_values_cannot_change_distance(self):
        train = training(6)
        query = pd.Series({'decision_time': pd.Timestamp('2024-01-05', tz='UTC'), 'x': 1.5})
        original = find_analogs(train, query, ['x'])
        train.loc[5, 'x'] = 1e12
        self.assertEqual(find_analogs(train, query, ['x']), original)
        self.assertEqual(find_analogs(train.iloc[:0], query, ['x']), [])


if __name__ == '__main__':
    unittest.main()
