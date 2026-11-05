# Data acquisition and canonical input

## Actual availability

No real UCG data is bundled or acquired. The 5–10-year target is a desired archive, not verified coverage. Euronext NextHistory advertises Borsa Italiana trades/BBO/reference data. IBKR documents historical ticks for three years, permissions and historical/live filtering differences. Consult `SOURCES.md`, obtain a sample and verify the actual instrument/venue/history and terms before committing to a source.

## Folder contents

```text
your_dataset/
  manifest.json
  bars.csv
  sessions.csv
  context.csv   (optional)
  news.csv      (optional event metadata)
```

The manifest paths must remain inside that directory. Do not point to secrets or unrelated files. See `examples/manifest.template.json` and schema. The loader validates structure and hashes the raw bytes; it never modifies the source.


### Enable optional inputs explicitly

When you supply either optional feed, add its corresponding key to `manifest.json` (this is a fragment to merge into the required manifest):

```json
{
  "context_file": "context.csv",
  "news_file": "news.csv"
}
```

Include only keys for files you actually supply. **An unreferenced CSV is ignored**, even when named `context.csv` or `news.csv` and placed beside `bars.csv`. The primary manifest template omits both keys so it remains usable without those optional files. Referenced optional files become part of the dataset hash.

Review the generated `data_audit.json` warnings alongside the performance report before describing a study as using market context or news. The current audit reports quote coverage and warns when no event feed was loaded; it does not summarize optional-feed timestamp coverage. Have Codex inspect `context_available` and `news_available` in the frame returned by `build_features`, using the study's feature configuration and evaluation dates, and check each supplied feed's timestamp range and gaps. A loaded news file alone does not prove a complete archive. A passed structural audit or completed performance report alone does not establish either feed's coverage.

## Minute bars

Header:

```csv
timestamp,open,high,low,close,volume,bid_open,ask_open
```

`timestamp` is the **UTC-aware interval start**. A row at 09:00 represents [09:00,09:01) and is unavailable in full until 09:01. A completed five-minute bar ending at 09:05 includes the rows starting 09:00 through 09:04. With the default one-minute execution delay, its earliest hypothetical entry is the 09:06 minute open.

Bid/ask columns are an optional pair. If present, they mean snapshots at the minute START, not the close or a full-minute average. Do not rename a vendor's closing quote as `ask_open`. Without the pair, use `bar_proxy` costs; do not claim observed spreads. A zero-volume row is distinct from missing data and cannot support a fill. Bar stops are approximations even with opening quotes.

The prototype requires complete minute coverage of the supplied continuous sessions. Explicitly account for halts/corrections during provider normalization. Do not forward-fill missing records to pass validation. Current loader accepts genuine zero-volume bars from a documented feed but rejects missing intervals. This strict contract may require a provider adapter and reviewed anomaly policy before real research.

## Sessions

```csv
session_date,open,close
```

Example only: `2026-11-05,2026-11-05T08:00:00Z,2026-11-05T16:30:00Z` describes a supplied continuous interval, not a substitute for a verified annual calendar. Use Europe/Rome for local session identity and UTC for storage. Auctions/trading-at-last are excluded from initial continuous-session input. Historical market hours and platform changes must be accounted for. Weekdays alone are not a real trading calendar.

## Price and share-volume comparability

Execution uses raw prices and actual share quantities. Maintain a separately reviewed corporate-action normalization process for features. UCG's 2017 reverse split and rights issue require identifier/unit reconciliation. A mechanical one-for-ten reverse split changes comparable historical share units; cash dividends and rights issues must not be handled by blindly applying inverse price factors to volume. The `corporate_action_policy` string is documentation, not an implemented corporate-action engine. The current raw-return features can be distorted across unprocessed events; do not mark provenance reviewed until that issue is resolved.

## Optional market context

```csv
available_at,market_return_15m,sector_return_15m
```

Each row must contain a value actually available at that timestamp. Root data checks require unique chronological rows. A feature uses the latest available row no more than the configured 15 minutes old; otherwise the numeric placeholder is zero and `context_available=0`. That placeholder is not evidence of a flat market. Sector baskets need historical constituents/weights; a sector index containing UCG also includes part of its own move.

## Optional event metadata

```csv
event_id,published_at,available_at,event_type
```

`available_at` cannot precede publication. Events contribute to a count over (decision−60 minutes, decision]. IDs remain strings and are unique. This version counts events; it does not infer sentiment from text, use LLM news embeddings or implement revised-story merging. Absence of a news file sets `news_available=0`, not a claim that no news happened. A missing or incomplete archive must not be described as complete historical coverage.

## Audit before modelling

Verify security identifiers and instrument type; currency and price units; interval start/end conventions; DST; continuous/auction phases; cancellations/corrections; duplicates; gaps; OHLC consistency; quote timestamp/side/size; raw vs adjusted values; historical/live filters; source permissions and redistribution restrictions. Reconcile same-definition intraday volume with daily totals on ordinary/event/high-volume/corporate-action days across several years. A passed structural audit does not prove financial correctness.

Keep inputs private and outside Git. Do not redistribute licensed raw data in the project ZIP.
