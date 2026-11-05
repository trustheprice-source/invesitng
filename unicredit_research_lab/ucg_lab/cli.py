"""Command-line entry point; no command can place a live order."""

from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

from .config import DEFAULT_CONFIG, validate_config
from .data import load_dataset
from .demo import create_demo
from .ledger import StudyLedger
from .paper import PaperBroker
from .workflow import export_handoff, freeze_candidate, run_holdout, run_research, write_json, inspect_analogs


def parser():
    app=argparse.ArgumentParser(prog='ucg-lab',description='UniCredit historical research and paper simulation. No live trading.')
    commands=app.add_subparsers(dest='command',required=True)
    p=commands.add_parser('init-config',help='Write explicit research assumptions')
    p.add_argument('--out',required=True); p.add_argument('--profile',choices=['demo','real'],default='real')
    p=commands.add_parser('demo',help='Create invented, permanently synthetic OHLCV')
    p.add_argument('--out',required=True); p.add_argument('--sessions',type=int,default=180); p.add_argument('--seed',type=int,default=17)
    p=commands.add_parser('audit',help='Validate canonical input and record coverage')
    p.add_argument('--manifest',required=True); p.add_argument('--out')
    p=commands.add_parser('research',help='Run registered development-only chronological trials')
    p.add_argument('--manifest',required=True); p.add_argument('--config',required=True); p.add_argument('--out',required=True)
    p=commands.add_parser('freeze',help='Freeze one completed development candidate')
    p.add_argument('--study',required=True); p.add_argument('--candidate',required=True)
    p=commands.add_parser('holdout',help='Consume the frozen final period once')
    p.add_argument('--study',required=True)
    p=commands.add_parser('handoff',help='Export paper-only OpenClaw integration contract')
    p.add_argument('--study',required=True)
    p=commands.add_parser('status',help='Read saved experiment status')
    p.add_argument('--study',required=True)
    p=commands.add_parser('analogs',help='Inspect comparable earlier development episodes, including losses')
    p.add_argument('--study',required=True); p.add_argument('--decision-at'); p.add_argument('--max-cases',type=int,default=10)
    p=commands.add_parser('paper-init',help='Create a file-fed simulated account from a paper handoff')
    p.add_argument('--handoff',required=True); p.add_argument('--db',required=True)
    p.add_argument('--mode',choices=['simulation','prospective'],default='simulation')
    p=commands.add_parser('paper-order',help='Submit a simulated order; never sent to a broker')
    p.add_argument('--db',required=True); p.add_argument('--order-id',required=True)
    p.add_argument('--side',choices=['buy','sell'],required=True); p.add_argument('--quantity',type=int,required=True)
    p.add_argument('--decision-at',required=True)
    p=commands.add_parser('paper-quote',help='Process a timestamped local quote JSON observation')
    p.add_argument('--db',required=True); p.add_argument('--quote',required=True)
    p=commands.add_parser('paper-cancel',help='Cancel a pending simulated order')
    p.add_argument('--db',required=True); p.add_argument('--order-id',required=True)
    p=commands.add_parser('paper-status',help='Read simulated cash, position, orders and fills')
    p.add_argument('--db',required=True)
    return app


def _summary(report):
    return {'phase':report['phase'],'data_kind':report['data_kind'],'eligible_for_live':False,
            'candidates':[{'id':x['candidate']['id'],'state':x['evidence']['status'],
                           'net_return':x['metrics']['net_return'],'trades':x['metrics']['trades']}
                          for x in report['results']], 'failures':report['failures']}


def main(argv=None) -> int:
    args=parser().parse_args(argv)
    try:
        if args.command == 'init-config':
            path=Path(args.out)
            if path.exists(): raise FileExistsError('Refusing to overwrite existing configuration')
            config=copy.deepcopy(DEFAULT_CONFIG)
            if args.profile == 'real':
                config['features'].update(volume_lookback_sessions=60,min_volume_history_sessions=30)
                config['research'].update(train_sessions=252,test_sessions=63,holdout_sessions=126)
                config['criteria']['min_evaluation_sessions']=126
            write_json(path,validate_config(config))
            result={'config':str(path),'profile':args.profile,'assumptions_verified':False}
        elif args.command == 'demo':
            path=create_demo(args.out,args.sessions,args.seed)
            result={'manifest':str(path),'data_kind':'synthetic','notice':'Invented software demo; not UniCredit market data'}
        elif args.command == 'audit':
            result=load_dataset(args.manifest).audit
            if args.out: write_json(Path(args.out),result)
        elif args.command == 'research':
            report=run_research(args.manifest,args.config,args.out)
            result={**_summary(report),'html_report':str(Path(args.out)/'development/report.html')}
            print(json.dumps(result,indent=2,allow_nan=False))
            return 0 if not report['failures'] else 1
        elif args.command == 'freeze':
            result={'frozen':str(freeze_candidate(args.study,args.candidate)),'eligible_for_live':False}
        elif args.command == 'holdout':
            result=_summary(run_holdout(args.study))
        elif args.command == 'handoff':
            result={'handoff':str(export_handoff(args.study)),'mode':'paper_only','eligible_for_live':False}
        elif args.command == 'analogs':
            result=inspect_analogs(args.study,args.decision_at,args.max_cases)
        elif args.command == 'status':
            study=Path(args.study)
            state=json.loads((study/'study.json').read_text())
            ledger=StudyLedger(study/'ledger.sqlite',create=False)
            result={'study':state,'trials':[{'id':r['trial_id'],'status':r['status'],'error':r['error']} for r in ledger.trials()],
                    'holdouts':[{'status':r['status'],'claimed_at':r['claimed_at'],'error':r['error']} for r in ledger.holdouts()],
                    'eligible_for_live':False}
        elif args.command == 'paper-init':
            handoff=json.loads(Path(args.handoff).read_text())
            if handoff.get('mode')!='paper_only' or handoff.get('eligible_for_live') is not False or handoff.get('symbol')!='UCG':
                raise ValueError('Valid UCG paper-only handoff required')
            execution=handoff['execution']
            config={key:execution[key] for key in ('initial_cash','allocation_fraction','commission_rate','minimum_commission','slippage_bps_per_side')}
            config.update(mode=args.mode,data_kind=handoff['data_kind'],frozen_hash=handoff['frozen_hash'],latency_seconds=execution['latency_minutes']*60)
            result=PaperBroker(args.db,config).snapshot()
        elif args.command == 'paper-order':
            result={'recorded':PaperBroker(args.db).submit(args.order_id,args.side,args.quantity,args.decision_at),'simulated':True,'eligible_for_live':False}
        elif args.command == 'paper-quote':
            quote=json.loads(Path(args.quote).read_text())
            result={'simulated_fills':PaperBroker(args.db).on_quote(quote),'eligible_for_live':False}
        elif args.command == 'paper-cancel':
            result={'cancelled':PaperBroker(args.db).cancel(args.order_id),'simulated':True}
        else:
            result=PaperBroker(args.db).snapshot()
        print(json.dumps(result,indent=2,allow_nan=False))
        return 0
    except (ValueError, OSError, ImportError, TypeError, KeyError) as exc:
        print(f'ERROR: {type(exc).__name__}: {exc}',file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
