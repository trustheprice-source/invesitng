import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from ucg_lab.cli import main


class CliTests(unittest.TestCase):
    def test_demo_audit_and_config_commands_are_runnable(self):
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()) as output:
            root=Path(tmp)
            self.assertEqual(main(['init-config','--profile','demo','--out',str(root/'config.json')]),0)
            self.assertEqual(main(['demo','--out',str(root/'data'),'--sessions','5']),0)
            self.assertEqual(main(['audit','--manifest',str(root/'data/manifest.json'),'--out',str(root/'audit.json')]),0)
            audit=json.loads((root/'audit.json').read_text())
            self.assertTrue(audit['passed'])
            self.assertEqual(audit['data_kind'],'synthetic')
            self.assertIn('synthetic', output.getvalue().lower())

    def test_bad_input_returns_nonzero_without_success_message(self):
        with contextlib.redirect_stderr(io.StringIO()) as errors:
            self.assertEqual(main(['audit','--manifest','/does/not/exist.json']),2)
            self.assertIn('ERROR',errors.getvalue())

    def test_module_entry_point_prints_help(self):
        result=subprocess.run([sys.executable,'-m','ucg_lab','--help'],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('research',result.stdout)


if __name__ == '__main__': unittest.main()
