# User handoff review

Scope: read-only review of README, Codex start prompt, project scope, status, data guide, research protocol, OpenClaw handoff and continuation queue, with narrow inspection of configuration/CLI/template files. No tests or real-data acquisition were run by this review. The expected final STATUS/VERIFICATION updates are outside this review.

## Actionable findings

### P2 — Explicitly wire optional market/news inputs into the real-data manifest instructions

`docs/DATA_GUIDE.md:9–18` presents `context.csv` and `news.csv` as optional files in the dataset directory, but the supplied `examples/manifest.template.json` contains neither `context_file` nor `news_file`. The guide's context/event sections describe their CSV columns without telling the user to add those manifest keys. The loader reads optional inputs only when the keys are present (`ucg_lab/data.py:181–195`); merely placing the named CSVs beside the bars does not enable them. A nonexpert following the guide can therefore run a valid price/volume study while incorrectly believing the supplied market/news information was included.

Action: add a short manifest example to DATA_GUIDE showing `"context_file": "context.csv"` and `"news_file": "news.csv"`, state that absent keys mean those files are not loaded, and tell the user to verify availability/coverage in the resulting audit/report. Keep the primary manifest template usable without requiring optional files.

## Overall readiness

Ready for a nonexpert to hand the project to Codex for synthetic first-run verification and continued engineering, subject to the coordinator's final test/demo verification and STATUS/VERIFICATION updates. Correct the optional-input instruction above before packaging. The core first-run commands exist, demo versus real profile defaults are consistent, and no unsupported profitability or live-trading guarantee was found in the reviewed handoff. The remaining real-data, personal acceptance/risk, provider integration and unattended-paper work is explicitly identified; this is a continuation project rather than evidence that a UniCredit trading opportunity has been established.
