# Token Launch Radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/yaoji114514/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/yaoji114514/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

An entry for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01): a program that ranks pre-token DeFi protocols by what their token may be worth at launch, and builds a dashboard showing the ranking, a per-protocol detail view, and a farming plan for each protocol.

## What it does

`main.ts` (Node 22, standard library only) reads a snapshot of the protocol universe at `/input/snapshot.json` and writes:

- `board.json` — the ranked board (226 rows on the kit snapshot: the 40 watchlist protocols plus 186 further pre-token protocols), each with an implied launch value and a 7-step farming plan.
- `data.js` — the dashboard's data, beside the page.
- `dashboard/` — the static dashboard page (sortable, filterable, searchable, with a per-protocol detail view).
- `screenshots/` — three screenshots of the dashboard, rendered from its own files.
- `dossier.json` — the submission dossier, built with `buildDossier` from `vendor/makefun-board.ts`.

## How the valuation works

The model fits a robust log-log regression of market cap on TVL over the already-traded protocols in the same snapshot (one outlier-trimming pass), then applies the fitted line to pre-token protocols, with multipliers for 7-day TVL growth and protocol age. No protocol list is hard-coded: every number is derived from the snapshot's own figures. On the kit snapshot the fit covers 114 protocols with R² 0.23, and the dashboard states the fit and its validation error plainly.

## How to run

Under the make.fun harness the program runs with `/input/snapshot.json` provided and writes to `/output`. Locally, with a snapshot at `/input/snapshot.json`:

```sh
node main.ts
```

`SCREENSHOTS.md` records how the screenshots were captured.

## Layout

- `main.ts` — entry point (the kit starter's runner, unchanged).
- `lib/model.ts` — valuation model and farming-plan generation.
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged.
- `dashboard/` — the dashboard page (`index.html`, `app.css`, `app.js`).
- `screenshots/` — the dashboard's own screenshots.
