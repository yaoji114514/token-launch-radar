# Screenshots: regenerated from the built dashboard (2026-11-18)

The three JPEGs in `screenshots/` are real captures of this entry's dashboard,
taken with the headless-shell Chromium via `../shots/capture.mjs`:

- `1-board.jpg` — the ranked board (226 rows)
- `2-detail.jpg` — the detail view for the rank-1 protocol
- `3-filtered.jpg` — the board filtered to the most common category

All are 1440x900 JPEG, each under the 512 KiB cap. The capture script picks the
detail slug (rank 1) and the filtered category (most common on the board) from
`board.json`, so it stays correct if the sealed snapshot differs from the kit
snapshot. It uses a fresh page per view: a hash-only navigation is a
same-document navigation and would not re-run the dashboard's init.

How the browser was obtained: `npx playwright install` failed repeatedly (the
CDN connection dropped near 90% of the 199 MiB download), so the headless-shell
zip was fetched with `curl -C - --retry` (resume across dropped connections)
from the URL in the install log, verified with `unzip -t`, and placed at
`~/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/`
(the directory name Playwright 1.65 expects). The VM's `/opt/meta-chromium/chrome`
cannot be launched by Playwright (exits with code 13); do not rely on it.

To regenerate: `cd ../shots && node capture.mjs ../out ../entry/screenshots`,
then re-run `main.ts` into a CLEAN output directory (main.ts copies files in
but never deletes stale ones — re-running into a dirty `out/` leaves old
screenshots behind and fails the gate) and re-run `../verify/gate.mjs`.
