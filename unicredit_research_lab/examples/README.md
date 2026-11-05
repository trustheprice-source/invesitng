# Examples: invented data only

Every market observation and return in this directory is synthetic. No example is evidence of a UniCredit trading edge.

- `minimal_synthetic/` contains two invented sessions (360 one-minute rows) for schema and audit inspection. Its three-hour sessions are not the actual Milan exchange calendar. It is too short for the default research configuration.
- `SYNTHETIC_DEVELOPMENT_REPORT.html` and `.json` show the four demonstration candidates on invented development data.
- `SYNTHETIC_HOLDOUT_REPORT.html` and `.json` show the reserved demonstration period. Ridge was chosen only to exercise freezing and final evaluation; that choice does not imply superior performance.
- The report snapshots come from the complete 180-session generated demonstration. They do not come from the two-session minimal fixture.
- Files ending in `.template.csv` contain the canonical headers only. `manifest.template.json` contains placeholders for real-data preparation and cannot establish provenance by itself.

Run `python scripts/run_demo.py` from the project root to create a fresh, isolated synthetic workflow and inspect all trade/equity/signal files. Generated input hashes and report timestamps identify that specific run. See `docs/DATA_GUIDE.md` for authorized real inputs and optional context/news manifest keys.
