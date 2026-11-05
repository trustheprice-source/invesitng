import tempfile
import unittest
from pathlib import Path

from ucg_lab.ledger import StudyLedger


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.ledger = StudyLedger(Path(self.temp.name) / 'study.sqlite', create=True)

    def tearDown(self):
        self.temp.cleanup()

    def test_duplicate_identical_trial_is_cached_but_changed_trial_refused(self):
        self.assertTrue(self.ledger.register_trial('one', {'alpha': 1}, 'd', 'c', 2))
        self.ledger.finish_trial('one', {'return': -0.1})
        self.assertFalse(self.ledger.register_trial('one', {'alpha': 1}, 'd', 'c', 2))
        with self.assertRaises(ValueError):
            self.ledger.register_trial('one', {'alpha': 2}, 'd', 'c', 2)
        self.assertEqual(len(self.ledger.trials()), 1)

    def test_failed_trials_consume_budget(self):
        self.ledger.register_trial('one', {}, 'd', 'c', 1)
        self.ledger.fail_trial('one', 'bad data')
        with self.assertRaises(ValueError):
            self.ledger.register_trial('two', {}, 'd', 'c', 1)

    def test_holdout_consumed_before_success_and_cannot_be_reused(self):
        self.ledger.claim_holdout('period', 'frozen')
        self.ledger.finish_holdout('period', None, error='operational failure')
        with self.assertRaises(ValueError):
            self.ledger.claim_holdout('period', 'different candidate')

    def test_journal_is_idempotent_and_detects_conflicting_reuse(self):
        self.assertTrue(self.ledger.record_event('event', 'paper', {'qty': 2}))
        self.assertFalse(self.ledger.record_event('event', 'paper', {'qty': 2}))
        with self.assertRaises(ValueError):
            self.ledger.record_event('event', 'paper', {'qty': 3})


if __name__ == '__main__':
    unittest.main()
