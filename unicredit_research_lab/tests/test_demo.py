import json
import tempfile
import unittest
from pathlib import Path

from ucg_lab.demo import create_demo


class DemoTests(unittest.TestCase):
    def test_deterministic_data_explicitly_synthetic(self):
        with tempfile.TemporaryDirectory() as tmp:
            a = create_demo(Path(tmp) / 'a', sessions=5, seed=7)
            b = create_demo(Path(tmp) / 'b', sessions=5, seed=7)
            manifest = json.loads(a.read_text())
            self.assertEqual(manifest['data_kind'], 'synthetic')
            self.assertFalse(manifest['provenance_verified'])
            self.assertEqual((a.parent / 'bars.csv').read_bytes(), (b.parent / 'bars.csv').read_bytes())
            self.assertEqual(len((a.parent / 'sessions.csv').read_text().splitlines()), 6)

    def test_refuses_to_overwrite_existing_dataset(self):
        with tempfile.TemporaryDirectory() as tmp:
            create_demo(Path(tmp), sessions=2)
            with self.assertRaises(FileExistsError):
                create_demo(Path(tmp), sessions=2)


if __name__ == '__main__':
    unittest.main()
