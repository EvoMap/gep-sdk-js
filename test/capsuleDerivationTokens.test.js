// Capsule derivation_tokens landed in schema 1.12.0 as an additive,
// backward-compatible field that brings the schema into lockstep with the
// reference engine (evolver src/gep/schemas/capsule.js), which had been
// emitting it on the wire ahead of the spec. Invariants:
//   1. the JSON Schema declares derivation_tokens as a non-required,
//      nullable object with required {input,output,total}_tokens and
//      additionalProperties:false — downstream Ajv consumers do the runtime
//      validation; we only assert the wire shape;
//   2. capsules persisted before 1.12.0 keep their pre-existing asset_id
//      under canonicalization, because absent properties never enter the
//      canonical form;
//   3. derivation_tokens is distinct from the point-in-time cost_tokens /
//      cost_usd scalars (measured basis vs. estimate).

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

test('schema: derivation_tokens declared optional, nullable object, strict', () => {
  const p = SCHEMA.properties.derivation_tokens;
  assert.deepEqual(p.type, ['object', 'null']);
  assert.equal(p.additionalProperties, false);
  assert.deepEqual(p.required, ['input_tokens', 'output_tokens', 'total_tokens']);
  assert.deepEqual(p.properties.input_tokens.type, 'integer');
  assert.equal(p.properties.input_tokens.minimum, 0);
  assert.equal(p.properties.output_tokens.minimum, 0);
  assert.equal(p.properties.total_tokens.minimum, 0);
  assert.deepEqual(p.properties.basis.type, 'string');
  assert.ok(!SCHEMA.required.includes('derivation_tokens'));
});

test('schema: derivation_tokens is distinct from cost_tokens / cost_usd', () => {
  // The measured-cost object must not collide with the point-in-time scalars.
  assert.ok(SCHEMA.properties.cost_tokens);
  assert.ok(SCHEMA.properties.cost_usd);
  assert.ok(SCHEMA.properties.derivation_tokens);
  assert.deepEqual(SCHEMA.properties.cost_tokens.type, ['integer', 'null']);
  assert.deepEqual(SCHEMA.properties.derivation_tokens.type, ['object', 'null']);
});

test('schema: additionalProperties remains false (no silent extra fields)', () => {
  assert.equal(SCHEMA.additionalProperties, false);
});

test('canonicalize: absent derivation_tokens produces no canonical output', () => {
  const canon = canonicalize(baseCapsule());
  assert.ok(!canon.includes('derivation_tokens'));
});

test('asset_id: byte-stable for pre-1.12.0 capsules; participates when set', () => {
  const legacy = baseCapsule();
  const idLegacy = computeAssetId(legacy);
  const withTokens = baseCapsule({
    derivation_tokens: {
      input_tokens: 1200,
      output_tokens: 340,
      total_tokens: 1540,
      basis: 'measured',
    },
  });
  assert.notEqual(computeAssetId(withTokens), idLegacy);
  assert.equal(computeAssetId(baseCapsule()), idLegacy);
});
