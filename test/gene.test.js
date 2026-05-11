import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGene, validateGene, scoreGene, matchPatternToSignals } from '../src/gene.js';

function makeGene(overrides = {}) {
  return createGene({
    id: 'gene_test_basic',
    category: 'repair',
    signals_match: ['log_error'],
    strategy: ['step 1'],
    constraints: { max_files: 5, forbidden_paths: ['.git'] },
    validation: ['unit test'],
    ...overrides,
  });
}

test('matchPatternToSignals: substring match', () => {
  assert.equal(matchPatternToSignals('error', ['log_error']), true);
  assert.equal(matchPatternToSignals('xxx', ['log_error']), false);
});

test('matchPatternToSignals: regex pattern', () => {
  assert.equal(matchPatternToSignals('/^log_/', ['log_error']), true);
  assert.equal(matchPatternToSignals('/^err_/', ['log_error']), false);
});

test('matchPatternToSignals: multi-language alias with |', () => {
  assert.equal(matchPatternToSignals('feature|功能|機能', ['user_feature_request:add a feature']), true);
  assert.equal(matchPatternToSignals('feature|功能|機能', ['user_feature_request:加个功能']), true);
  assert.equal(matchPatternToSignals('feature|功能|機能', ['log_error']), false);
});

test('scoreGene: counts matching patterns', () => {
  const g = makeGene({ signals_match: ['log_error', 'perf_bottleneck'] });
  assert.equal(scoreGene(g, ['log_error']), 1);
  assert.equal(scoreGene(g, ['log_error', 'perf_bottleneck']), 2);
  assert.equal(scoreGene(g, ['unrelated']), 0);
});

test('scoreGene: non-Gene returns 0', () => {
  assert.equal(scoreGene({ type: 'Capsule' }, ['log_error']), 0);
  assert.equal(scoreGene(null, ['log_error']), 0);
});

test('validateGene: rejects missing required fields', () => {
  const r = validateGene({ type: 'Gene', id: 'g1' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.length > 0);
});

test('validateGene: accepts a well-formed gene', () => {
  const g = makeGene();
  assert.equal(validateGene(g).valid, true);
});

test('createGene: throws on invalid input', () => {
  assert.throws(() => createGene({ id: 'bad', category: 'repair' }));
});
