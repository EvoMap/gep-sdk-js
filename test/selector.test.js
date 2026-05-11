import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectGene, selectCapsule, selectGeneAndCapsule } from '../src/selector.js';
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
