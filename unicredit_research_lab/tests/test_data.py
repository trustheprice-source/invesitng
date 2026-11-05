"""Hand-built canonical input fixtures and validation regressions."""
import json
from pathlib import Path
import tempfile
import unittest
import numpy as np
import pandas as pd
from ucg_lab.data import load_dataset, audit_dataset


class DataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = dict(schema_version=1, symbol='UCG', currency='EUR',
            timezone='Europe/Rome', data_kind='synthetic', bar_minutes=1,
            timestamp_semantics='interval_start', price_basis='raw',
            volume_basis='primary_continuous', source='invented fixture',
            source_reference='test only', acquired_at='2025-01-01T00:00:00Z',
            license_note='synthetic test', corporate_action_policy='none: synthetic',
            bars_file='bars.csv', sessions_file='sessions.csv', provenance_verified=False)
        self.sessions = pd.DataFrame([dict(session_date='2025-01-02',
            open='2025-01-02T08:00:00Z', close='2025-01-02T08:10:00Z')])
        self.bars = pd.DataFrame(dict(timestamp=pd.date_range('2025-01-02T08:00:00Z', periods=10, freq='min'),
            open=10., high=11., low=9., close=10., volume=100.))

    def write(self):
        self.bars.to_csv(self.root/'bars.csv', index=False)
        self.sessions.to_csv(self.root/'sessions.csv', index=False)
        (self.root/'manifest.json').write_text(json.dumps(self.manifest))
        return self.root/'manifest.json'

    def test_load_normalizes_utc_and_audit_is_json_safe(self):
        data = load_dataset(self.write())
        self.assertEqual(str(data.bars.timestamp.dt.tz), 'UTC')
        self.assertTrue(data.audit['passed'])
        self.assertEqual(data.audit['bars'], 10)
        self.assertEqual(data.audit['quote_coverage'], 0.)
        self.assertEqual(len(data.dataset_hash), 64)
        json.dumps(audit_dataset(data), allow_nan=False)

    def test_missing_minute_is_rejected_but_zero_volume_is_valid(self):
        self.bars.loc[3,'volume'] = 0
        self.assertTrue(load_dataset(self.write()).audit['passed'])
        self.bars = self.bars.drop(3)
        with self.assertRaisesRegex(ValueError, 'missing|minute|coverage'):
            load_dataset(self.write())

    def test_duplicate_unsorted_nonfinite_and_invalid_ohlc_rejected(self):
        original = self.bars.copy()
        for mutation in ('duplicate', 'unsorted', 'nonfinite', 'ohlc', 'negative'):
            with self.subTest(mutation=mutation):
                self.bars = original.copy()
                if mutation == 'duplicate': self.bars.loc[1,'timestamp'] = self.bars.loc[0,'timestamp']
                if mutation == 'unsorted': self.bars = self.bars.iloc[::-1]
                if mutation == 'nonfinite': self.bars.loc[1,'close'] = np.inf
                if mutation == 'ohlc': self.bars.loc[1,'close'] = 12
                if mutation == 'negative': self.bars.loc[1,'volume'] = -1
                with self.assertRaises(ValueError): load_dataset(self.write())

    def test_naive_and_off_minute_timestamps_rejected(self):
        for timestamp in ('2025-01-02T08:00:00', '2025-01-02T08:00:01Z'):
            with self.subTest(timestamp=timestamp):
                self.bars['timestamp'] = self.bars.timestamp.astype(str)
                self.bars.loc[0,'timestamp'] = timestamp
                with self.assertRaises(ValueError): load_dataset(self.write())

    def test_bad_sessions_rejected(self):
        original = self.sessions.copy()
        cases = [('session_date','2025-01-03'), ('open','2025-01-02T08:00:01Z'),
                 ('close','2025-01-02T07:59:00Z'), ('open','2025-01-02T08:00:00')]
        for column, value in cases:
            with self.subTest(column=column,value=value):
                self.sessions = original.copy()
                self.sessions.loc[0,column] = value
                with self.assertRaises(ValueError): load_dataset(self.write())
        self.sessions = pd.concat([original, original],ignore_index=True)
        with self.assertRaises(ValueError): load_dataset(self.write())

    def test_out_of_session_bar_rejected(self):
        self.bars.loc[9,'timestamp'] = pd.Timestamp('2025-01-02T08:10:00Z')
        with self.assertRaises(ValueError): load_dataset(self.write())

    def test_manifest_paths_cannot_escape_by_parent_absolute_or_symlink(self):
        self.write()
        outside = self.root.parent / (self.root.name + '-outside.csv')
        outside.write_text('test')
        self.addCleanup(outside.unlink)
        (self.root/'escape.csv').symlink_to(outside)
        for filename in ('../'+outside.name, str(outside), 'escape.csv'):
            with self.subTest(filename=filename):
                self.manifest['bars_file'] = filename
                with self.assertRaisesRegex(ValueError, 'path|directory|relative'):
                    load_dataset(self.write())

    def test_quotes_must_be_paired_and_ordered(self):
        self.bars['bid_open'] = 9.99
        with self.assertRaises(ValueError): load_dataset(self.write())
        self.bars['ask_open'] = 10.01
        self.assertEqual(load_dataset(self.write()).audit['quote_coverage'], 1.)
        self.bars.loc[0,'bid_open'] = 10.02
        with self.assertRaises(ValueError): load_dataset(self.write())

    def test_manifest_and_every_auxiliary_input_are_hashed(self):
        self.manifest['context_file'] = 'context.csv'
        self.manifest['news_file'] = 'news.csv'
        (self.root/'context.csv').write_text('available_at,market_return_15m,sector_return_15m\n2025-01-02T08:00:00Z,0.01,0.02\n')
        news = 'event_id,published_at,available_at,event_type\na,2025-01-02T07:00:00Z,2025-01-02T08:00:00Z,fixture\n'
        (self.root/'news.csv').write_text(news)
        first = load_dataset(self.write())
        (self.root/'news.csv').write_text(news.replace('fixture','fixture2'))
        second = load_dataset(self.root/'manifest.json')
        self.assertNotEqual(first.dataset_hash,second.dataset_hash)
        self.manifest['license_note'] = 'new declaration'
        self.assertNotEqual(second.dataset_hash,load_dataset(self.write()).dataset_hash)

    def test_auxiliary_validation_and_event_deduplication(self):
        self.manifest['news_file'] = 'news.csv'
        header='event_id,published_at,available_at,event_type\n'
        event='a,2025-01-02T07:00:00Z,2025-01-02T08:00:00Z,fixture\n'
        (self.root/'news.csv').write_text(header+event+event)
        self.assertEqual(len(load_dataset(self.write()).news),1)
        (self.root/'news.csv').write_text(header+event.replace('07:00','09:00'))
        with self.assertRaises(ValueError): load_dataset(self.write())
        self.manifest.pop('news_file')
        self.manifest['context_file']='context.csv'
        (self.root/'context.csv').write_text('available_at,market_return_15m,sector_return_15m\n2025-01-02T08:00:00Z,inf,0\n')
        with self.assertRaises(ValueError): load_dataset(self.write())

    def test_event_identifiers_preserve_leading_zero_and_na_strings(self):
        self.manifest['news_file']='news.csv'
        (self.root/'news.csv').write_text('event_id,published_at,available_at,event_type\n'
            '001,2025-01-02T07:00:00Z,2025-01-02T08:00:00Z,fixture\n'
            '1,2025-01-02T07:00:00Z,2025-01-02T08:00:00Z,fixture\n'
            'NA,2025-01-02T07:00:00Z,2025-01-02T08:00:00Z,fixture\n')
        self.assertEqual(load_dataset(self.write()).news.event_id.tolist(),['001','1','NA'])

    def test_duplicate_csv_header_is_rejected(self):
        path=self.write()
        raw=(self.root/'bars.csv').read_text()
        lines=raw.splitlines()
        lines[0]+=',close'
        lines[1:]=[line+',10.0' for line in lines[1:]]
        (self.root/'bars.csv').write_text('\n'.join(lines)+'\n')
        with self.assertRaisesRegex(ValueError,'duplicate|columns'):
            load_dataset(path)

    def test_all_csv_record_widths_match_the_declared_header(self):
        self.manifest['context_file']='context.csv'
        self.manifest['news_file']='news.csv'
        (self.root/'context.csv').write_text('available_at,market_return_15m,sector_return_15m\n2025-01-02T08:00:00Z,0.01,0.02\n')
        (self.root/'news.csv').write_text('event_id,published_at,available_at,event_type\na,2025-01-02T07:00:00Z,2025-01-02T08:00:00Z,fixture\n')
        manifest_path=self.write()
        for filename in ('bars.csv','sessions.csv','context.csv','news.csv'):
            path=self.root/filename
            original=path.read_text()
            for width_error in ('surplus','missing'):
                with self.subTest(filename=filename,width_error=width_error):
                    lines=original.splitlines()
                    # The review's implicit-index reproduction: every row has
                    # one undeclared leading field while the header is intact.
                    if width_error=='surplus':
                        lines[1:]=['UNDECLARED,'+line for line in lines[1:]]
                    else:
                        lines[1:]=[line.rsplit(',',1)[0] for line in lines[1:]]
                    path.write_text('\n'.join(lines)+'\n')
                    try:
                        with self.assertRaisesRegex(ValueError,'record|field|width'):
                            load_dataset(manifest_path)
                    finally:
                        path.write_text(original)

    def test_csv_quoting_is_preserved_and_unterminated_quote_rejected(self):
        self.manifest['news_file']='news.csv'
        header='event_id,published_at,available_at,event_type\n'
        row='a,2025-01-02T07:00:00Z,2025-01-02T08:00:00Z,"quoted, event\nwith newline"\n'
        (self.root/'news.csv').write_text(header+row)
        self.assertEqual(load_dataset(self.write()).news.iloc[0].event_type,'quoted, event\nwith newline')
        (self.root/'news.csv').write_text(header+row[:-2])
        with self.assertRaises(ValueError):
            load_dataset(self.write())

    def test_required_manifest_metadata_and_audit_failure(self):
        self.manifest.pop('license_note')
        with self.assertRaises(ValueError): load_dataset(self.write())
        self.manifest['license_note']='fixture'
        data=load_dataset(self.write())
        data.bars=data.bars.drop(1)
        report=audit_dataset(data)
        self.assertFalse(report['passed'])
        self.assertTrue(report['errors'])

if __name__ == '__main__': unittest.main()
