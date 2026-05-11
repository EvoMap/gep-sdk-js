import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  selectGene,
  selectCapsule,
  selectGeneAndCapsule,
  banGenesFromFailedCapsules,
  computeSignalOverlap,
  computeDriftIntensity,
} from '../src/selector.js';
import { createGene } from '../src/gene.js';

function makeGene(id, signals_match) {
  return createGene({
    id,
    category: 'repair',
    signals_match,
    strategy: ['s'],
    constraints: { max_files: 5, forbidden_paths: ['.git'] },
    validation: ['v'],
  });
}

// computeDriftIntensity returns 1/sqrt(N) when driftEnabled is false.
// useDrift = driftIntensity > 0.15 → need N > 44 to keep drift dormant
// and the selection deterministic. We use 50 filler genes by convention.
function makeFiller(count = 50) {
  return Array.from({ length: count }, (_, i) => makeGene(`gene_filler_${i}`, ['unrelated_signal_x']));
}

test('selectGene: returns highest-scoring gene', () => {
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error', 'perf_bottleneck']);
  const r = selectGene([g1, g2, ...makeFiller()], ['log_error', 'perf_bottleneck']);
  assert.equal(r.selected.id, 'gene_b');
  assert.equal(r.alternatives[0].id, 'gene_a');
});

test('selectGene: empty pool returns null selected', () => {
  const r = selectGene([], ['log_error']);
  assert.equal(r.selected, null);
});

test('selectGene: no matching signals returns null selected', () => {
  const g = makeGene('gene_a', ['log_error']);
  const r = selectGene([g, ...makeFiller()], ['unrelated']);
  assert.equal(r.selected, null);
});

test('selectGene: distilled gets 0.8x score penalty when tied on signal match', () => {
  const distilled = makeGene('gene_distilled_x', ['log_error']);
  const regular = makeGene('gene_regular', ['log_error']);
  const r = selectGene([distilled, regular, ...makeFiller()], ['log_error']);
  assert.equal(r.selected.id, 'gene_regular');
});

test('selectGene: bannedGeneIds excludes banned gene (large pool)', () => {
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error']);
  const r = selectGene([g1, g2, ...makeFiller()], ['log_error'], {
    bannedGeneIds: new Set(['gene_a']),
  });
  assert.equal(r.selected.id, 'gene_b');
});

test('selectGene: bannedGeneIds always blocks even on small pool (v1.1.0 fix)', () => {
  // Regression for v1.0.x bypass: with a 2-gene pool, drift used to skip
  // bannedGeneIds. Post-fix, bans are hard suppression in all modes.
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error']);
  for (let i = 0; i < 100; i++) {
    const r = selectGene([g1, g2], ['log_error'], { bannedGeneIds: new Set(['gene_a']) });
    assert.equal(r.selected.id, 'gene_b', `trial ${i}: banned gene_a leaked`);
  }
});

test('selectGene: preferredGeneId boosts but does not override stronger match (v1.1.0)', () => {
  // v1.0.x hard override: preferred always won regardless of score, leading
  // to the negative-feedback loop where popular genes spread into unfit
  // contexts. Post-fix: 1.5x soft multiplier, so gene_a (score 2) still
  // beats gene_b (1 × 1.5 = 1.5).
  const g1 = makeGene('gene_a', ['log_error', 'perf_bottleneck']);
  const g2 = makeGene('gene_b', ['log_error']);
  const r = selectGene([g1, g2, ...makeFiller()], ['log_error', 'perf_bottleneck'], {
    preferredGeneId: 'gene_b',
  });
  assert.equal(r.selected.id, 'gene_a');
});

test('selectGene: preferredGeneId boost wins on ties (v1.1.0)', () => {
  // When base scores are equal, the 1.5x multiplier promotes the preferred
  // gene above its peer.
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error']);
  const r = selectGene([g1, g2, ...makeFiller()], ['log_error'], {
    preferredGeneId: 'gene_b',
  });
  assert.equal(r.selected.id, 'gene_b');
});

test('selectGene: preferredGeneId on banned gene is ignored (v1.1.0)', () => {
  // Memory preference must not leak a banned gene back into selection.
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error']);
  const r = selectGene([g1, g2, ...makeFiller()], ['log_error'], {
    preferredGeneId: 'gene_a',
    bannedGeneIds: new Set(['gene_a']),
  });
  assert.equal(r.selected.id, 'gene_b');
});

test('selectGene: deterministic when useDrift = false (v1.1.0)', () => {
  // Random drift jitter is now gated by useDrift. With drift dormant
  // (large pool, driftEnabled = false), selection is deterministic.
  const top = makeGene('gene_top', ['log_error', 'perf_bottleneck']);
  const second = makeGene('gene_second', ['log_error']);
  for (let i = 0; i < 100; i++) {
    const r = selectGene([top, second, ...makeFiller()], ['log_error', 'perf_bottleneck']);
    assert.equal(r.selected.id, 'gene_top', `trial ${i}: jitter leaked under useDrift=false`);
  }
});

test('selectCapsule: returns capsule with highest matching trigger count', () => {
  const c1 = { type: 'Capsule', trigger: ['log_error'] };
  const c2 = { type: 'Capsule', trigger: ['log_error', 'perf_bottleneck'] };
  assert.equal(selectCapsule([c1, c2], ['log_error', 'perf_bottleneck']), c2);
});

test('selectCapsule: returns null when no trigger matches', () => {
  const c1 = { type: 'Capsule', trigger: ['log_error'] };
  assert.equal(selectCapsule([c1], ['unrelated']), null);
});

test('selectGeneAndCapsule: combines gene selection + capsule selection', () => {
  const g1 = makeGene('gene_a', ['log_error']);
  const c1 = { type: 'Capsule', trigger: ['log_error'] };
  const r = selectGeneAndCapsule({
    genes: [g1, ...makeFiller()],
    capsules: [c1],
    signals: ['log_error'],
  });
  assert.equal(r.selectedGene.id, 'gene_a');
  assert.equal(r.capsuleCandidates[0], c1);
});

test('selectGeneAndCapsule: missing memoryAdvice / driftEnabled defaults are safe', () => {
  const g1 = makeGene('gene_a', ['log_error']);
  const r = selectGeneAndCapsule({
    genes: [g1, ...makeFiller()],
    capsules: [],
    signals: ['log_error'],
  });
  assert.equal(r.selectedGene.id, 'gene_a');
  assert.deepEqual(r.capsuleCandidates, []);
});

test('selectGeneAndCapsule: bannedGeneIds via memoryAdvice excludes the gene', () => {
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error']);
  const r = selectGeneAndCapsule({
    genes: [g1, g2, ...makeFiller()],
    capsules: [],
    signals: ['log_error'],
    memoryAdvice: { bannedGeneIds: new Set(['gene_a']) },
  });
  assert.equal(r.selectedGene.id, 'gene_b');
});

test('computeSignalOverlap: ratio of signalsA found in signalsB', () => {
  assert.equal(computeSignalOverlap(['a', 'b'], ['a', 'b', 'c']), 1);
  assert.equal(computeSignalOverlap(['a', 'b'], ['a', 'c']), 0.5);
  assert.equal(computeSignalOverlap([], ['a']), 0);
  assert.equal(computeSignalOverlap(['a'], []), 0);
  assert.equal(computeSignalOverlap(['A'], ['a']), 1, 'case-insensitive');
});

test('banGenesFromFailedCapsules: bans gene after 2+ overlapping failures', () => {
  const failed = [
    { gene: 'gene_x', trigger: ['log_error', 'perf_bottleneck'] },
    { gene: 'gene_x', trigger: ['log_error', 'perf_bottleneck'] },
    { gene: 'gene_y', trigger: ['log_error'] },
  ];
  const bans = banGenesFromFailedCapsules(failed, ['log_error', 'perf_bottleneck'], new Set());
  assert.ok(bans.has('gene_x'), 'gene_x had 2 high-overlap failures');
  assert.ok(!bans.has('gene_y'), 'gene_y had only 1 failure');
});

test('banGenesFromFailedCapsules: skips low-overlap failures', () => {
  // gene_x failed 3 times but on unrelated signals → not banned for current
  // signals (Linux failure should not ban a gene on Windows).
  const failed = [
    { gene: 'gene_x', trigger: ['unrelated_a'] },
    { gene: 'gene_x', trigger: ['unrelated_a'] },
    { gene: 'gene_x', trigger: ['unrelated_b'] },
  ];
  const bans = banGenesFromFailedCapsules(failed, ['log_error'], new Set());
  assert.equal(bans.size, 0);
});

test('banGenesFromFailedCapsules: preserves existing bans', () => {
  const bans = banGenesFromFailedCapsules([], ['log_error'], new Set(['gene_old']));
  assert.ok(bans.has('gene_old'));
});

test('selectGeneAndCapsule: failedCapsules bans recurring failure', () => {
  const g1 = makeGene('gene_failer', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error']);
  const failed = [
    { gene: 'gene_failer', trigger: ['log_error'] },
    { gene: 'gene_failer', trigger: ['log_error'] },
  ];
  const r = selectGeneAndCapsule({
    genes: [g1, g2, ...makeFiller()],
    capsules: [],
    signals: ['log_error'],
    failedCapsules: failed,
  });
  assert.equal(r.selectedGene.id, 'gene_b');
});

test('computeDriftIntensity: returns 0 with no genes', () => {
  assert.equal(computeDriftIntensity({}), 0);
  assert.equal(computeDriftIntensity({ genePoolSize: 0 }), 0);
});

test('computeDriftIntensity: drift disabled = 1/sqrt(N)', () => {
  const v = computeDriftIntensity({ genePoolSize: 100 });
  assert.ok(Math.abs(v - 0.1) < 1e-9, `expected 0.1, got ${v}`);
});

test('computeDriftIntensity: drift enabled with no maturity uses 0.3 offset', () => {
  // Ne=100, memoryEvidence=0 → maturity=0 → offset=0.3
  // intensity = 1/10 + 0.3 = 0.4
  const v = computeDriftIntensity({ driftEnabled: true, genePoolSize: 100 });
  assert.ok(Math.abs(v - 0.4) < 1e-9, `expected 0.4, got ${v}`);
});

test('computeDriftIntensity: maturity decays offset toward 0.02 (v1.1.0)', () => {
  // Ne=100, memoryEvidence = 100 * 10 = 1000 → maturity=1 → offset=0.02
  // intensity = 1/10 + 0.02 = 0.12
  const mature = computeDriftIntensity({
    driftEnabled: true,
    genePoolSize: 100,
    memoryEvidence: 1000,
  });
  assert.ok(Math.abs(mature - 0.12) < 1e-9, `expected 0.12, got ${mature}`);
  // Half mature → offset = 0.3 - (0.3 - 0.02) * 0.5 = 0.16
  const half = computeDriftIntensity({
    driftEnabled: true,
    genePoolSize: 100,
    memoryEvidence: 500,
  });
  assert.ok(Math.abs(half - (0.1 + 0.16)) < 1e-9, `expected 0.26, got ${half}`);
});

test('computeDriftIntensity: effectivePopulationSize overrides genePoolSize', () => {
  const a = computeDriftIntensity({ effectivePopulationSize: 100, genePoolSize: 1 });
  const b = computeDriftIntensity({ genePoolSize: 100 });
  assert.equal(a, b);
});

test('computeDriftIntensity: driftEnabled with Ne <= 1 returns 0.7', () => {
  assert.equal(computeDriftIntensity({ driftEnabled: true, genePoolSize: 1 }), 0.7);
  assert.equal(computeDriftIntensity({ driftEnabled: true, genePoolSize: 0 }), 0.7);
});

test('selectGene: plateauOverride severity=required pins drift to 1.0', () => {
  // Without plateau: ne=52 → driftIntensity ≈ 0.139 (< 0.15, useDrift=false)
  // With plateau severity=required → driftIntensity = max(0.139, 1.0) = 1.0
  const g = makeGene('gene_a', ['log_error']);
  const r = selectGene([g, ...makeFiller()], ['log_error'], {
    plateauOverride: { active: true, severity: 'required' },
  });
  assert.equal(r.driftIntensity, 1);
});

test('selectGene: plateauOverride severity=suggested raises drift to 0.7 floor', () => {
  const g = makeGene('gene_a', ['log_error']);
  const r = selectGene([g, ...makeFiller()], ['log_error'], {
    plateauOverride: { active: true, severity: 'suggested' },
  });
  assert.equal(r.driftIntensity, 0.7);
});

test('selectGene: plateauOverride active=false is ignored', () => {
  const g = makeGene('gene_a', ['log_error']);
  const r = selectGene([g, ...makeFiller()], ['log_error'], {
    plateauOverride: { active: false, severity: 'required' },
  });
  assert.ok(r.driftIntensity < 0.5, `expected < 0.5, got ${r.driftIntensity}`);
});

test('selectGeneAndCapsule: passes plateauOverride and totalAttempts through', () => {
  const g = makeGene('gene_a', ['log_error']);
  const r = selectGeneAndCapsule({
    genes: [g, ...makeFiller()],
    capsules: [],
    signals: ['log_error'],
    memoryAdvice: { totalAttempts: 1000 },
    driftEnabled: true,
    plateauOverride: { active: true, severity: 'required' },
  });
  assert.equal(r.driftIntensity, 1);
});

test('selectGeneAndCapsule: failedCapsules merges with memoryAdvice.bannedGeneIds', () => {
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error']);
  const g3 = makeGene('gene_c', ['log_error']);
  const r = selectGeneAndCapsule({
    genes: [g1, g2, g3, ...makeFiller()],
    capsules: [],
    signals: ['log_error'],
    memoryAdvice: { bannedGeneIds: new Set(['gene_a']) },
    failedCapsules: [
      { gene: 'gene_b', trigger: ['log_error'] },
      { gene: 'gene_b', trigger: ['log_error'] },
    ],
  });
  assert.equal(r.selectedGene.id, 'gene_c');
});
