"""Regression coverage for the final review's financial and evidence boundaries."""

import contextlib
import copy
import importlib.metadata
import io
import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pandas as pd

from ucg_lab.cli import main
from ucg_lab.config import DEFAULT_CONFIG, validate_config
from ucg_lab.demo import create_demo
from ucg_lab.ledger import StudyLedger
from ucg_lab.paper import PaperBroker
from ucg_lab.workflow import (environment, export_handoff, freeze_candidate,
                              inspect_analogs, run_holdout, run_research)


class FinalConfigTests(unittest.TestCase):
    def test_integral_floats_are_rejected_in_every_integer_field(self):
        fields = {
            'features': ['bar_minutes', 'volume_lookback_sessions', 'min_volume_history_sessions',
                         'context_max_age_minutes'],
            'execution': ['latency_minutes', 'holding_minutes', 'cooldown_minutes'],
            'research': ['train_sessions', 'test_sessions', 'holdout_sessions', 'max_trials',
                         'bootstrap_samples', 'block_length', 'seed'],
            'criteria': ['min_evaluation_sessions', 'min_trades'],
        }
        for section, keys in fields.items():
            for key in keys:
                with self.subTest(field=f'{section}.{key}'):
                    config = copy.deepcopy(DEFAULT_CONFIG)
                    config[section][key] = float(config[section][key])
                    with self.assertRaises(ValueError):
                        validate_config(config)
        for value in (1.0, True):
            with self.subTest(schema_version=value):
                with self.assertRaises(ValueError):
                    validate_config({'schema_version': value})

    def test_stop_at_one_and_nonpositive_user_cash_are_rejected(self):
        for key, value in [('stop_loss_pct', 1), ('initial_cash', 0), ('initial_cash', -1)]:
            with self.subTest(key=key, value=value):
                with self.assertRaises(ValueError):
                    validate_config({'execution': {key: value}})
        self.assertEqual(validate_config({'execution': {'daily_loss_limit_pct': 1}})
                         ['execution']['daily_loss_limit_pct'], 1)


class FinalEnvironmentTests(unittest.TestCase):
    def test_numerical_versions_and_optional_absence_are_recorded(self):
        versions = {'scipy': 'scipy-test', 'joblib': 'joblib-test', 'threadpoolctl': 'threadpool-test'}

        def version(name):
            if name == 'lightgbm':
                raise importlib.metadata.PackageNotFoundError(name)
            return versions[name]

        with patch('importlib.metadata.version', side_effect=version):
            result = environment()
        for name, expected in versions.items():
            self.assertEqual(result.get(name), expected)
        self.assertEqual(result.get('lightgbm'), 'not_installed')


class FinalPaperTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.broker = PaperBroker(Path(self.temp.name) / 'paper.sqlite', {
            'mode': 'prospective', 'data_kind': 'real', 'frozen_hash': 'test', 'latency_seconds': 1})

    def test_prospective_submit_rejects_clock_override_without_order(self):
        before = self.broker.snapshot()
        with self.assertRaisesRegex(ValueError, 'clock|simulation'):
            self.broker.submit('replay', 'buy', 1, '2020-01-07T08:00:00Z',
                               now='2020-01-07T08:00:00Z')
        self.assertEqual(self.broker.snapshot(), before)
        self.assertEqual(before['orders'], [])
        self.assertEqual(before['fills'], [])

    def test_prospective_quote_rejects_clock_override_without_fill(self):
        decision = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        self.broker.submit('pending', 'buy', 1, decision)
        before = self.broker.snapshot()
        stamp = (datetime.fromisoformat(before['orders'][0]['eligible_at']) + timedelta(seconds=1)).isoformat()
        quote = {'quote_id': 'injected', 'timestamp': stamp, 'symbol': 'UCG',
                 'bid': 19.99, 'ask': 20., 'bid_size': 100, 'ask_size': 100}
        with self.assertRaisesRegex(ValueError, 'clock|simulation'):
            self.broker.on_quote(quote, now=stamp)
        self.assertEqual(self.broker.snapshot(), before)
        self.assertEqual(before['fills'], [])


class FinalLedgerTests(unittest.TestCase):
    def test_open_missing_registry_does_not_create_file_or_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'missing' / 'ledger.sqlite'
            with self.assertRaisesRegex(ValueError, 'registry|ledger'):
                StudyLedger(path)
            self.assertFalse(path.exists())
            self.assertFalse(path.parent.exists())

    def test_existing_empty_or_unrelated_database_is_not_initialized(self):
        with tempfile.TemporaryDirectory() as temporary:
            for unrelated in (False, True):
                with self.subTest(unrelated=unrelated):
                    path = Path(temporary) / f'{unrelated}.sqlite'
                    with sqlite3.connect(path) as db:
                        if unrelated:
                            db.execute('CREATE TABLE unrelated (value TEXT)')
                    before = path.read_bytes()
                    with self.assertRaisesRegex(ValueError, 'schema|registry|ledger'):
                        StudyLedger(path)
                    self.assertEqual(path.read_bytes(), before)


    def test_registry_removed_after_open_is_not_recreated_by_later_read(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'ledger.sqlite'
            ledger = StudyLedger(path, create=True)
            ledger.claim_holdout('period', 'frozen')
            path.unlink()
            with self.assertRaisesRegex(ValueError, 'registry|ledger'):
                ledger.holdouts()
            self.assertFalse(path.exists())

    def test_explicit_creation_cannot_overwrite_an_existing_registry(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'ledger.sqlite'
            ledger = StudyLedger(path, create=True)
            ledger.claim_holdout('period', 'frozen')
            before = path.read_bytes()
            with self.assertRaises(FileExistsError):
                StudyLedger(path, create=True)
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(StudyLedger(path).holdouts()[0]['period_key'], 'period')


class FinalWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = create_demo(self.root / 'data', sessions=14)
        config = copy.deepcopy(DEFAULT_CONFIG)
        config['features'].update(volume_lookback_sessions=3, min_volume_history_sessions=2)
        config['research'].update(train_sessions=4, test_sessions=2, holdout_sessions=3, bootstrap_samples=200)
        config['candidates'] = [config['candidates'][3]]
        self.config_path = self.root / 'config.json'
        self.config_path.write_text(json.dumps(config))
        self.study = self.root / 'study'

    def test_numeric_dependency_changes_block_resume_freeze_and_holdout_before_claim(self):
        versions = {name: 'test-baseline' for name in ('scipy', 'joblib', 'threadpoolctl', 'lightgbm')}
        with patch('importlib.metadata.version', side_effect=versions.__getitem__):
            run_research(self.manifest, self.config_path, self.study)
            original_trials = StudyLedger(self.study / 'ledger.sqlite').trials()
            for name in versions:
                changed = {**versions, name: 'test-changed'}
                with self.subTest(stage='development', dependency=name):
                    with patch('importlib.metadata.version', side_effect=changed.__getitem__):
                        with self.assertRaisesRegex(ValueError, '[Ee]nvironment'):
                            run_research(self.manifest, self.config_path, self.study)
                        with self.assertRaisesRegex(ValueError, '[Ee]nvironment'):
                            freeze_candidate(self.study, 'ridge_v1')
                    self.assertFalse((self.study / 'frozen.json').exists())
                    self.assertEqual(StudyLedger(self.study / 'ledger.sqlite').trials(), original_trials)
                    self.assertEqual(StudyLedger(self.study / 'ledger.sqlite').holdouts(), [])
            frozen = freeze_candidate(self.study, 'ridge_v1')
            frozen_bytes = frozen.read_bytes()
            for name in versions:
                changed = {**versions, name: 'test-changed'}
                with self.subTest(stage='holdout', dependency=name):
                    with patch('importlib.metadata.version', side_effect=changed.__getitem__):
                        with self.assertRaisesRegex(ValueError, '[Ee]nvironment'):
                            run_holdout(self.study)
                    self.assertEqual(StudyLedger(self.study / 'ledger.sqlite').holdouts(), [])
                    self.assertEqual(frozen.read_bytes(), frozen_bytes)

    def test_missing_completed_registry_blocks_every_existing_study_path_without_writes(self):
        run_research(self.manifest, self.config_path, self.study)
        freeze_candidate(self.study, 'ridge_v1')
        run_holdout(self.study)
        registry = self.study / 'ledger.sqlite'
        registry.unlink()
        before = {p.relative_to(self.study): p.read_bytes() for p in self.study.rglob('*') if p.is_file()}
        operations = {
            'holdout': lambda: run_holdout(self.study),
            'resume': lambda: run_research(self.manifest, self.config_path, self.study),
            'freeze': lambda: freeze_candidate(self.study, 'ridge_v1'),
            'handoff': lambda: export_handoff(self.study),
            'analogs': lambda: inspect_analogs(self.study),
        }
        for name, operation in operations.items():
            with self.subTest(operation=name):
                with self.assertRaisesRegex(ValueError, 'registry|ledger'):
                    operation()
                self.assertFalse(registry.exists())
                self.assertEqual({p.relative_to(self.study): p.read_bytes()
                                  for p in self.study.rglob('*') if p.is_file()}, before)
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = main(['status', '--study', str(self.study)])
        self.assertEqual(code, 2)
        self.assertRegex(stderr.getvalue(), 'registry|ledger')
        self.assertFalse(registry.exists())
        self.assertEqual({p.relative_to(self.study): p.read_bytes()
                          for p in self.study.rglob('*') if p.is_file()}, before)


class FinalBankruptcyTests(unittest.TestCase):
    def test_exact_total_loss_preserves_trade_and_all_remaining_fold_sessions(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            days = ['2020-01-06', '2020-01-07', '2020-01-08', '2020-01-09', '2020-01-10']
            sessions, bars = [], []
            for day in days:
                start = pd.Timestamp(f'{day}T08:00:00Z')
                sessions.append({'session_date': day, 'open': start.isoformat(),
                                 'close': (start + pd.Timedelta(minutes=5)).isoformat()})
                prices = [97., 97., 97., 3., 3.] if day == days[1] else [3.] * 5
                for minute, price in enumerate(prices):
                    bars.append({'timestamp': (start + pd.Timedelta(minutes=minute)).isoformat(),
                                 'open': price, 'high': price, 'low': price, 'close': price, 'volume': 1000})
            pd.DataFrame(sessions).to_csv(root / 'sessions.csv', index=False)
            pd.DataFrame(bars).to_csv(root / 'bars.csv', index=False)
            manifest = {'schema_version': 1, 'symbol': 'UCG', 'currency': 'EUR', 'timezone': 'Europe/Rome',
                        'data_kind': 'synthetic', 'bar_minutes': 1, 'timestamp_semantics': 'interval_start',
                        'price_basis': 'raw', 'volume_basis': 'primary_continuous',
                        'source': 'literal bankruptcy regression', 'source_reference': 'test fixture',
                        'acquired_at': '2026-11-05T00:00:00Z', 'license_note': 'invented test data',
                        'corporate_action_policy': 'no actions in invented data',
                        'bars_file': 'bars.csv', 'sessions_file': 'sessions.csv', 'provenance_verified': False}
            (root / 'manifest.json').write_text(json.dumps(manifest))
            config = copy.deepcopy(DEFAULT_CONFIG)
            config['features'].update(volume_lookback_sessions=1, min_volume_history_sessions=1)
            config['execution'].update(initial_cash=100., allocation_fraction=1., commission_rate=0.,
                                       minimum_commission=3., round_trip_spread_bps=0., slippage_bps_per_side=0.,
                                       latency_minutes=1, holding_minutes=1, cooldown_minutes=0)
            config['research'].update(train_sessions=1, test_sessions=1, holdout_sessions=1,
                                      bootstrap_samples=200, block_length=1)
            config['candidates'] = [config['candidates'][0]]
            (root / 'config.json').write_text(json.dumps(config))

            def signal(_labelled, _train, test, _candidate):
                return pd.DataFrame({'decision_time': pd.to_datetime([f'{d}T08:01:00Z' for d in test]),
                                     'score': [1.] * len(test)})

            with patch('ucg_lab.workflow._signals', side_effect=signal) as signals:
                report = run_research(root / 'manifest.json', root / 'config.json', root / 'study')
            self.assertEqual(report['failures'], [])
            self.assertEqual(len(report['results']), 1)
            result = report['results'][0]
            self.assertEqual(result['metrics']['net_return'], -1.)
            self.assertEqual(len(result['folds']), 3)
            self.assertEqual(signals.call_count, 1)
            output = root / 'study' / 'development' / 'pullback_v1'
            equity = pd.read_csv(output / 'equity.csv')
            self.assertEqual(equity['session_date'].tolist(), days[1:4])
            self.assertEqual(equity['equity'].tolist(), [0., 0., 0.])
            self.assertEqual(equity['daily_return'].tolist(), [-1., 0., 0.])
            self.assertEqual(equity['net_pnl'].tolist(), [-100., 0., 0.])
            self.assertEqual(equity['trade_count'].tolist(), [1, 0, 0])
            trades = pd.read_csv(output / 'trades.csv')
            self.assertEqual(trades['net_pnl'].tolist(), [-100.])
            events = json.loads((output / 'events.json').read_text())
            exhausted = [event for event in events if event['type'] == 'account_exhausted']
            self.assertEqual([event['session_date'] for event in exhausted], days[2:4])


if __name__ == '__main__':
    unittest.main()
