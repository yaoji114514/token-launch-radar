# Screenshots

The three images in `screenshots/` are 1440x900 JPEGs rendered from the dashboard's own files — the `dashboard/` page plus the generated `data.js` — with Playwright 1.65.1 driving headless-shell Chromium.

- `1-board.jpg` — the ranked board view.
- `2-detail.jpg` — the Steakhouse Financial detail popup, showing the valuation breakdown, the farm economics and the plan steps.
- `3-filtered.jpg` — the Risk Curators category filter, showing 33 rows.

The files are about 117 KB, 141 KB and 118 KB, regenerated on the evening of 2026-11-18.

Two things worth knowing about how they were made: the headless-shell browser zip was fetched with a curl resume download, because Playwright's own downloader kept dropping the connection near 90%; and the capture script opens a fresh page for each view, because hash-only navigation does not re-run the page's init. The gate verifies the screenshots against the dashboard.
