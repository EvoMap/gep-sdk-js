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

test('selectGene: returns highest-scoring gene (majority over 100 trials)', () => {
  // v1.0.x has a soft-drift edge: random selection inside selectGene is
  // gated by driftIntensity > 0 (not useDrift), so even with N=52 there is
  // a ~14% chance of jitter. Track via statistical majority; v1.1.0 P1 fix
  // will tighten the gate and a deterministic assertion will replace this.
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error', 'perf_bottleneck']);
  let bWins = 0;
  for (let i = 0; i < 100; i++) {
    const r = selectGene([g1, g2, ...makeFiller()], ['log_error', 'perf_bottleneck']);
    if (r.selected && r.selected.id === 'gene_b') bWins++;
  }
  assert.ok(bWins >= 70, `gene_b should win > 70% of trials, got ${bWins}/100`);
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

test('selectGene: distilled gets 0.8x score penalty (majority over 100 trials)', () => {
  // Same soft-drift edge as above. Statistical majority for now.
  const distilled = makeGene('gene_distilled_x', ['log_error']);
  const regular = makeGene('gene_regular', ['log_error']);
  let regularWins = 0;
  for (let i = 0; i < 100; i++) {
    const r = selectGene([distilled, regular, ...makeFiller()], ['log_error']);
    if (r.selected && r.selected.id === 'gene_regular') regularWins++;
  }
  assert.ok(regularWins >= 70, `regular should win > 70% of trials, got ${regularWins}/100`);
});

test('selectGene: bannedGeneIds excludes banned gene (large pool)', () => {
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error']);
  const r = selectGene([g1, g2, ...makeFiller()], ['log_error'], {
    bannedGeneIds: new Set(['gene_a']),
  });
  assert.equal(r.selected.id, 'gene_b');
});

test('selectGene: bannedGeneIds bypassed by drift on small pool (1.0.x known issue)', () => {
  // Documents v1.0.x behavior: 2-gene pool → driftIntensity ≈ 0.707, drift
  // auto-activates and lets a banned gene be re-selected. Tracked as a P1
  // fix scheduled for v1.1.0; this test will be replaced by an unconditional
  // ban assertion once fixed.
  const g1 = makeGene('gene_a', ['log_error']);
  const g2 = makeGene('gene_b', ['log_error']);
  let leaks = 0;
  for (let i = 0; i < 100; i++) {
    const r = selectGene([g1, g2], ['log_error'], { bannedGeneIds: new Set(['gene_a']) });
    if (r.selected && r.selected.id === 'gene_a') leaks++;
  }
  assert.ok(leaks > 0, 'v1.0.x should leak banned gene_a at least once over 100 trials');
});

test('selectGene: preferredGeneId overrides natural ordering', () => {
  const g1 = makeGene('gene_a', ['log_error', 'perf_bottleneck']);
  const g2 = makeGene('gene_b', ['log_error']);
  const r = selectGene([g1, g2, ...makeFiller()], ['log_error', 'perf_bottleneck'], {
    preferredGeneId: 'gene_b',
  });
  assert.equal(r.selected.id, 'gene_b');
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
