# Verified delivery status

Version **0.1.0**, verified 5 November 2026.

## Completed software delivery

The local research pipeline, simulated broker core, command-line interface, tests, reports, canonical input templates and self-contained Codex continuation prompt are implemented. The final source passed **124 tests with warnings treated as errors**. A fresh 180-session invented-data workflow completed data audit, four-candidate chronological development, freezing, one-shot final evaluation, paper-only handoff and simulated account initialization. An attempted repeat of the final evaluation was refused. Independent scoped re-review approved the final integration fixes.

See `VERIFICATION.md` for exact commands, environment, reviewed source identity and verification limits. The bundled example reports remain `SYNTHETIC_DEMO`; all live eligibility fields remain false.

## Market evidence

**None.** No real UniCredit dataset was acquired or audited. No real UniCredit strategy was trained, backtested, validated, prospectively paper traded or traded live. Demonstration prices, volumes, dates/calendars and returns are invented software fixtures. Passing software tests is not evidence of profitable trading.

## Next work

Start with `CODEX_START_PROMPT.md`, then follow `CONTINUATION.md`. The first external input is authorized historical UCG data with verified coverage, timestamps, calendar, venue scope and corporate-action treatment. Actual broker costs, account restrictions and a personal numerical risk mandate are unresolved. Cost/regime/delay stress, intraday drawdown and richer news research remain explicit extensions.

The file-fed paper account is a working accounting/execution core. It still requires a read-only live feed, frozen signal service, real-calendar scheduler, automatic stop/time/end-of-day exits and prospective evaluation integration. The OpenClaw artifact is a paper-only JSON contract, not an installed trading plugin. There is no live broker adapter or real-order path.

## Restart

From the project root, use the setup in `README.md`, then:

```bash
python -W error -m unittest discover -s tests -v
python scripts/run_demo.py
```

The demo chooses a fresh output directory. Do not reuse pre-fix studies as if their source/dependency identity still matched. Preserve existing research histories; restore the original registry if it is lost. Never manufacture a replacement ledger to reset a used final period.
