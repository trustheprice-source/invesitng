import copy
import json
import tempfile
import unittest
import warnings
import pandas as pd
from pathlib import Path

from ucg_lab.config import DEFAULT_CONFIG
from ucg_lab.demo import create_demo
from ucg_lab.workflow import run_research, freeze_candidate, run_holdout, export_handoff, inspect_analogs


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.manifest = create_demo(self.root / 'data', sessions=25)
        config = copy.deepcopy(DEFAULT_CONFIG)
        config['features'].update(volume_lookback_sessions=5, min_volume_history_sessions=3)
        config['research'].update(train_sessions=8, test_sessions=4, holdout_sessions=5, bootstrap_samples=200)
        config['candidates'] = [config['candidates'][0], config['candidates'][3]]
        self.config_path = self.root / 'config.json'
        self.config_path.write_text(json.dumps(config))
        self.study = self.root / 'study'

    def tearDown(self):
        self.temp.cleanup()

    def test_full_synthetic_workflow_never_authorizes_live_and_holdout_consumed(self):
        with warnings.catch_warnings():
            warnings.simplefilter('error', FutureWarning)
            report = run_research(self.manifest, self.config_path, self.study)
        self.assertEqual(report['data_kind'], 'synthetic')
        self.assertEqual(len(report['results']), 2)
        self.assertEqual(report['failures'], [])
        for item in report['results']:
            self.assertEqual(item['evidence']['status'], 'SYNTHETIC_DEMO')
            self.assertFalse(item['evidence']['eligible_for_live'])
        self.assertEqual(report['holdout']['sessions'], 5)
        freeze_candidate(self.study, 'ridge_v1')
        holdout = run_holdout(self.study)
        self.assertEqual(holdout['phase'], 'holdout')
        self.assertFalse(holdout['eligible_for_live'])
        with self.assertRaises(ValueError):
            run_holdout(self.study)
        handoff = export_handoff(self.study)
        self.assertFalse(json.loads(handoff.read_text())['eligible_for_live'])

    def test_resume_does_not_rerun_trials_and_mutated_inputs_rejected(self):
        first = run_research(self.manifest, self.config_path, self.study)
        second = run_research(self.manifest, self.config_path, self.study)
        self.assertEqual(first['results'], second['results'])
        cfg = json.loads(self.config_path.read_text())
        cfg['execution']['minimum_commission'] = 0
        self.config_path.write_text(json.dumps(cfg))
        with self.assertRaises(ValueError):
            run_research(self.manifest, self.config_path, self.study)

    def test_frozen_artifact_tamper_refused(self):
        run_research(self.manifest, self.config_path, self.study)
        path = freeze_candidate(self.study, 'ridge_v1')
        frozen = json.loads(path.read_text())
        frozen['candidate']['score_threshold'] = -1
        path.write_text(json.dumps(frozen))
        with self.assertRaises(ValueError):
            run_holdout(self.study)

    def test_changed_dependency_environment_blocks_holdout(self):
        run_research(self.manifest,self.config_path,self.study)
        freeze_candidate(self.study,'ridge_v1')
        state=json.loads((self.study/'study.json').read_text())
        state['environment']['numpy']='different'
        (self.study/'study.json').write_text(json.dumps(state))
        with self.assertRaises(ValueError): run_holdout(self.study)

    def test_holdout_price_changes_do_not_change_development_results(self):
        original=run_research(self.manifest,self.config_path,self.study)
        bars=pd.read_csv(self.manifest.parent/'bars.csv')
        sessions=pd.read_csv(self.manifest.parent/'sessions.csv')
        cutoff=pd.Timestamp(sessions.iloc[-5]['open'])
        mask=pd.to_datetime(bars['timestamp'],utc=True)>=cutoff
        for column in ['open','high','low','close','bid_open','ask_open']:
            bars.loc[mask,column]*=2
        bars.to_csv(self.manifest.parent/'bars.csv',index=False,float_format='%.10f')
        modified=run_research(self.manifest,self.config_path,self.root/'changed_study')
        self.assertEqual(original['results'],modified['results'])
        self.assertNotEqual(original['dataset_hash'],modified['dataset_hash'])

    def test_analog_inspection_excludes_final_period_and_unfinished_cases(self):
        run_research(self.manifest,self.config_path,self.study)
        result=inspect_analogs(self.study)
        self.assertGreater(len(result['cases']),0)
        for case in result['cases']:
            self.assertLess(pd.Timestamp(case['label_end']),pd.Timestamp(result['decision_time']))
        sessions=pd.read_csv(self.manifest.parent/'sessions.csv')
        forbidden=pd.Timestamp(sessions.iloc[-1]['open'])+pd.Timedelta(minutes=30)
        with self.assertRaises(ValueError): inspect_analogs(self.study,forbidden.isoformat())


if __name__ == '__main__':
    unittest.main()
