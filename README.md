# Token Launch Radar

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/yaoji114514/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/yaoji114514/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

An entry for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01) on make.fun: a program that reads a sealed snapshot of the DeFi protocol universe and ranks the protocols that have not launched a token yet by what a launch might be worth, then presents the ranking in a dashboard with a farming plan for each protocol.

## What it does

`main.ts` runs on Node 22 with the standard library only. It reads the snapshot at `/input/snapshot.json` and writes:

- `board.json` — the ranked board. On the kit snapshot it holds 226 rows: the 40 watchlist protocols plus 186 further pre-token protocols. Every row carries an implied launch value and a seven-step farming plan.
- `data.js` — the same board data, written beside the page for the dashboard to read.
- `dashboard/` — a static page: the board is sortable, filterable and searchable, and each protocol opens a detail view.
- `screenshots/` — three screenshots rendered from the dashboard's own files. See [SCREENSHOTS.md](SCREENSHOTS.md).
- `dossier.json` — the submission summary, built with `buildDossier` from `vendor/makefun-board.ts`.

## How the value is estimated

The model fits a robust log-log regression of market cap on TVL across the protocols in the same snapshot that already trade, with one pass that trims outliers, then applies the fitted line to the pre-token protocols. Two multipliers adjust the result: one for seven-day TVL growth, one for how long the protocol has existed. No protocol list is hard-coded anywhere; every number comes from the snapshot. On the kit snapshot the fit covers 114 protocols at R-squared 0.23, and the dashboard states the fit and its validation error in plain words rather than dressing them up.

## Running it

Under the make.fun harness, the sealed snapshot is provided at `/input/snapshot.json` and the program runs as-is. Locally, with a snapshot mounted at the same path:

```sh
node main.ts
```

The run is deterministic and uses no network: two runs on the same snapshot write identical bytes.

## Layout

- `main.ts` — the entry point, the kit starter runner.
- `lib/model.ts` — the valuation model and the farming plans.
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged.
- `dashboard/` — the page files.
- `screenshots/` — screenshots of the dashboard itself.
