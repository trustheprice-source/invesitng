import tempfile
import unittest
from pathlib import Path

from ucg_lab.reporting import write_report


class ReportTests(unittest.TestCase):
    def test_escapes_untrusted_data_and_retains_synthetic_warning(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = {'data_kind': 'synthetic', 'phase': 'development',
                      'study_id': '<script>alert(1)</script>', 'eligible_for_live': False,
                      'results': [], 'failures': []}
            paths = write_report(report, Path(tmp))
            html = Path(paths['html']).read_text()
            self.assertIn('SYNTHETIC', html)
            self.assertNotIn('<script>alert(1)</script>', html)
            self.assertIn('&lt;script&gt;', html)
            self.assertTrue(Path(paths['json']).exists())


if __name__ == '__main__':
    unittest.main()
