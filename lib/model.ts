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
//   category   = the protocol's category's median market-cap-to-TVL ratio against the kept set's
//             global median, in log10 and shrunk by n/(n+5): its own when the category has at
//             least 8 traded comps, else its semantic family's (lending, dex/yield, bridge,
//             staking, derivatives, allocators — families need at least 5 comps); categories with
//             neither get no adjustment (multiplier 1). Radar-7, earned on the holdout:
//             split-half median error x2.65 against the plain line's x2.77, and leave-one-out
//             x2.75 against x3.13 — the LOO check passes for the first time. The family idea was
//             tested in radar-7 (verify/model_experiment_v6.mjs) after radar-5 (stronger shrinkage,
//             higher minN, winsorised, damped, pooled, residual-shift, multi-feature and ridge
//             variants) and radar-6 (robust estimators, empirical-Bayes shrinkage, quadratic
//             logTVL, per-category slopes, chain count, age x growth, ensembles, significance
//             gates, stability gates, hinge lines, bagged adjustments) all failed to flip LOO
//             without losing the split-half win. Costs, stated honestly: forward split-half
//             R-squared 0.282 (plain 0.274, old C(3,5) 0.319) and 80% coverage 45/57, inside
//             the 65-95% band.
//   odds    = P(the protocol has launched), a logistic fit on the snapshot's own protocols
//             (CEX and versioned pools excluded): log10(tvl), log1p(age), clamped 7d growth and
//             one-hot categories with at least 15 protocols, L2 lambda 10, IRLS. Radar-4, earned
//             on the holdout: split-half Brier 0.218 / 0.232 against the base-rate baseline's
//             0.249 / 0.253. The odds are a fitted propensity from one cross-section, not a
//             forecast: the dashboard says so and shows the Brier.
//   ifLaunched = fitted x growthMult x maturityMult x categoryMult
//   expected   = max(1, round(ifLaunched x odds)) — the board ranks by expected value, the
//             value if launched weighted by the fitted chance it launches at all.
//
// The fit is loose and the dashboard says so: it reports the number of traded protocols fitted, the
// R-squared, and a split-half validation error, so the reader can see how much the line is worth. When
// fewer than 20 traded protocols record a market cap, the model falls back to the median
// market-cap-to-TVL ratio of whatever traded set exists (0.25 when there is none), which is the same
// formula with slope 1. No protocol name is ever special-cased: the same function scores every row.
//
// Uncertainty is bootstrapped, not asserted: 200 seeded resamples refit the comps line (with its
// category adjustments) and the odds fit, and each board row carries the P10-P90 range of its
// expected value and the range of ranks it takes across the resamples. Farm verdicts come from the
// plan's own arithmetic: expected allocation = expected value x drop share, where the default drop
// share 0.001% is a 5% community allocation split across ~5,000 qualifying wallets — a scenario,
// stated on the board and changeable there — net of the plan's gas, per hour of hands-on time.
// FARM when the net is positive and at least $5 an hour, MARGINAL when positive but slower, SKIP
// when the gas alone eats the expectation. The dashboard shows the arithmetic; no verdict is a slogan.
// The farm plans carry snapshot-derived specifics (radar-5): the main action names the protocol's
// TVL and 7d change, and the hold step is dated with the listing date and the day the hold ends
// (listing date + age + hold, which is the snapshot date + hold).

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
  calibrated?: true;
  fit_maturity?: true;
  growth_exponent?: number;
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

export const CALIBRATED_MODEL: ModelConstants = {
  ...MODEL,
  calibrated: true,
  growth_exponent: 0.5,
  maturity_floor: 1,
  maturity_range: 0,
};

export const MATURITY_MODEL: ModelConstants = {
  ...CALIBRATED_MODEL,
  fit_maturity: true,
  maturity_floor: MODEL.maturity_floor,
  maturity_range: MODEL.maturity_range,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-7';

/** The odds model's constants: the fitted launch propensity. */
export const ODDS = {
  /** One-hot categories need at least this many protocols in the fit set. */
  min_category_n: 15,
  /** L2 penalty on the standardised coefficients (the intercept is never penalised). */
  lambda: 10,
  /** IRLS iterations at most; the fit stops earlier when the step is tiny. */
  max_iters: 25,
  /** Bootstrap resamples for the per-row value and rank ranges. */
  bootstrap_reps: 200,
  /** The bootstrap's seed: fixed, so a rebuild is byte-identical. */
  bootstrap_seed: 20261114,
  /** The scenario's default drop share: the fraction of expected value a farmer is assumed to receive. */
  default_drop_share: 0.00001,
  /** A verdict is FARM when the net is positive and at least this much per hour. */
  farm_min_net_per_hour: 5,
};

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
  /** Expected value: the if-launched value weighted by the fitted launch odds. The board ranks by this. */
  implied_value_usd: number;
  /** The value if the protocol launches, before the odds weight it. */
  implied_if_launched_usd: number;
  /** The fitted launch probability (0..1). */
  launch_odds: number;
  /** Bootstrap P10 / P90 of the expected value over 200 seeded refits. */
  value_p10_usd: number;
  value_p90_usd: number;
  /** The best / worst rank the row takes across the 200 bootstrap refits. */
  rank_low: number;
  rank_high: number;
  /** The farm verdict at the default scenario, backed by the plan's own arithmetic. */
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  /** Expected allocation (expected value x drop share) minus the plan's gas, at the default scenario. */
  net_usd: number;
  /** The net per hour of hands-on time, at the default scenario. */
  net_per_hour_usd: number;
  model: {
    fit_intercept: number;
    fit_slope: number;
    fitted_mcap_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    category_multiplier: number;
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
  implied_if_launched_usd: number;
  launch_odds: number;
  value_p10_usd: number;
  value_p90_usd: number;
  rank_low: number;
  rank_high: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  net_usd: number;
  net_per_hour_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_multiplier: number;
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
  maturity_fit?: { floor: number; range: number; n: number };
  /** Per-category log10 adjustment to the fitted value (radar-7 hybrid): the category's own
   *  median market-cap-to-TVL ratio against the global median, shrunk by n/(n+5), when the
   *  category has at least 8 traded comps in the kept set — else its semantic family's
   *  adjustment, families needing at least 5 comps. Categories absent here get no adjustment. */
  category_adjust: Record<string, number>;
}

/** One traded protocol the fit was fitted on, for the dashboard's chart and the detail's peers. */
export interface FitPoint {
  tvl_usd: number;
  mcap_usd: number;
  kept: boolean;
  slug: string;
  name: string;
  category: string | null;
}

/** The fitted launch-odds model, as the dashboard states it. */
export interface OddsFit {
  /** Protocols in the fit set (CEX and versioned pools excluded). */
  n: number;
  /** The share of the fit set that has launched. */
  base_rate: number;
  /** Standardised logistic coefficients, intercept first, then logTVL, logAge, growth, one-hot categories. */
  beta: number[];
  /** The feature means and standard deviations the standardisation used (intercept entry 0 / 1). */
  mean: number[];
  sd: number[];
  /** The one-hot categories, in coefficient order after logTVL, logAge, growth. */
  categories: string[];
  /** In-sample Brier score of the shipped fit. */
  brier: number;
  /** Brier of predicting the base rate for every protocol. */
  base_brier: number;
  /** Split-half Brier, even slugs fit and odd checked. */
  brier_fwd: number;
  base_brier_fwd: number;
  /** Split-half Brier, the reverse direction. */
  brier_rev: number;
  base_brier_rev: number;
  /** The raw-unit coefficients, intercept first, for the model panel's reading. */
  raw_beta: number[];
}

/** The validation the dashboard shows, all of it out-of-sample where it can be. */
export interface ValidationStats {
  /** Leave-one-out median error of the shipped (category-adjusted) comps line, as a factor. */
  loo_median_factor: number | null;
  /** Leave-one-out median error of the plain line, same protocols, for the comparison. */
  loo_plain_factor: number | null;
  /** Split-half median error of the shipped line, as a factor (the fit's own number). */
  split_half_factor: number | null;
  /** Split-half median error of the plain line, for the comparison. */
  split_half_plain_factor: number | null;
  /** Share of the odd half whose market cap falls inside the even half's 80% interval. */
  coverage_80: number | null;
  /** Protocols in the odd half the coverage is measured on. */
  coverage_n: number;
  /** How many of the listed validation checks pass. */
  checks_passed: number;
  /** How many validation checks are listed. */
  checks_total: number;
}

/** One mutually exclusive group of the snapshot's 758 protocols, for the ledger strip. */
export interface LedgerGroup {
  label: string;
  count: number;
  detail: string;
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
  /** The fitted launch-odds model. */
  odds: OddsFit;
  /** The out-of-sample validation the evidence board shows. */
  validation: ValidationStats;
  /** The census of all 758 snapshot protocols, in mutually exclusive groups. */
  ledger: LedgerGroup[];
  /** The sha256 of board.json as written (main.ts fills this in); the board strip shows its first 16 hex chars. */
  board_sha256: string;
  /** The default farm scenario the board's verdicts use. */
  scenario: { drop_share: number; farm_min_net_per_hour: number };
  /** How many board rows the default scenario calls FARM. */
  farmable_rows: number;
  /** The best net per hour on the board, at the default scenario. */
  best_net_per_hour_usd: number;
  /** Top-20 rows that stay in the top 20 in at least 80% of the 200 bootstrap refits. */
  top20_stable_count: number;
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

/**
 * The comps fit: traded protocols that record a market cap, CEX and versioned pools excluded, one
 * robust trim and a refit, plus a split-half validation (even slugs fit, odd slugs checked). The
 * fallback is the median market-cap-to-TVL ratio, expressed as the same formula with slope 1.
 *
 * Radar-7 adds one category adjustment, earned on the holdout, not asserted: for each category
 * with at least 8 traded comps in the kept set, the log10 of the category's median
 * market-cap-to-TVL ratio against the kept set's global median ratio, shrunk by n/(n+5);
 * smaller categories take their semantic family's adjustment instead (families need at least
 * 5 comps). A protocol's fitted value is multiplied by 10 to that adjustment. The validation
 * fits the line AND the adjustments on the even half and checks the odd half, so the reported
 * error is the shipped model's error: on this snapshot the split-half median error is x2.65
 * against the plain line's x2.77, the holdout R-squared 0.282 against 0.274, and the reverse
 * split agrees (R-squared 0.234 against 0.061, mean error down in both directions) — and
 * leave-one-out is x2.75 against the plain line's x3.13, so the LOO check passes for the
 * first time. The adjustment is large for two families — bridges x2.98, staking x0.22 — and
 * a category with neither its own nor a family adjustment, or a protocol with no category,
 * gets no adjustment at all.
 */
export function fitComps(snapshot: Snapshot, model: ModelConstants = MODEL): { fit: FitResult; points: FitPoint[] } {
  const set = tradedComps(snapshot);
  const ratios = set.map((p) => p.mcap_usd! / p.tvl_usd);
  const medianRatio = set.length > 0 ? median(ratios) : model.fallback_multiple;
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
        category_adjust: {},
      },
      points: set.map((p) => ({ tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd!, kept: true, slug: p.slug, name: p.name, category: p.category })),
    };
  }

  const keptProtocols = keptComps(snapshot, model, set);
  const keptSet = new Set(keptProtocols);
  const refit = fitCompLine(keptProtocols, snapshot.as_of, model);

  // R-squared of the shipped (adjusted) line on the kept set.
  const adjustedR2 = (() => {
    let my = 0;
    for (const p of keptProtocols) my += Math.log10(p.mcap_usd!);
    my /= keptProtocols.length;
    let ssr = 0, sst = 0;
    for (const p of keptProtocols) {
      const y = Math.log10(p.mcap_usd!);
      const r = y - validationPrediction(p, refit, snapshot.as_of, model, !!model.calibrated, 0);
      ssr += r * r;
      sst += (y - my) * (y - my);
    }
    return sst === 0 ? 0 : 1 - ssr / sst;
  })();

  // Split-half validation of the shipped model: fit the line AND the adjustments on the even-kept
  // slugs, check the odd-kept ones.
  const even = keptProtocols.filter((_, k) => k % 2 === 0);
  const odd = keptProtocols.filter((_, k) => k % 2 === 1);
  let medianAbsLogError: number | null = null;
  if (even.length >= 2 && odd.length >= 1) {
    const half = fitCompLine(even, snapshot.as_of, model);
    medianAbsLogError = median(odd.map((p) => Math.abs(Math.log10(p.mcap_usd!) - validationPrediction(p, half, snapshot.as_of, model, !!model.calibrated, 0))));
  }

  return {
    fit: {
      n_total: set.length,
      n: keptProtocols.length,
      ...refit,
      r2: adjustedR2,
      median_abs_log_error: medianAbsLogError,
      median_ratio: medianRatio,
      fallback: false,
    },
    points: set.map((p) => ({ tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd!, kept: keptSet.has(p), slug: p.slug, name: p.name, category: p.category })),
  };
}

/** The fitted market cap for a TVL under `fit`, before the growth and maturity adjustments. */
export function fittedMcap(tvlUsd: number, fit: FitResult): number {
  return Math.pow(10, fit.intercept + fit.slope * Math.log10(Math.max(1, tvlUsd)));
}

// ---------------------------------------------------------------- launch odds
// P(the protocol has launched), fitted on the snapshot's own protocols. The
// label is token status itself: 1 when the snapshot records a token, 0 when
// it records none. CEX and versioned pools are excluded — their token status
// is structural, not a launch signal. Features are log10 TVL, log1p age in
// days (unknown age: 365, the maturity convention) and clamped 7d growth,
// plus one-hot categories with at least 15 protocols in the fit set. The fit
// is ridge-penalised IRLS on standardised features (lambda 10, the intercept
// never penalised); the split-half Brier decides whether it ships at all.

/** One protocol's raw odds features, in coefficient order after the intercept. */
function oddsFeatures(p: SnapshotProtocol, asOf: string): number[] {
  return [
    Math.log10(Math.max(1, p.tvl_usd)),
    Math.log1p(ageDays(asOf, p.listed_at) ?? MODEL.unknown_age_days),
    Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, p.change_7d ?? 0)) / 100,
  ];
}

/** The odds fit set: sorted by slug, CEX and versioned pools excluded. */
function oddsSet(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols
    .filter((p) => p.category !== 'CEX' && !VERSIONED.test(p.name))
    .sort(bySlugOrder);
}

/** The one-hot categories: at least `minN` protocols in the fit set. */
function oddsCategories(set: SnapshotProtocol[]): string[] {
  const counts = new Map<string, number>();
  for (const p of set) counts.set(p.category ?? 'Other', (counts.get(p.category ?? 'Other') ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= ODDS.min_category_n).map(([c]) => c).sort();
}

/** A design row: intercept, the three numeric features, then the one-hots. */
function oddsDesign(p: SnapshotProtocol, asOf: string, categories: string[]): number[] {
  const row = [1, ...oddsFeatures(p, asOf)];
  const cat = p.category ?? 'Other';
  for (const c of categories) row.push(cat === c ? 1 : 0);
  return row;
}

function standardize(X: number[][]): { xs: number[][]; mean: number[]; sd: number[] } {
  const d = X[0]!.length;
  const mean = new Array<number>(d).fill(0);
  const sd = new Array<number>(d).fill(1);
  for (let j = 1; j < d; j++) {
    let m = 0;
    for (let i = 0; i < X.length; i++) m += X[i]![j]!;
    m /= X.length;
    let v = 0;
    for (let i = 0; i < X.length; i++) v += (X[i]![j]! - m) * (X[i]![j]! - m);
    mean[j] = m;
    sd[j] = Math.sqrt(v / X.length) || 1;
  }
  return { xs: X.map((row) => row.map((v, j) => (v - mean[j]!) / sd[j]!)), mean, sd };
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!) ) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    if (Math.abs(d) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / d;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => (Math.abs(row[i]!) < 1e-12 ? 0 : row[n]! / row[i]!));
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

/** Ridge-penalised IRLS logistic fit on standardised design rows. */
function fitLogistic(Xs: number[][], y: number[], lambda: number): number[] {
  const n = Xs.length;
  const d = Xs[0]!.length;
  let beta = new Array<number>(d).fill(0);
  for (let it = 0; it < ODDS.max_iters; it++) {
    const p = Xs.map((row) => sigmoid(row.reduce((a, v, j) => a + v * beta[j]!, 0)));
    const w = p.map((v) => Math.max(1e-6, v * (1 - v)));
    const A = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    const g = new Array<number>(d).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < d; j++) {
        g[j]! += Xs[i]![j]! * (y[i]! - p[i]!);
        for (let k = 0; k < d; k++) A[j]![k]! += Xs[i]![j]! * Xs[i]![k]! * w[i]!;
      }
    }
    for (let j = 1; j < d; j++) {
      A[j]![j]! += lambda;
      g[j]! -= lambda * beta[j]!;
    }
    const step = solveLinear(A, g);
    let maxStep = 0;
    for (let j = 0; j < d; j++) {
      beta[j]! += step[j]!;
      maxStep = Math.max(maxStep, Math.abs(step[j]!));
    }
    if (maxStep < 1e-8) break;
  }
  return beta;
}

function predictLogistic(beta: number[], Xs: number[][]): number[] {
  return Xs.map((row) => sigmoid(row.reduce((a, v, j) => a + v * beta[j]!, 0)));
}

function brierScore(y: number[], p: number[]): number {
  return y.reduce((a, v, i) => a + (v - p[i]!) ** 2, 0) / y.length;
}

/** The fitted launch-odds model for a snapshot, with its split-half validation. */
export function fitOdds(snapshot: Snapshot): { odds: OddsFit; predict: (p: SnapshotProtocol) => number } {
  const set = oddsSet(snapshot);
  const categories = oddsCategories(set);
  const y = set.map((p) => (isPreToken(p) ? 0 : 1));
  const baseRate = y.reduce((a, v) => a + v, 0) / y.length;
  const X = set.map((p) => oddsDesign(p, snapshot.as_of, categories));
  const { xs, mean, sd } = standardize(X);
  const beta = fitLogistic(xs, y, ODDS.lambda);
  const pFull = predictLogistic(beta, xs);
  const raw = beta.map((b, j) => (j === 0 ? b - beta.slice(1).reduce((a, bj, k) => a + bj * mean[k + 1]! / sd[k + 1]!, 0) : b / sd[j]!));
  const split = (train: SnapshotProtocol[], test: SnapshotProtocol[]) => {
    const Xtr = train.map((p) => oddsDesign(p, snapshot.as_of, categories));
    const s = standardize(Xtr);
    const b = fitLogistic(s.xs, train.map((p) => (isPreToken(p) ? 0 : 1)), ODDS.lambda);
    const Xte = test.map((p) => oddsDesign(p, snapshot.as_of, categories).map((v, j) => (v - s.mean[j]!) / s.sd[j]!));
    const pt = predictLogistic(b, Xte);
    const yt = test.map((p) => (isPreToken(p) ? 0 : 1));
    const base = train.reduce((a, p) => a + (isPreToken(p) ? 0 : 1), 0) / train.length;
    return { brier: brierScore(yt, pt), base: brierScore(yt, yt.map(() => base)) };
  };
  const even = set.filter((_, k) => k % 2 === 0);
  const odd = set.filter((_, k) => k % 2 === 1);
  const fwd = split(even, odd);
  const rev = split(odd, even);
  const odds: OddsFit = {
    n: set.length,
    base_rate: baseRate,
    beta,
    mean,
    sd,
    categories,
    brier: brierScore(y, pFull),
    base_brier: brierScore(y, y.map(() => baseRate)),
    brier_fwd: fwd.brier,
    base_brier_fwd: fwd.base,
    brier_rev: rev.brier,
    base_brier_rev: rev.base,
    raw_beta: raw,
  };
  const predict = (p: SnapshotProtocol): number => {
    const row = oddsDesign(p, snapshot.as_of, categories).map((v, j) => (v - mean[j]!) / sd[j]!);
    return sigmoid(row.reduce((a, v, j) => a + v * beta[j]!, 0));
  };
  return { odds, predict };
}

/** The multipliers and the implied value one protocol gets under `model` and `fit`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  fit: FitResult,
  odds: number | null = null,
): { implied: number; expected: number; odds: number; fitted: number; growthPct: number; growthMult: number; maturityMult: number; categoryMult: number; age: number | null } {
  const { age, growthPct, growthMult, maturityMult } = valueMultipliers(protocol, asOf, model, fit.maturity_fit);
  const fitted = fittedMcap(protocol.tvl_usd, fit);
  const category = protocol.category ?? 'Other';
  const categoryMult = Math.pow(10, Object.hasOwn(fit.category_adjust, category) ? fit.category_adjust[category]! : 0);
  const implied = Math.max(1, Math.round(fitted * growthMult * maturityMult * categoryMult));
  const o = odds ?? 1;
  const expected = Math.max(1, Math.round(implied * o));
  return { implied, expected, odds: o, fitted, growthPct, growthMult, maturityMult, categoryMult, age };
}

function ageFraction(age: number, model: ModelConstants): number {
  return Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days;
}

function valueMultipliers(protocol: SnapshotProtocol, asOf: string, model: ModelConstants, maturity?: FitResult['maturity_fit']) {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = Math.pow(1 + (growthPct / 100) * model.growth_weight, model.growth_exponent ?? 1);
  const floor = maturity?.floor ?? model.maturity_floor;
  const range = maturity?.range ?? model.maturity_range;
  const maturityMult = floor + ageFraction(age ?? model.unknown_age_days, model) * range;
  return { age, growthPct, growthMult, maturityMult };
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. Ranked by expected value. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
  fit: FitResult | null = null,
  predictOdds: ((p: SnapshotProtocol) => number) | null = null,
): BoardRow[] {
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
    const { implied, expected, odds, fitted: fittedValue, growthPct, growthMult, maturityMult, categoryMult, age } = impliedValue(p, snapshot.as_of, model, fitted, predictOdds === null ? null : predictOdds(p));
    return { p, implied, expected, odds, fittedValue, growthPct, growthMult, maturityMult, categoryMult, age };
  });
  scored.sort((a, b) => b.expected - a.expected || bySlugOrder(a.p, b.p));
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
    implied_value_usd: s.expected,
    implied_if_launched_usd: s.implied,
    // Full precision, not rounded: the gate and the page recompute the expected value as
    // if-launched x odds, and a 4-decimal odds would move the largest rows by hundreds of dollars.
    launch_odds: s.odds,
    value_p10_usd: s.expected,
    value_p90_usd: s.expected,
    rank_low: i + 1,
    rank_high: i + 1,
    verdict: 'SKIP' as const,
    net_usd: 0,
    net_per_hour_usd: 0,
    model: {
      fit_intercept: fitted.intercept,
      fit_slope: fitted.slope,
      fitted_mcap_usd: s.fittedValue,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      category_multiplier: round4(s.categoryMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

// ---------------------------------------------------------------- validation
// Out-of-sample checks on the shipped comps line: leave-one-out of the
// adjusted line, and the 80% interval coverage of the split-half fit.

function tradedComps(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0 && p.category !== 'CEX' && !VERSIONED.test(p.name))
    .sort(bySlugOrder);
}

/** The kept comps set, shared by fitting, validation and bootstrap. */
function keptComps(snapshot: Snapshot, model: ModelConstants, set = tradedComps(snapshot)): SnapshotProtocol[] {
  if (set.length < model.min_fit_points) return set;
  const pts = set.map((p) => ({ tvl: p.tvl_usd, mcap: p.mcap_usd! }));
  const first = ols(pts);
  const residuals = pts.map((p) => Math.log10(p.mcap) - (first.intercept + first.slope * Math.log10(p.tvl)));
  const med = median(residuals);
  const mad = median(residuals.map((r) => Math.abs(r - med)));
  const limit = model.trim_k * 1.4826 * mad;
  const kept = set.filter((_, i) => mad <= 0 || Math.abs(residuals[i]! - med) <= limit);
  return kept.length >= model.min_fit_points ? kept : set;
}

/** Semantic families of categories, fixed a priori from what the protocols do — not fitted
 *  to any error. Radar-7: categories too small to carry their own adjustment borrow their
 *  family's, where n is 6–26 instead of 1–7, so the adjustment is estimated from far more
 *  comps. Categories in no family get no family adjustment. */
const FAMILY_OF: Record<string, string> = {
  Lending: 'LENDING', CDP: 'LENDING', 'Collateral Management': 'LENDING',
  Dexs: 'DEX_YIELD', Yield: 'DEX_YIELD', 'Yield Aggregator': 'DEX_YIELD',
  'Liquidity Manager': 'DEX_YIELD', 'Leveraged Farming': 'DEX_YIELD',
  Bridge: 'BRIDGE', 'Canonical Bridge': 'BRIDGE', 'Cross Chain Bridge': 'BRIDGE',
  'Liquid Staking': 'STAKING', 'Liquid Restaking': 'STAKING', Restaking: 'STAKING',
  'Staking Pool': 'STAKING',
  Derivatives: 'DERIV', Options: 'DERIV', 'Basis Trading': 'DERIV',
  'Onchain Capital Allocator': 'ALLOC', 'Risk Curators': 'ALLOC', Indexes: 'ALLOC',
};

/** The category adjustments for a set of traded protocols (radar-7's hybrid rule, the one
 *  function fitComps, the validation and the bootstrap all call, so the three agree
 *  exactly): each category's median market-cap-to-TVL ratio against the set's global
 *  median, in log10 and shrunk by n/(n+5) — its own when the category has at least 8
 *  traded comps, else its semantic family's (families need at least 5 comps). Categories
 *  with neither get no adjustment. */
function categoryAdjustFor(protocols: SnapshotProtocol[]): Record<string, number> {
  const global = median(protocols.map((p) => p.mcap_usd! / p.tvl_usd));
  const byCat = new Map<string, number[]>();
  const byFam = new Map<string, number[]>();
  for (const p of protocols) {
    const key = p.category ?? 'Other';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(p.mcap_usd! / p.tvl_usd);
    const fam = FAMILY_OF[key];
    if (fam !== undefined) {
      if (!byFam.has(fam)) byFam.set(fam, []);
      byFam.get(fam)!.push(p.mcap_usd! / p.tvl_usd);
    }
  }
  const famAdjust = new Map<string, number>();
  for (const [fam, rs] of byFam) {
    if (rs.length >= 5) famAdjust.set(fam, Math.log10(median(rs) / global) * (rs.length / (rs.length + 5)));
  }
  const adjust: Record<string, number> = {};
  for (const key of [...byCat.keys()].sort()) {
    const rs = byCat.get(key)!;
    if (rs.length >= 8) {
      adjust[key] = Math.log10(median(rs) / global) * (rs.length / (rs.length + 5));
    } else {
      const fam = FAMILY_OF[key];
      if (fam !== undefined && famAdjust.has(fam)) adjust[key] = famAdjust.get(fam)!;
    }
  }
  // Categories absent from this set still resolve to their family's adjustment:
  // in a leave-one-out fold the left-out protocol's own category can vanish from
  // the train set, and in a bootstrap resample it often does — the family is
  // estimated from the set's other members either way. Without this, a
  // singleton category's left-out protocol would get no adjustment at all, which
  // is not the rule the experiment validated.
  for (const key of Object.keys(FAMILY_OF).sort()) {
    if (!(key in adjust)) {
      const fam = FAMILY_OF[key]!;
      if (famAdjust.has(fam)) adjust[key] = famAdjust.get(fam)!;
    }
  }
  return adjust;
}

type CompLine = Pick<FitResult, 'intercept' | 'slope' | 'category_adjust' | 'maturity_fit'>;

function validationPrediction(
  p: SnapshotProtocol,
  line: CompLine,
  asOf: string,
  model: ModelConstants,
  fullValuation: boolean,
  minimumTvl = 1,
): number {
  const category = p.category ?? 'Other';
  const adjustment = Object.hasOwn(line.category_adjust, category) ? line.category_adjust[category]! : 0;
  const base = line.intercept + line.slope * Math.log10(Math.max(minimumTvl, p.tvl_usd)) + adjustment;
  if (!fullValuation) return base;
  const { growthMult, maturityMult } = valueMultipliers(p, asOf, model, line.maturity_fit);
  return base + Math.log10(growthMult * maturityMult);
}

/** A category estimate borrowing strength from other categories in its family. */
function pooledResiduals(rows: SnapshotProtocol[], line: CompLine): Record<string, number> {
  type Group = { sum: number; count: number };
  const categories = new Map<string, Group>();
  const families = new Map<string, Group>();
  const zero = { sum: 0, count: 0 };
  function add(groups: Map<string, Group>, label: string, residual: number) {
    const group = groups.get(label) ?? zero;
    groups.set(label, { sum: group.sum + residual, count: group.count + 1 });
  }
  for (const row of rows) {
    const category = row.category ?? 'Other';
    const residual = Math.log10(row.mcap_usd!) - (line.intercept + line.slope * Math.log10(row.tvl_usd));
    const clipped = Math.min(1.5, Math.max(-1.5, residual));
    add(categories, category, clipped);
    if (Object.hasOwn(FAMILY_OF, category)) add(families, FAMILY_OF[category]!, clipped);
  }

  const pooled: Record<string, number> = Object.create(null);
  for (const category of [...new Set([...categories.keys(), ...Object.keys(FAMILY_OF)])].sort()) {
    const own = categories.get(category) ?? zero;
    const family = families.get(FAMILY_OF[category]!);
    if (own.count === 0 && family === undefined) continue;
    const prior = family ? (family.sum - own.sum) / (family.count - own.count + 5) : 0;
    pooled[category] = (own.sum + 8 * prior) / (own.count + 8);
  }
  return pooled;
}

function fitCompLine(rows: SnapshotProtocol[], asOf: string, model: ModelConstants): CompLine {
  const line: CompLine = { ...ols(rows.map((p) => ({ tvl: p.tvl_usd, mcap: p.mcap_usd! }))), category_adjust: categoryAdjustFor(rows) };
  if (!model.calibrated) return line;

  const pooled = pooledResiduals(rows, line);
  const legacy = line.category_adjust;
  line.category_adjust = Object.fromEntries([...new Set([...Object.keys(legacy), ...Object.keys(pooled)])].sort().map((category) => [
    category,
    0.75 * (Object.hasOwn(legacy, category) ? legacy[category]! : 0) + 0.25 * (pooled[category] ?? 0),
  ]));

  // Balance the two tails of the multiplicative error on the training fold.
  // Clip training residuals before the exponential and shrink the shift to zero.
  // Keep the v8 anchor identifiable: with a free intercept, multiplying both
  // maturity endpoints and offsetting the intercept would give the same fit.
  const anchor = model.fit_maturity ? { ...model, maturity_floor: 1, maturity_range: 0 } : model;
  const residuals = rows.map((row) => Math.log10(row.mcap_usd!) - validationPrediction(row, line, asOf, anchor, true));
  line.intercept += balancedShift(residuals);
  if (model.fit_maturity) line.maturity_fit = fitMaturity(rows, line, asOf, anchor);
  return line;
}

function balancedShift(residuals: number[]): number {
  let high = 0;
  let low = 0;
  for (const error of residuals) {
    const clipped = Math.min(1.75, Math.max(-1.75, error));
    high += Math.pow(10, clipped);
    low += Math.pow(10, -clipped);
  }
  return 0.5 * Math.log10(high / low) * residuals.length / (residuals.length + 10);
}

/**
 * Estimate the age gradient from dated comps. Balance the value residuals
 * after applying that gradient to all training rows to estimate the floor.
 */
function fitMaturity(rows: SnapshotProtocol[], line: CompLine, asOf: string, anchor: ModelConstants): FitResult['maturity_fit'] {
  const points = rows.map((row) => {
    const age = ageDays(asOf, row.listed_at);
    return {
      dated: age !== null,
      age: ageFraction(age ?? anchor.unknown_age_days, anchor),
      residual: Math.log10(row.mcap_usd!) - validationPrediction(row, line, asOf, anchor, true),
    };
  });
  const dated = points.filter((p) => p.dated);
  if (dated.length < 2 || dated.every((p) => p.age === dated[0]!.age)) return undefined;

  const center = median(dated.map((p) => p.residual));
  const noise = 1.4826 * median(dated.map((p) => Math.abs(p.residual - center)));
  const ageCenter = average(dated.map((p) => p.age));
  const spread = 1.345 * noise;
  // A zero-centered prior on the log10 endpoint ratio. The penalty rises
  // with residual noise, so small or noisy folds supply less age leverage.
  const priorSdDex = 0.05;
  let ageSumSquares = (noise / priorSdDex) ** 2;
  let covariance = 0;
  for (const p of dated) {
    const centeredAge = p.age - ageCenter;
    const residual = Math.min(center + spread, Math.max(center - spread, p.residual));
    ageSumSquares += centeredAge ** 2;
    covariance += centeredAge * residual;
  }
  const logRatio = covariance / ageSumSquares;
  const delta = Math.expm1(Math.LN10 * logRatio);
  const level = balancedShift(points.map((p) => p.residual - Math.log1p(p.age * delta) / Math.LN10))
    - balancedShift(points.map((p) => p.residual));
  const floor = Math.pow(10, level);
  return { floor, range: floor * delta, n: dated.length };
}

const average = (values: number[]) => values.reduce((sum, x) => sum + x, 0) / values.length;

function sampleSd(values: number[]): number {
  const center = average(values);
  return Math.sqrt(values.reduce((sum, x) => sum + (x - center) * (x - center), 0) / Math.max(1, values.length - 1));
}

function errorMetrics(errors: number[]) {
  const abs = errors.map(Math.abs);
  return {
    medianFactor: Math.pow(10, median(abs)),
    meanAbsLog: average(abs),
    meanFactor: average(abs.map((error) => Math.pow(10, error))),
  };
}

/** Evaluate both the published split and a fold-local trimming audit. */
export function compsDiagnostics(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
  fullValuation = !!model.calibrated,
  foldLocalTrim = false,
) {
  const asOf = snapshot.as_of;
  const traded = tradedComps(snapshot);
  const kept = keptComps(snapshot, model, traded);
  const cohort = foldLocalTrim ? traded : kept;
  const even = cohort.filter((_, i) => i % 2 === 0);
  const odd = cohort.filter((_, i) => i % 2 === 1);
  const fitFold = (train: SnapshotProtocol[]) => {
    const rows = foldLocalTrim ? keptComps(snapshot, model, train) : train;
    const reference = fitCompLine(rows, asOf, MODEL);
    const line = model.calibrated ? fitCompLine(rows, asOf, model) : reference;
    const plain = { ...reference, category_adjust: {} };
    const residual = (p: SnapshotProtocol) => Math.log10(p.mcap_usd!) - validationPrediction(p, line, asOf, model, fullValuation);
    const plainResidual = (p: SnapshotProtocol) => Math.log10(p.mcap_usd!) - validationPrediction(p, plain, asOf, MODEL, false, 0);
    return { rows, reference, line, residual, plainResidual };
  };
  const split = (train: SnapshotProtocol[], test: SnapshotProtocol[]) => {
    if (train.length < 2 || test.length === 0) return null;
    const fold = fitFold(train);
    // Use the radar-7 interval width for every candidate.
    const history = fold.rows.map((p) => Math.log10(p.mcap_usd!) - validationPrediction(p, fold.reference, asOf, MODEL, false));
    const halfWidth = 1.2816 * sampleSd(history);
    const errors = test.map(fold.residual);
    const covered = errors.filter((e) => Math.abs(e) <= halfWidth).length;
    return { adjusted: errorMetrics(errors), plain: errorMetrics(test.map(fold.plainResidual)), halfWidth, covered, n: test.length, maturityFit: fold.line.maturity_fit };
  };
  const looErrors = cohort.length < 3 ? [] : cohort.map((p, i) => {
    const fold = fitFold(cohort.filter((_, j) => i !== j));
    return { adjusted: fold.residual(p), plain: fold.plainResidual(p) };
  });
  const line = kept.length ? fitCompLine(kept, asOf, model) : null;
  const residuals = line === null ? [] : kept.map((p) => Math.log10(p.mcap_usd!) - validationPrediction(p, line, asOf, model, fullValuation, 0));
  const marketCaps = kept.map((p) => Math.log10(p.mcap_usd!));
  const center = average(marketCaps);
  const total = marketCaps.reduce((sum, y) => sum + (y - center) ** 2, 0);
  return {
    loo: looErrors.length ? { adjusted: errorMetrics(looErrors.map((r) => r.adjusted)), plain: errorMetrics(looErrors.map((r) => r.plain)) } : null,
    forward: split(even, odd),
    reverse: split(odd, even),
    residualSd: residuals.length ? sampleSd(residuals) : null,
    r2: total > 0 ? 1 - residuals.reduce((sum, e) => sum + e * e, 0) / total : null,
  };
}

/** LOO and fixed-width coverage of the shipped model. */
export function compsValidation(snapshot: Snapshot, model: ModelConstants = MODEL): ValidationStats {
  const { loo, forward } = compsDiagnostics(snapshot, model);
  return {
    loo_median_factor: loo?.adjusted.medianFactor ?? null,
    loo_plain_factor: loo?.plain.medianFactor ?? null,
    split_half_factor: null,
    split_half_plain_factor: forward?.plain.medianFactor ?? null,
    coverage_80: forward ? forward.covered / forward.n : null,
    coverage_n: forward?.n ?? Math.floor(keptComps(snapshot, model).length / 2),
    checks_passed: 0,
    checks_total: 0,
  };
}

// ---------------------------------------------------------------- census
// The ledger: every snapshot protocol in exactly one group, so the board's
// 226 rows are accounted for against the 758.

/** The census of the snapshot's protocols, in mutually exclusive groups. */
export function census(snapshot: Snapshot, board: BoardRow[]): LedgerGroup[] {
  const boardSlugs = new Set(board.map((r) => r.slug));
  const watchlist = new Set(snapshot.watchlist);
  const rankedWatch = board.filter((r) => watchlist.has(r.slug)).length;
  const rankedEarly = board.length - rankedWatch;
  const traded = snapshot.protocols.filter((p) => !isPreToken(p)).length;
  const rest = snapshot.protocols.filter((p) => isPreToken(p) && !boardSlugs.has(p.slug));
  const cex = rest.filter((p) => p.category === 'CEX').length;
  const versioned = rest.filter((p) => p.category !== 'CEX' && VERSIONED.test(p.name)).length;
  const aboveFloor = rest.length - cex - versioned;
  return [
    { label: 'Ranked — watchlist', count: rankedWatch, detail: 'on the official watchlist, the board’s floor' },
    { label: 'Ranked — early', count: rankedEarly, detail: 'pre-token below the $50M floor' },
    { label: 'Already trades', count: traded, detail: 'set aside; the live view shows the top 24 by market cap' },
    { label: 'Excluded — exchange', count: cex, detail: 'pre-token exchanges are not rankable' },
    { label: 'Excluded — versioned pool', count: versioned, detail: 'a versioned pool of another protocol' },
    { label: 'Excluded — above floor, off watchlist', count: aboveFloor, detail: 'pre-token above $50M TVL but not on the official watchlist' },
  ];
}

// ---------------------------------------------------------------- farm economics + verdicts
// The plan's costed economics, from the same helpers as the steps, so the
// verdicts the board shows are the plan's own arithmetic.

/** The plan's costed economics for a protocol, at a horizon of `holdDays` days. */
export function farmEconomicsTs(p: SnapshotProtocol, age: number | null, holdDays: number | null = null): { capital: number; gas: number; hold: number; weeks: number; minutes: number } {
  const capital = capitalFor(p);
  const second = secondChainOf(p);
  const secondCapital = second !== null ? Math.max(25, Math.round(capital / 2)) : 0;
  const hold = holdDays ?? holdDaysFor(age);
  const weeks = Math.ceil(hold / 7);
  const gas = 3 + gasFor(capital) + (second !== null ? 3 : 2) + 2 * weeks;
  const minutes = 5 + 15 + 10 + 10 * weeks + 10 + 5;
  return { capital: capital + secondCapital, gas, hold, weeks, minutes };
}

/** A row's farm verdict from its expected value and the plan's economics. */
export function verdictFor(expectedUsd: number, econ: { gas: number; minutes: number }, dropShare: number): { verdict: 'FARM' | 'MARGINAL' | 'SKIP'; net: number; netPerHour: number } {
  const net = expectedUsd * dropShare - econ.gas;
  const hours = econ.minutes / 60;
  const netPerHour = net / hours;
  const verdict = net > 0 && netPerHour >= ODDS.farm_min_net_per_hour ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
  return { verdict, net: Math.round(net * 100) / 100, netPerHour: Math.round(netPerHour * 100) / 100 };
}

// ---------------------------------------------------------------- bootstrap
// Seeded resamples refit the comps line (with adjustments) and the odds fit;
// each board row takes the P10–P90 range of its expected value and the range
// of ranks it holds across the resamples. Fixed seed: a rebuild is identical.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bootstrap value and rank ranges for the board rows, from seeded resamples. */
export function bootstrapRanges(
  snapshot: Snapshot,
  fit: FitResult,
  odds: OddsFit,
  board: BoardRow[],
  reps: number = ODDS.bootstrap_reps,
  model: ModelConstants = MODEL,
): Map<string, { p10: number; p90: number; rankLow: number; rankHigh: number; top20: number }> {
  const rand = mulberry32(ODDS.bootstrap_seed);
  const kept = keptComps(snapshot, model);
  const oddsRows = oddsSet(snapshot);
  const samples = new Map<string, number[]>();
  const ranks = new Map<string, number[]>();
  for (const r of board) {
    samples.set(r.slug, []);
    ranks.set(r.slug, []);
  }
  const resample = <T,>(arr: T[]): T[] => {
    const out: T[] = [];
    for (let i = 0; i < arr.length; i++) out.push(arr[Math.floor(rand() * arr.length)]!);
    return out;
  };
  for (let rep = 0; rep < reps; rep++) {
    // Refit the comps line on a resampled kept set.
    const sample = resample(kept);
    const synthFit = fit.fallback ? fit : { ...fit, ...fitCompLine(sample, snapshot.as_of, model) };
    // Refit the odds model on a resampled odds set.
    const oSample = resample(oddsRows);
    const X = oSample.map((p) => oddsDesign(p, snapshot.as_of, odds.categories));
    const s = standardize(X);
    const b = fitLogistic(s.xs, oSample.map((p) => (isPreToken(p) ? 0 : 1)), ODDS.lambda);
    const oddsPred = (p: SnapshotProtocol): number => {
      const row = oddsDesign(p, snapshot.as_of, odds.categories).map((v, j) => (v - s.mean[j]!) / s.sd[j]!);
      return sigmoid(row.reduce((a, v, j) => a + v * b[j]!, 0));
    };
    const index = bySlug(snapshot.protocols);
    const evs: { slug: string; ev: number }[] = [];
    for (const r of board) {
      const p = index.get(r.slug)!;
      // The shipped formula, with this resample's line, adjustments and odds.
      const { expected } = impliedValue(p, snapshot.as_of, model, synthFit, oddsPred(p));
      evs.push({ slug: r.slug, ev: expected });
      samples.get(r.slug)!.push(expected);
    }
    evs.sort((a, b) => b.ev - a.ev || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    evs.forEach((e, i) => ranks.get(e.slug)!.push(i + 1));
  }
  const out = new Map<string, { p10: number; p90: number; rankLow: number; rankHigh: number; top20: number }>();
  const q = (arr: number[], f: number): number => {
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(f * s.length))];
  };
  for (const r of board) {
    const s = samples.get(r.slug)!;
    const rk = ranks.get(r.slug)!;
    out.set(r.slug, { p10: q(s, 0.1), p90: q(s, 0.9), rankLow: Math.min(...rk), rankHigh: Math.max(...rk), top20: rk.filter((v) => v <= 20).length / rk.length });
  }
  return out;
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

/** The date `days` after a listing date (YYYY-MM-DD), or null when the date is absent or bad. */
function dateAfter(listedAt: string | null, days: number): string | null {
  if (listedAt === null) return null;
  const t = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return new Date(t + days * DAY_MS).toISOString().slice(0, 10);
}

/** A TVL as a short figure: $2.75B above a billion, $254M below it. */
function tvlText(tvlUsd: number): string {
  return tvlUsd >= 1_000_000_000 ? `$${(tvlUsd / 1_000_000_000).toFixed(2)}B` : `$${Math.round(tvlUsd / 1_000_000)}M`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age, 7d change, listing date), never from a
 * hand-written list of names. The main action names the protocol's TVL and 7d change, and the hold
 * step is dated: the listing date and the day the hold ends (listing + age + hold, which is the
 * snapshot date + hold). Protocols with no listing date get no date in the hold step.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const gas = gasFor(capital);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const changeText = p.change_7d === null ? 'n/a' : `${p.change_7d >= 0 ? '+' : ''}${p.change_7d.toFixed(2)}%`;
  const mainAction = `${action.replace(/\.$/, '')} (TVL ${tvlText(p.tvl_usd)}, 7d ${changeText}).`;
  const endDate = age === null ? null : dateAfter(p.listed_at, age + hold);
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
      text: mainAction,
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
      text: `Hold the position for at least ${hold} days${endDate === null ? '' : `, until ${endDate}`}${age === null ? '' : ` (listed ${p.listed_at})`} so the activity is counted in more than one snapshot.`,
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
    implied_if_launched_usd: row.implied_if_launched_usd,
    launch_odds: row.launch_odds,
    value_p10_usd: row.value_p10_usd,
    value_p90_usd: row.value_p90_usd,
    rank_low: row.rank_low,
    rank_high: row.rank_high,
    verdict: row.verdict,
    net_usd: row.net_usd,
    net_per_hour_usd: row.net_per_hour_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    category_multiplier: row.model.category_multiplier,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { fit, points } = fitComps(snapshot, model);
  const { odds, predict } = fitOdds(snapshot);
  const board = buildBoard(snapshot, model, fit, predict);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const index = bySlug(snapshot.protocols);
  // Bootstrap uncertainty, then the verdicts at the default scenario.
  const ranges = bootstrapRanges(snapshot, fit, odds, board, ODDS.bootstrap_reps, model);
  let farmable = 0;
  let bestNetPerHour = -Infinity;
  let top20Stable = 0;
  for (const r of board) {
    const range = ranges.get(r.slug)!;
    r.value_p10_usd = range.p10;
    r.value_p90_usd = range.p90;
    r.rank_low = range.rankLow;
    r.rank_high = range.rankHigh;
    if (r.rank <= 20 && range.top20 >= 0.8) top20Stable++;
    const p = index.get(r.slug)!;
    const econ = farmEconomicsTs(p, r.age_days);
    const v = verdictFor(r.implied_value_usd, econ, ODDS.default_drop_share);
    r.verdict = v.verdict;
    r.net_usd = v.net;
    r.net_per_hour_usd = v.netPerHour;
    if (v.verdict === 'FARM') farmable++;
    if (v.netPerHour > bestNetPerHour) bestNetPerHour = v.netPerHour;
  }
  const validation = compsValidation(snapshot, model);
  validation.split_half_factor = fit.median_abs_log_error === null ? null : Math.pow(10, fit.median_abs_log_error);
  const checks: boolean[] = [
    validation.split_half_factor !== null && validation.split_half_plain_factor !== null && validation.split_half_factor < validation.split_half_plain_factor,
    validation.loo_median_factor !== null && validation.loo_plain_factor !== null && validation.loo_median_factor < validation.loo_plain_factor,
    validation.coverage_80 !== null && validation.coverage_80 >= (model.calibrated ? 0.8 : 0.65) && validation.coverage_80 <= 0.95,
    odds.brier_fwd < odds.base_brier_fwd,
    odds.brier_rev < odds.base_brier_rev,
  ];
  validation.checks_passed = checks.filter(Boolean).length;
  validation.checks_total = checks.length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: model.fit_maturity ? 'radar-9' : model.calibrated ? 'radar-8' : MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    fit,
    fit_points: points,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
    odds,
    validation,
    ledger: census(snapshot, board),
    board_sha256: '',
    scenario: { drop_share: ODDS.default_drop_share, farm_min_net_per_hour: ODDS.farm_min_net_per_hour },
    farmable_rows: farmable,
    best_net_per_hour_usd: Math.round(bestNetPerHour * 100) / 100,
    top20_stable_count: top20Stable,
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
