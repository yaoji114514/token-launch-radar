import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CALIBRATED_MODEL, MATURITY_MODEL, MODEL, boardIssue, buildRadar, compsDiagnostics, impliedValue, parseSnapshot } from '../lib/model.ts';

const snapshot = parseSnapshot(readFileSync(process.argv[2] ?? 'input/snapshot.json', 'utf8'));
assert.equal(snapshot.as_of, '2026-11-14');
assert.equal(snapshot.protocols.length, 758);
assert.equal(new Set(snapshot.watchlist).size, 40);
const v7 = buildRadar(snapshot, MODEL);
const v8 = buildRadar(snapshot, CALIBRATED_MODEL);
const v9 = buildRadar(snapshot, MATURITY_MODEL);
for (const { board } of [v7, v8, v9]) {
  assert.equal(boardIssue(board, snapshot), null);
  assert.equal(board.length, 226);
  assert.deepEqual(board.map((r) => r.slug).sort(), v7.board.map((r) => r.slug).sort());
}
assert.deepEqual(v9.radar.odds, v8.radar.odds);
assert.equal(v9.radar.fit.intercept, v8.radar.fit.intercept);
assert.deepEqual(v9.radar.fit.category_adjust, v8.radar.fit.category_adjust);
assert.equal(v9.radar.model_version, 'radar-9');
const { floor, range, n } = v9.radar.fit.maturity_fit;
assert.ok(floor > 0 && floor + range > 0 && range !== 0 && n > 2);

const { as_of: asOf } = snapshot;
const veda = snapshot.protocols.find((p) => p.slug === 'veda');
const atAge = (listed_at) => impliedValue({ ...veda, listed_at }, asOf, MATURITY_MODEL, v9.radar.fit, 0.5);
assert.equal(atAge(asOf).maturityMult, floor);
assert.equal(atAge('2023-11-15').maturityMult, floor + range);
assert.equal(atAge(null).maturityMult, floor + range * (MATURITY_MODEL.unknown_age_days / MATURITY_MODEL.maturity_days));
assert.notEqual(atAge(asOf).expected, atAge('2023-11-15').expected);

const legacy = compsDiagnostics(snapshot);
const full7 = compsDiagnostics(snapshot, MODEL, true);
const full8 = compsDiagnostics(snapshot, CALIBRATED_MODEL);
const full9 = compsDiagnostics(snapshot, MATURITY_MODEL);
assert.notDeepEqual(full9.forward.maturityFit, v9.radar.fit.maturity_fit);
assert.notDeepEqual(full9.forward.maturityFit, full9.reverse.maturityFit);
assert.equal(full9.forward.halfWidth, full8.forward.halfWidth);
assert.equal(full9.forward.covered / full9.forward.n, v9.radar.validation.coverage_80);
assert.equal(full9.loo.adjusted.medianFactor, v9.radar.validation.loo_median_factor);
assert.equal(full9.forward.adjusted.medianFactor, v9.radar.validation.split_half_factor);

const top20 = new Set(v7.board.slice(0, 20).map((r) => r.slug));
const width = (r) => r.rank_high - r.rank_low;
function medianWidth(rows) {
  const sorted = rows.map(width).sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
}
function ranks({ board }) {
  const row = board.find((r) => r.slug === 'veda');
  return {
    veda: [row.rank_low, row.rank_high],
    vedaWidth: width(row),
    medianWidth: medianWidth(board),
    top20Width: medianWidth(board.filter((r) => top20.has(r.slug))),
    leader: { slug: board[0].slug, expected: board[0].implied_value_usd },
  };
}
const ranks7 = ranks(v7);
const ranks9 = ranks(v9);
const plain = full9.loo.plain;
const checks = {
  looMedian: full9.loo.adjusted.medianFactor <= legacy.loo.adjusted.medianFactor
    && full9.loo.adjusted.medianFactor <= full7.loo.adjusted.medianFactor
    && full9.loo.adjusted.medianFactor < plain.medianFactor,
  looMeans: full9.loo.adjusted.meanAbsLog < plain.meanAbsLog && full9.loo.adjusted.meanFactor < plain.meanFactor,
  forwardMedian: full9.forward.adjusted.medianFactor <= legacy.forward.adjusted.medianFactor
    && full9.forward.adjusted.medianFactor <= full7.forward.adjusted.medianFactor
    && full9.forward.adjusted.medianFactor < full9.forward.plain.medianFactor,
  coverage: full9.forward.covered / full9.forward.n >= 0.8,
  r2: full9.r2 >= legacy.r2 && full9.r2 >= full7.r2,
  residualSd: full9.residualSd <= legacy.residualSd && full9.residualSd <= full7.residualSd,
  veda: ranks9.vedaWidth < ranks7.vedaWidth,
  top20: ranks9.top20Width < ranks7.top20Width,
  board: ranks9.medianWidth <= ranks7.medianWidth,
};
const vedaRow = (version) => version.board.find((r) => r.slug === 'veda');
const vedaCounterfactual = impliedValue(veda, asOf, {
  ...CALIBRATED_MODEL,
  maturity_floor: MODEL.maturity_floor,
  maturity_range: MODEL.maturity_range,
}, v8.radar.fit, vedaRow(v8).launch_odds);
const lift = vedaRow(v8).implied_value_usd - vedaRow(v7).implied_value_usd;
console.log(JSON.stringify({
  accepted: Object.values(checks).every(Boolean),
  checks,
  maturity: v9.radar.fit.maturity_fit,
  radar7Published: legacy,
  radar7: { ...full7, ranks: ranks7 },
  radar8: { ...full8, ranks: ranks(v8) },
  radar9: { ...full9, ranks: ranks9 },
  foldLocalTrimAudit: {
    radar8: compsDiagnostics(snapshot, CALIBRATED_MODEL, true, true),
    radar9: compsDiagnostics(snapshot, MATURITY_MODEL, true, true),
  },
  vedaExpected: {
    radar7: vedaRow(v7).implied_value_usd,
    radar8WithRadar7Maturity: vedaCounterfactual.expected,
    radar8: vedaRow(v8).implied_value_usd,
    radar9: vedaRow(v9).implied_value_usd,
    shareOfV8LiftFromRemovingMaturity: (vedaRow(v8).implied_value_usd - vedaCounterfactual.expected) / lift,
  },
}, null, 2));
