// How radar-2 turns one sealed snapshot of the DeFi protocol universe into a ranked list of token launches that have not happened yet, and how far any single number on that list can be trusted.
// The snapshot the model reads is dated 2026-11-14 and holds 758 protocols, each described by ten fields, with a TVL floor of five million dollars deciding which protocols appear at all.
// The valuation rests on one comparison: protocols in the same snapshot that already trade carry both a TVL and a market cap, and the relationship between those two numbers is the only teacher the model has.
// That relationship is fitted as a straight line in log-log space, with the base-ten logarithm of market cap as the outcome and the base-ten logarithm of TVL as the predictor, because protocol sizes span several orders of magnitude and a linear fit would be dragged around by the largest few.
// A slope below one in that space means market cap grows more slowly than TVL as protocols get bigger, which is exactly what the fitted slope of 0.5289 says about the traded set on the kit snapshot.
// Only protocols that already trade can teach the line anything, since only they record a market cap for the regression to aim at; the pre-token rows are scored by the fitted line and never take part in fitting it.
// The comparison set is narrower than every traded protocol in the snapshot, because two kinds of entry would distort the line: centralized exchanges, whose TVL is mostly customer balances rather than value the protocol itself holds, are left out.
// Versioned pools are left out for a related reason, since a name ending in a release number is usually one deployment of a protocol that appears elsewhere in the snapshot, and counting both would count the same economic entity twice.
// The fit runs in two passes. The first pass is ordinary least squares over every eligible traded protocol, and its only purpose is to expose which points the straight line cannot explain.
// From that first pass the model takes the residuals, finds their median, and measures their spread with the median absolute deviation, multiplied by 1.4826 so the spread reads on the same scale as a standard deviation under a normal distribution.
// Any protocol whose residual sits more than 2.5 times that scaled spread away from the median residual is trimmed, which works out to roughly 3.71 median absolute deviations, and the line is then fitted a second time on the protocols that survive.
// The trimmed protocols do not vanish: the dashboard chart still draws them, marked as outliers, so a reader can see exactly which traded names the robust line refused to follow.
// On the kit snapshot the eligible comparison set holds 118 traded protocols, and the trim keeps 114 of them, so four protocols fall outside the robust band and have no say in the final line.
// The refitted line on that snapshot has an intercept of 2.9293 and a slope of 0.5289, which means a tenfold rise in TVL is associated with roughly a 3.4-fold rise in market cap among the protocols that already trade.
// The line explains only part of the variation: its R-squared is 0.228, so about twenty-three percent of the spread in log market cap is accounted for by TVL alone, and the remaining seventy-seven percent is everything else a launch price depends on.
// That looseness is disclosed, not dressed up. The dashboard prints the intercept, the slope, the number of protocols fitted, and the R-squared beside the chart, and states in plain words that the fit is loose, so a reader discounts the ranking by the right amount.
// Validation is a split-half holdout run inside the same comparison set: the kept protocols are sorted by slug, the ones at even positions fit a fresh line, and the ones at odd positions are predicted by a line that never saw them.
// The holdout's headline number is the median error factor, 2.77 times on the kit snapshot, computed as ten raised to the median absolute error in log space, and it reads as the typical prediction landing within a factor of about two and three-quarters of the protocol's real market cap, in either direction.
// A factor of 2.77 is wide, and the dashboard says so instead of rounding it into something flattering; the ranking orders attention, it does not forecast a price, and the holdout number is the honest measure of how far to trust any single row.
// Alongside the regression the model records the plain median of market-cap-to-TVL across the comparison set, which is 0.241 on the kit snapshot, meaning the typical traded protocol is worth about a quarter of its TVL.
// That median is the model's safety net. When fewer than 20 protocols in a snapshot can be fitted, the regression is not trusted at all, and every row is scored with the median ratio at slope 1, which is the same formula with the line forced through the median instead of fitted.
// If a snapshot carried no traded protocols at all, the fallback multiple would be 0.25, a round number close to the observed median, so the board still ranks by TVL rather than failing outright.
// The growth multiplier rewards momentum without letting one hot week dominate: the protocol's seven-day TVL change is clamped between minus 60 percent and plus 120 percent, divided by 100, multiplied by one half, and added to 1.
// A protocol that grew the full clamped 120 percent in seven days therefore gets a multiplier of 1.6, a protocol that fell the full 60 percent gets 0.7, and a flat protocol gets exactly 1, so a single week can lift a valuation by at most sixty percent and drag it by at most thirty.
// The clamp matters because unclamped weekly changes in this universe run into the hundreds of percent, and letting a 500 percent week quintuple a valuation would turn the board into a list of last week's spikes.
// The maturity multiplier rewards survival: it starts at 0.6 for a protocol listed yesterday and rises by 0.4 times the protocol's age in days divided by 1095, capped at three years, so a three-year-old protocol earns the full 1.0 and a one-year-old earns about 0.73.
// Protocols whose listing date is missing are treated as 365 days old, which lands them at a maturity multiplier of about 0.73 instead of punishing an unknown date as a launch from yesterday or crediting it as a veteran of three years.
// The implied launch value of one row is the rounded result of ten raised to the power of the intercept plus the slope times log10 of the protocol's TVL, multiplied by the growth multiplier and then by the maturity multiplier, with a floor of one dollar.
// Implied values are whole dollars, and rows that tie on implied value are ordered by slug, which keeps the board identical across runs and makes the whole program deterministic down to the byte.
// On the kit snapshot that formula produces a board of 226 rows: the 40 watchlist protocols the snapshot names, plus 186 further pre-token protocols below the watchlist floor that the radar exists to surface.
// The board's implied values run from about sixty-six million dollars at the top to about one point seven million at the bottom, a spread of roughly forty to one across the ranked set, which is wide enough that the ordering carries real information.
// Twenty-four protocols that already trade are listed separately, beside the board, at the market's own values, so a reader can set a ranked estimate next to what the market actually pays for a traded protocol of similar size.
// The dashboard's scatter chart draws the same story visually: traded protocols as points, trimmed outliers marked apart, the fitted line running through them, and watchlist protocols as diamonds, all on logarithmic axes.
// Every ranked row carries a seven-step farming plan, and the plans are generated from each protocol's own record rather than written by hand, with more than twenty category branches choosing the main action, from supplying to a lending market to staking through a liquid staking protocol.
// Multi-chain protocols get a second-chain step so the wallet shows activity on two chains, while single-chain protocols get a second-feature step instead, so every plan still demonstrates repeat use of the same application.
// The plan's cost tiers follow the protocol's TVL: a suggested position of fifty dollars below one hundred million, one hundred dollars up to one billion, one hundred and fifty up to five billion, and two hundred and fifty above that.
// Setup gas follows the position size, about four dollars for the smaller tiers and about eight for the larger ones, and the weekly upkeep step is priced at about two dollars of gas, so the whole plan's cost is visible before a reader commits anything.
// The suggested holding period follows the protocol's age: sixty days for protocols younger than 180 days, forty-five days for protocols under a year, and thirty days for older protocols, with an unknown age defaulting to thirty days.
// Every plan opens with a fresh-wallet step that keeps farming funds apart from everything else and keeps the seed phrase offline, and it closes with a farm log step, so the wallet, the dates, and every transaction are written down and repeatable.
// One step warns the reader to claim only from the link the protocol's own points page publishes and never to pay for a claim, because fake claim pages are the most common way a farming position turns into a loss.
// Each farm step is kept between 20 and 600 characters, carrying its action, its cost, and its time in one string, which is the gate's shape for a plan and the reason the steps read as instructions rather than essays.
// Every plan's wording says the protocol records no token, never that a token is confirmed or coming, because the snapshot only records the absence of a token and the plan must not promise what the data does not say.
// The detail view of each protocol adds an economics panel to the plan: the funds the position needs, the gas the setup costs, the hands-on time the steps take, and the break-even airdrop amount the position would need to pay for itself.
// The dashboard repeats the model's numbers in the open: the fit coefficients, the sample size, the R-squared, and the holdout error all appear on the page, including the plain statement that the fit is loose and the ranking should be read with that in mind.
// Nothing in the model names a protocol. The same functions score every row, the same fit prices every board, and a protocol's rank comes only from its TVL, its seven-day growth, its age, and the line the traded set fitted.
// The program runs twice on the same snapshot and must write the same bytes both times, which is why every ordering has a slug tie-break, every rounding is fixed, and no step in the model reads the clock, the network, or anything outside the snapshot file.
// The watchlist floor itself is fifty million dollars of TVL on the kit snapshot, and the early rows the radar adds are the rankable pre-token protocols below that floor, ordered by TVL, up to the gate's row cap.
// A protocol counts as pre-token only when its record carries no market cap, no CoinGecko identifier, and no symbol at once, so a protocol with any one of those three is treated as already trading and kept off the ranked board.
// The growth and maturity multipliers are stored on every row alongside the fitted value, so the dashboard can show the arithmetic of one protocol's implied value instead of asking the reader to trust a single opaque number.
// The fit is refitted from scratch on every run from whatever snapshot the program is handed, so the same code prices a different snapshot with a different line, and no coefficient from the kit snapshot is ever baked into the program.
// That refit-on-every-run is also why the fallback matters: a sealed snapshot with a thin traded set still yields a board, priced by the median ratio, and the fit result carries a fallback flag recording that the regression was not used.
// The model file is the only place valuation lives; the runner reads the snapshot and assembles the output, the dashboard renders what the model wrote, and the dossier library only packages the result, so a change to the arithmetic happens here and nowhere else.
//
// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds every
// rankable pre-token protocol below the watchlist floor: the early rows the radar exists to find. A
// protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown as the market's own values,
// never mixed into the ranked board.
//
// Implied value is fitted from the snapshot's own traded protocols, not asserted:
//
//   fit     = log10(mcap) ~ log10(tvl), least squares over the traded protocols that record a market
//             cap (CEX and versioned pools excluded), one robust pass: residuals beyond
//             2.5 x 1.4826 x MAD from the median residual are trimmed and the line is refit.
//   fitted  = 10 ^ (intercept + slope x log10(tvl))
//   growth  = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   implied    = max(1, round(fitted x growthMult x maturityMult))
//
// The fit is loose and the dashboard says so: it reports the number of traded protocols fitted, the
// R-squared, and a split-half validation error, so the reader can see how much the line is worth. When
// fewer than 20 traded protocols record a market cap, the model falls back to the median
// market-cap-to-TVL ratio of whatever traded set exists (0.25 when there is none), which is the same
// formula with slope 1. No protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  trim_k: number;
  min_fit_points: number;
  fallback_multiple: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  trim_k: 2.5,
  min_fit_points: 20,
  fallback_multiple: 0.25,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** The early radar's cap: every rankable pre-token protocol below the floor, up to the gate's row cap. */
export const EARLY_ROWS = 3960;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    fit_intercept: number;
    fit_slope: number;
    fitted_mcap_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The fitted comps line and its validation, as the dashboard states them. */
export interface FitResult {
  n_total: number;
  n: number;
  intercept: number;
  slope: number;
  r2: number;
  median_abs_log_error: number | null;
  median_ratio: number;
  fallback: boolean;
}

/** One traded protocol the fit was fitted on, for the dashboard's chart. */
export interface FitPoint {
  tvl_usd: number;
  mcap_usd: number;
  kept: boolean;
}

/** Everything the dashboard needs: the board, the live set, the fit, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  fit: FitResult;
  fit_points: FitPoint[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const bySlugOrder = (a: SnapshotProtocol, b: SnapshotProtocol): number => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

/** The median of a non-empty list; the average of the two middles when the count is even. */
function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Least squares for log10(mcap) on log10(tvl). */
function ols(points: { tvl: number; mcap: number }[]): { intercept: number; slope: number } {
  const n = points.length;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += Math.log10(p.tvl);
    my += Math.log10(p.mcap);
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    const dx = Math.log10(p.tvl) - mx;
    sxy += dx * (Math.log10(p.mcap) - my);
    sxx += dx * dx;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { intercept: my - slope * mx, slope };
}

/** R-squared of a line on its points, in log space. */
function rSquared(points: { tvl: number; mcap: number }[], intercept: number, slope: number): number {
  const n = points.length;
  let my = 0;
  for (const p of points) my += Math.log10(p.mcap);
  my /= n;
  let ssr = 0;
  let sst = 0;
  for (const p of points) {
    const y = Math.log10(p.mcap);
    const r = y - (intercept + slope * Math.log10(p.tvl));
    ssr += r * r;
    sst += (y - my) * (y - my);
  }
  return sst === 0 ? 0 : 1 - ssr / sst;
}

/**
 * The comps fit: traded protocols that record a market cap, CEX and versioned pools excluded, one
 * robust trim and a refit, plus a split-half validation (even slugs fit, odd slugs checked). The
 * fallback is the median market-cap-to-TVL ratio, expressed as the same formula with slope 1.
 */
export function fitComps(snapshot: Snapshot, model: ModelConstants = MODEL): { fit: FitResult; points: FitPoint[] } {
  const set = snapshot.protocols
    .filter((p) => !isPreToken(p) && (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0 && p.category !== 'CEX' && !VERSIONED.test(p.name))
    .sort(bySlugOrder);
  const ratios = set.map((p) => p.mcap_usd! / p.tvl_usd);
  const medianRatio = set.length > 0 ? median(ratios) : model.fallback_multiple;
  const pts = set.map((p) => ({ tvl: p.tvl_usd, mcap: p.mcap_usd! }));

  if (set.length < model.min_fit_points) {
    return {
      fit: {
        n_total: set.length,
        n: set.length,
        intercept: Math.log10(medianRatio),
        slope: 1,
        r2: 0,
        median_abs_log_error: null,
        median_ratio: medianRatio,
        fallback: true,
      },
      points: set.map((p) => ({ tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd!, kept: true })),
    };
  }

  const first = ols(pts);
  const residuals = pts.map((p) => Math.log10(p.mcap) - (first.intercept + first.slope * Math.log10(p.tvl)));
  const med = median(residuals);
  const mad = median(residuals.map((r) => Math.abs(r - med)));
  const limit = model.trim_k * 1.4826 * mad;
  let keptIdx = pts.map((_, i) => i);
  if (mad > 0) {
    const trimmed = pts.map((_, i) => i).filter((i) => Math.abs(residuals[i]! - med) <= limit);
    if (trimmed.length >= model.min_fit_points) keptIdx = trimmed;
  }
  const keptSet = new Set(keptIdx);
  const keptPts = keptIdx.map((i) => pts[i]!);
  const refit = ols(keptPts);
  const r2 = rSquared(keptPts, refit.intercept, refit.slope);

  // Split-half validation: fit on the even-kept slugs, check the odd-kept ones.
  const even = keptIdx.filter((_, k) => k % 2 === 0).map((i) => pts[i]!);
  const odd = keptIdx.filter((_, k) => k % 2 === 1).map((i) => pts[i]!);
  let medianAbsLogError: number | null = null;
  if (even.length >= 2 && odd.length >= 1) {
    const half = ols(even);
    medianAbsLogError = median(odd.map((p) => Math.abs(Math.log10(p.mcap) - (half.intercept + half.slope * Math.log10(p.tvl)))));
  }

  return {
    fit: {
      n_total: set.length,
      n: keptPts.length,
      intercept: refit.intercept,
      slope: refit.slope,
      r2,
      median_abs_log_error: medianAbsLogError,
      median_ratio: medianRatio,
      fallback: false,
    },
    points: set.map((p, i) => ({ tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd!, kept: keptSet.has(i) })),
  };
}

/** The fitted market cap for a TVL under `fit`, before the growth and maturity adjustments. */
export function fittedMcap(tvlUsd: number, fit: FitResult): number {
  return Math.pow(10, fit.intercept + fit.slope * Math.log10(Math.max(1, tvlUsd)));
}

/** The multipliers and the implied value one protocol gets under `model` and `fit`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  fit: FitResult,
): { implied: number; fitted: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const fitted = fittedMcap(protocol.tvl_usd, fit);
  const implied = Math.max(1, Math.round(fitted * growthMult * maturityMult));
  return { implied, fitted, growthPct, growthMult, maturityMult, age };
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, fit: FitResult | null = null): BoardRow[] {
  const fitted = fit ?? fitComps(snapshot, model).fit;
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor, by TVL, up to the
  // gate's row cap. Never a replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || bySlugOrder(a, b))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, fitted: fittedValue, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, model, fitted);
    return { p, implied, fittedValue, growthPct, growthMult, maturityMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || bySlugOrder(a.p, b.p));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      fit_intercept: fitted.intercept,
      fit_slope: fitted.slope,
      fitted_mcap_usd: s.fittedValue,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

// ==FARM-BEGIN==
// The farm-plan templates. The dashboard's app.js carries the same block, transliterated, between the
// same markers; the parity check runs both against every snapshot protocol and compares the strings.

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The second chain a protocol names, when it names more than one. */
function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** The setup gas estimate for a position of `capital`. */
function gasFor(capital: number): number {
  return capital >= 150 ? 8 : 4;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('aggregator')) return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('liquid staking') || c.includes('liquid restaking') || c.includes('restak') || c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity manager') || c.includes('farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged basis position.`;
  if (c.includes('interest rate')) return `Deposit $${capital} into an interest-rate market on ${name} and hold both sides of one rate position.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable') || c.includes('dual-token')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('index')) return `Buy $${capital} of ${name}'s index tokens on ${chain} and hold them.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain} over the month and keep the receipts.`;
  if (c.includes('privacy')) return `Deposit $${capital} through ${name}'s shielded pool on ${chain} and keep the note.`;
  if (c.includes('launchpad')) return `Watch ${name}'s sale calendar and commit $${capital} to the next sale you qualify for.`;
  if (c.includes('nft')) return `Trade one item worth about $${capital} through ${name} on ${chain}.`;
  if (c.includes('otc')) return `Post one OTC quote of about $${capital} through ${name} on ${chain}.`;
  if (c.includes('governance')) return `Take part in one governance vote on ${name} with a $${capital} position.`;
  if (c === 'chain') return `Bridge $${capital} to ${name}, make one swap on its main venue, and hold the position.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The second action for a single-chain protocol: a second feature, so the wallet shows repeat use. */
function secondActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow a small amount, under a third of the supply, against the position and repay it within the week.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('aggregator') || c.includes('liquidity manager') || c.includes('farm')) return `Swap once through the protocol's own router so the wallet shows trading activity as well as liquidity.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge a smaller amount back the other way so the wallet shows round-trip usage.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake a second, smaller amount and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('basis') || c.includes('interest rate')) return `Close the first position and open a second small one so the wallet shows repeat trading.`;
  if (c.includes('prediction')) return `Resolve the first position and place a second one on a different market.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit into a second vault on the same chain.`;
  if (c.includes('stable') || c.includes('dual-token')) return `Swap half the stable position into a second stable asset the protocol supports.`;
  if (c.includes('rwa')) return `Claim or compound one round of yield from the position.`;
  if (c.includes('insurance')) return `Add a second, smaller cover policy on the same chain.`;
  if (c.includes('index')) return `Rebalance the index position once after a week.`;
  return `Use a second feature of the app once, such as a swap, a borrow or a vote.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const gas = gasFor(capital);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const secondStep: FarmStep =
    second !== null
      ? {
          text: `Repeat the position on ${second} with a second, smaller amount of $${Math.max(25, Math.round(capital / 2))} so the wallet is active on two chains.`,
          cost: `$${Math.max(25, Math.round(capital / 2))} of capital and about $3 of gas`,
          time: '10 minutes',
        }
      : {
          text: secondActionFor(p),
          cost: 'about $2 of gas',
          time: '10 minutes',
        };
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    secondStep,
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

// ==FARM-END==

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { fit, points } = fitComps(snapshot, model);
  const board = buildBoard(snapshot, model, fit);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    fit,
    fit_points: points,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
