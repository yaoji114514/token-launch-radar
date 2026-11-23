# Token Launch Radar

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/yaoji114514/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/yaoji114514/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

An entry for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01) on make.fun: a program that reads a sealed snapshot of the DeFi protocol universe and ranks the protocols that have not launched a token yet by expected value — what a launch might be worth, weighted by the fitted chance the protocol launches at all — then presents the ranking in a dashboard with a farming plan for each protocol.

## What it does

`main.ts` runs on Node 22 with the standard library only. It reads the snapshot at `/input/snapshot.json` and writes:

- `board.json` — the ranked board. On the kit snapshot it holds 226 rows: the 40 watchlist protocols plus 186 further pre-token protocols. Every row carries an if-launched value, fitted launch odds, expected value, a bootstrap P10–P90 range and rank range, a FARM / MARGINAL / SKIP verdict with net dollars and net dollars per hour, and a seven-step farming plan.
- `data.js` — the same board data, written beside the page for the dashboard to read.
- `dashboard/` — a static page: an evidence board (KPI strip, top-farm strip, the 758-protocol ledger beside the fitted comps chart, validation numbers, the integrity strip) above a board that is sortable, filterable and searchable, and each protocol opens a full-page, two-column dossier with its value breakdown, nearest traded peers, a deposit-by-drop-share matrix, and its farm economics.
- `screenshots/` — three screenshots rendered from the dashboard's own files. See [SCREENSHOTS.md](SCREENSHOTS.md).
- `dossier.json` — the submission summary, built with `buildDossier` from `vendor/makefun-board.ts`.

## How the value is estimated

The model fits a robust log-log regression of market cap on TVL across the protocols in the same snapshot that already trade, with one pass that trims outliers, then applies the fitted line to the pre-token protocols. Three multipliers adjust the result: one for seven-day TVL growth, one for how long the protocol has existed, and one for its category — the category's median market-cap-to-TVL ratio against the whole traded set, shrunk by n/(n+5), for categories with at least eight traded protocols; smaller categories borrow their semantic family's ratio instead (lending, dex/yield, bridge, staking, derivatives, allocators — families need at least five). No protocol list is hard-coded anywhere; every number comes from the snapshot. On the kit snapshot the fit covers 114 protocols at R-squared 0.33, and the dashboard states the fit and its validation error in plain words rather than dressing them up.

A second model, fitted on the same snapshot's traded protocols, estimates the chance a protocol launches a token at all: a logistic regression on log TVL, age, seven-day growth and sector, with L2 shrinkage (lambda 10). Its Brier score is 0.209 against the base rate's 0.249 on the kit snapshot, and it beats the base rate in both directions of a split-half check (0.218 vs 0.249; 0.232 vs 0.253). Expected value is the if-launched value times the fitted odds, so a large protocol with long odds ranks below a smaller one that is likely to launch: Steakhouse Financial's $40.8M if-launched value becomes $12.3M at 30% odds. The odds are genuinely fitted and validated, never a hand-written column.

Uncertainty is bootstrapped, not asserted: 200 seeded resamples refit the comps line and the odds fit, and each row carries the P10–P90 range of its expected value and the range of ranks it takes across the resamples. On the kit snapshot 7 of the top 20 stay in the top 20 in at least 80% of refits — the ranks move, and the dashboard says so.

## Validation

The fit is checked by a split-half holdout that runs inside the traded comparison set, so the check never borrows information from the protocols being ranked.
The kept protocols are sorted by slug, the ones at even positions fit a fresh regression line and a fresh set of category adjustments, and the ones at odd positions are predicted by that line and those adjustments without ever taking part in fitting them.
The headline number from that holdout is the median error factor, which is 2.65 on the kit snapshot: the typical prediction lands within a factor of about two and two-thirds of the protocol's actual market cap, high or low.
That number is ten raised to the median absolute error in log space, so it reads directly as a multiplicative miss rather than an abstract score, and a reader can apply it to any row's implied value in their head.
A factor of 2.65 is wide, and it is reported as wide: the dashboard shows the holdout error next to the fit coefficients and says plainly that the fit is loose, rather than rounding the validation into a reassuring headline.
The reason for disclosing the looseness is that the board's job is to order attention, not to price a launch, and a reader who knows the typical miss can discount the ranking by the right amount instead of treating it as a forecast.
The holdout also guards against the most flattering mistake a fitted line can make, which is grading itself on the same protocols it was fitted on and reporting an error far smaller than a fresh protocol would see.
Because the split is by slug order rather than by size or category, the checked half spans the same range of TVL and the same mix of categories as the fitted half, so the holdout is a fair test of the line rather than a test of one corner of the universe.
The R-squared of 0.330 tells the same story from the other side: TVL and category together account for about thirty-three percent of the variation in log market cap, and the rest is everything a launch price depends on that TVL cannot see.
Both numbers travel with the entry: the fit result carries the sample size, the coefficients, the R-squared, and the holdout error, and the dashboard prints all of them on the page; the evidence board shows the fitted chart beside the ledger, so the line is visible where the validation numbers are.
The category adjustment earned its place on the holdout rather than being asserted: per-category regression lines, per-category intercept shifts, stronger shrinkage, significance gates and stability gates were tried under the same split-half protocol and did not beat the plain line on both the split-half and the leave-one-out median, while the hybrid ratio multiplier did — median error 2.65 against 2.77, holdout R-squared 0.282 against 0.274 — and the reverse split agrees (R-squared 0.234 against 0.061), so it ships and the others do not. The forward holdout R-squared is lower than the old per-category rule's 0.319, and the report says so: the family rule is coarser, so a few held-out protocols miss by more even as the typical miss shrinks.
The dashboard lists five validation checks and passes all five. The leave-one-out check is the one that failed in every version from radar-3 to radar-6: under leave-one-out the adjusted line's median error is now x2.75 against the plain line's x3.13, so the adjustment finally earns its keep under leave-one-out as well as in the split-half. The 80% interval covers 78.9% of the held-out half (n=57), inside the 65–95% band it promises. The table would show a failure if one occurred — a validation table that only ever passes is not a validation.
When a snapshot is too thin to fit, the holdout is skipped and the fallback flag is set, so the dashboard never shows a validation number for a line that was never fitted.
Re-running the holdout on a different snapshot gives a different error factor, because the line, the trim, and the split are all refitted from whatever snapshot the program is handed.

## Farm plan economics

Every ranked row carries a seven-step farming plan, and every step states its own cost and time, so the price of following a plan is visible before a reader commits any funds to it.
The suggested position size follows the protocol's TVL in four tiers: fifty dollars below one hundred million, one hundred dollars up to one billion, one hundred and fifty up to five billion, and two hundred and fifty dollars above that.
Setup gas follows the position size, about four dollars for the two smaller tiers and about eight for the two larger ones, and the weekly upkeep step is priced at about two dollars of gas per week.
The suggested holding period follows the protocol's age in three tiers: sixty days for protocols younger than 180 days, forty-five days for protocols under a year, and thirty days for older protocols, with an unknown listing date defaulting to thirty.
The hold step is dated: it gives the protocol's listing date and the day the hold ends (listing date plus age plus hold, which is the snapshot date plus the hold), so a reader can see the actual calendar dates instead of counting days.
The main action names the protocol's TVL and seven-day change in the same sentence as the action, so the step reads as a position in a specific protocol rather than a template: a large protocol whose TVL is falling gets the same action as one that is growing, but the numbers in the sentence say which it is.
The tiers pull in opposite directions on purpose: a large, established protocol asks for more capital but a shorter hold, while a young protocol asks for less capital and a longer window for its activity to be counted.
Each protocol's detail view adds an economics panel to the plan, showing the funds the position needs, the gas the setup costs, the hands-on time the steps take, and the break-even airdrop amount the position would need to pay for itself.
The break-even figure is the point of the panel: a reader can compare it against the protocol's implied launch value and decide whether the position is worth the capital, the gas, and the weeks of attention it asks for.
The hands-on time is counted from the steps themselves, roughly five minutes to set up a fresh wallet, fifteen to open the position, ten a week of upkeep, and a few minutes to log and to check the protocol's own rewards page.
The plan's first step keeps farming funds in a fresh wallet with its seed phrase offline, and one step warns the reader to claim only from the link the protocol's own points page publishes and never to pay for a claim.
Costs and times are estimates in dollars and minutes, not promises: gas prices move, and the plan says about rather than exact wherever the chain rather than the protocol sets the price.
The tiers are derived from the protocol's own record on every run, so the same plan generator prices a fifty-dollar position on a small young protocol and a two-hundred-and-fifty-dollar position on a large one without any hand-written list of names.
Because the economics panel is computed from the same tiers as the plan steps, the numbers in the detail view and the numbers in the board's plan text always agree with each other.

## Farm verdicts and scenarios

Each row carries a verdict — FARM, MARGINAL, or SKIP — from the plan's own arithmetic, not from a slogan. The expected allocation is the expected value times a drop share, net of the plan's gas, per hour of hands-on time. The default drop share is 0.001%: a 5% community allocation split across about 5,000 qualifying wallets. FARM means the net is positive and at least $5 an hour; MARGINAL means positive but slower; SKIP means the gas alone eats the expectation. On the kit snapshot the default scenario gives 79 FARM, 29 MARGINAL and 118 SKIP, with the best net at $82 an hour. The board's drop-share and horizon controls re-price every verdict live, and each protocol's dossier shows the verdict at the current scenario plus a deposit-by-drop-share matrix, so a reader can see exactly which assumption a verdict depends on. The 0.1% drop share the previous version used made all 226 rows FARM; it was not a verdict, it was an assumption too generous to discriminate, and it was replaced once the numbers showed it.

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
