import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CALIBRATED_MODEL, MODEL, boardIssue, buildRadar, compsDiagnostics, parseSnapshot } from '../lib/model.ts';

const snapshot = parseSnapshot(readFileSync(process.argv[2] ?? 'input/snapshot.json', 'utf8'));
assert.equal(snapshot.as_of, '2026-11-14');
assert.equal(snapshot.protocols.length, 758);
const watchlist = new Set(snapshot.watchlist);
assert.equal(watchlist.size, 40);
const baseline = buildRadar(snapshot, MODEL);
const candidate = buildRadar(snapshot, CALIBRATED_MODEL);
for (const { board, radar } of [baseline, candidate]) {
  assert.equal(boardIssue(board, snapshot), null);
  assert.equal(board.length, 226);
  assert.equal(board.filter((row) => watchlist.has(row.slug)).length, 40);
  assert.equal(radar.validation.checks_passed, 5);
}
assert.deepEqual(candidate.board.map((r) => r.slug).sort(), baseline.board.map((r) => r.slug).sort());
assert.deepEqual(candidate.radar.odds, baseline.radar.odds);

const legacy = compsDiagnostics(snapshot);
const full = compsDiagnostics(snapshot, MODEL, true);
const tested = compsDiagnostics(snapshot, CALIBRATED_MODEL);
const plain = tested.loo.plain;
assert.equal(tested.forward.halfWidth, full.forward.halfWidth);
assert.equal(tested.forward.halfWidth, legacy.forward.halfWidth);
assert.equal(tested.forward.covered / tested.forward.n, candidate.radar.validation.coverage_80);
assert.equal(tested.forward.adjusted.medianFactor, candidate.radar.validation.split_half_factor);
assert.equal(tested.loo.adjusted.medianFactor, candidate.radar.validation.loo_median_factor);

const top20 = new Set(baseline.board.slice(0, 20).map((r) => r.slug));
const width = (row) => row.rank_high - row.rank_low;
function medianWidth(rows) {
  const sorted = rows.map(width).sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
}
function ranks({ board, radar }) {
  const veda = board.find((r) => r.slug === 'veda');
  return {
    veda: [veda.rank_low, veda.rank_high],
    vedaWidth: width(veda),
    medianWidth: medianWidth(board),
    top20Width: medianWidth(board.filter((r) => top20.has(r.slug))),
    stableTop20: radar.top20_stable_count,
  };
}
const oldRanks = ranks(baseline);
const newRanks = ranks(candidate);
const checks = {
  looMedian: tested.loo.adjusted.medianFactor < plain.medianFactor
    && tested.loo.adjusted.medianFactor <= legacy.loo.adjusted.medianFactor
    && tested.loo.adjusted.medianFactor <= full.loo.adjusted.medianFactor,
  looMeans: tested.loo.adjusted.meanAbsLog < plain.meanAbsLog && tested.loo.adjusted.meanFactor < plain.meanFactor,
  forwardMedian: tested.forward.adjusted.medianFactor < tested.forward.plain.medianFactor
    && tested.forward.adjusted.medianFactor <= legacy.forward.adjusted.medianFactor
    && tested.forward.adjusted.medianFactor <= full.forward.adjusted.medianFactor,
  coverage: tested.forward.covered / tested.forward.n >= 0.8,
  r2: tested.r2 >= legacy.r2 && tested.r2 >= full.r2,
  residualSd: tested.residualSd <= legacy.residualSd && tested.residualSd <= full.residualSd,
  veda: newRanks.vedaWidth < oldRanks.vedaWidth,
  top20: newRanks.top20Width < oldRanks.top20Width,
  board: newRanks.medianWidth <= oldRanks.medianWidth,
};
const accepted = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
  accepted,
  checks,
  radar7Published: legacy,
  radar7Full: { ...full, ranks: oldRanks },
  radar8: { ...tested, ranks: newRanks },
  foldLocalTrimAudit: {
    radar7Full: compsDiagnostics(snapshot, MODEL, true, true),
    radar8: compsDiagnostics(snapshot, CALIBRATED_MODEL, true, true),
  },
}, null, 2));
if (!accepted) process.exitCode = 1;
