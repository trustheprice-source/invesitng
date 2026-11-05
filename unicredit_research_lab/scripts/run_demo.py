#!/usr/bin/env python3
"""Run the full invented-data workflow without downloading market data."""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--out')
    parser.add_argument('--sessions',type=int,default=180)
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    output=Path(args.out).resolve() if args.out else root/'workspace'/('demo-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    if output.exists() and any(output.iterdir()):
        raise SystemExit('Choose a new empty demo directory; existing experiments are not overwritten.')
    output.mkdir(parents=True,exist_ok=True)
    def run(*arguments):
        subprocess.run([sys.executable,'-m','ucg_lab',*map(str,arguments)],cwd=root,check=True)
    run('demo','--out',output/'data','--sessions',args.sessions)
    run('init-config','--profile','demo','--out',output/'config.json')
    run('audit','--manifest',output/'data/manifest.json','--out',output/'audit.json')
    run('research','--manifest',output/'data/manifest.json','--config',output/'config.json','--out',output/'study')
    run('freeze','--study',output/'study','--candidate','ridge_v1')
    run('holdout','--study',output/'study')
    run('handoff','--study',output/'study')
    run('paper-init','--handoff',output/'study/paper_handoff.json','--db',output/'paper.sqlite','--mode','simulation')
    print(json.dumps({'notice':'SYNTHETIC software demonstration only','output':str(output),
                      'report':str(output/'study/development/report.html'),'eligible_for_live':False},indent=2))


if __name__=='__main__': main()
