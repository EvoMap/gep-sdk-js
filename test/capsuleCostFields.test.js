// Capsule cost-attribution fields landed in schema 1.7.0 as an additive,
// backward-compatible change. Two invariants matter:
//   1. the JSON Schema declares cost_tokens / cost_usd as non-required,
//      nullable, with minimum 0 — downstream Ajv consumers do the actual
//      runtime validation; we only assert the wire shape;
//   2. capsules persisted before 1.7.0 keep their pre-existing asset_id
//      under canonicalization, because absent properties never enter the
//      canonical form.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCHEMA_VERSION, canonicalize, computeAssetId } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'schemas/capsule.schema.json'), 'utf8'),
);

function baseCapsule(overrides = {}) {
  return {
    type: 'Capsule',
    schema_version: SCHEMA_VERSION,
    id: 'capsule_test_1',
    trigger: ['log_error'],
    gene: 'gene_repair_from_errors',
    summary: 'fixed null deref in foo()',
    confidence: 0.9,
    blast_radius: { files: 1, lines: 4 },
    outcome: { status: 'success', score: 0.85 },
    asset_id: 'sha256:' + 'a'.repeat(64),
    ...overrides,
  };
}

test('schema: cost_tokens declared optional, nullable integer, minimum 0', () => {
  const p = SCHEMA.properties.cost_tokens;
  assert.deepEqual(p.type, ['integer', 'null']);
  assert.equal(p.minimum, 0);
  assert.ok(!SCHEMA.required.includes('cost_tokens'));
});

test('schema: cost_usd declared optional, nullable number, minimum 0', () => {
  const p = SCHEMA.properties.cost_usd;
  assert.deepEqual(p.type, ['number', 'null']);
  assert.equal(p.minimum, 0);
  assert.ok(!SCHEMA.required.includes('cost_usd'));
});

test('schema: additionalProperties remains false (no silent extra fields)', () => {
  assert.equal(SCHEMA.additionalProperties, false);
});

test('canonicalize: absent cost fields produce no canonical output', () => {
  const canon = canonicalize(baseCapsule());
  assert.ok(!canon.includes('cost_tokens'));
  assert.ok(!canon.includes('cost_usd'));
});

test('asset_id: adding cost fields produces a different hash', () => {
  assert.notEqual(
    computeAssetId(baseCapsule()),
    computeAssetId(baseCapsule({ cost_tokens: 12345, cost_usd: 0.0234 })),
  );
});

test('asset_id: pre-1.7.0 carry-forward — present-as-null is distinct from absent', () => {
  // Documentation-by-test for the implementation rule downstream consumers
  // must follow when migrating capsules: an absent cost field (the key is
  // never set on the capsule object) is the only shape that hashes
  // identically to a pre-1.7.0 capsule. Setting `cost_tokens: null` is a
  // new wire shape and produces a new asset_id.
  assert.notEqual(
    computeAssetId(baseCapsule()),
    computeAssetId(baseCapsule({ cost_tokens: null })),
  );
});
