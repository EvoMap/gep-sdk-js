// Gene routing_hint / tool_policy landed in schema 1.12.0 as additive,
// backward-compatible fields that bring the schema into lockstep with the
// reference engine (evolver src/gep/schemas/gene.js), which had been
// emitting them on the wire ahead of the spec. Invariants:
//   1. the JSON Schema declares routing_hint / tool_policy as non-required,
//      nullable objects with additionalProperties:false and the same enums
//      evolver normalizes against — downstream Ajv consumers do the runtime
//      validation; we only assert the wire shape;
//   2. genes persisted before 1.12.0 keep their pre-existing asset_id under
//      canonicalization, because absent properties never enter the canonical
//      form;
//   3. the shared enums are exported as protocol constants so evolver /
//      evox-Rust consume them instead of re-declaring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SCHEMA_VERSION,
  canonicalize,
  computeAssetId,
  GEP_GENE_ROUTING_TIERS,
  GEP_GENE_REASONING_LEVELS,
  GEP_GENE_TOOL_POLICY_SEVERITIES,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'schemas/gene.schema.json'), 'utf8'),
);

function baseGene(overrides = {}) {
  return {
    type: 'Gene',
    schema_version: SCHEMA_VERSION,
    id: 'gene_repair_from_errors',
    category: 'repair',
    signals_match: ['log_error'],
    strategy: ['Inspect logs', 'Apply fix', 'Re-run validation'],
    constraints: { max_files: 20, forbidden_paths: ['.git', 'node_modules'] },
    validation: ['npm test'],
    asset_id: 'sha256:' + 'a'.repeat(64),
    ...overrides,
  };
}

test('schema: routing_hint declared optional, nullable object, strict', () => {
  const p = SCHEMA.properties.routing_hint;
  assert.deepEqual(p.type, ['object', 'null']);
  assert.equal(p.additionalProperties, false);
  assert.deepEqual(p.properties.tier.enum, ['cheap', 'mid', 'expensive']);
  assert.deepEqual(p.properties.reasoning_level.enum, ['off', 'low', 'medium', 'high']);
  assert.ok(!SCHEMA.required.includes('routing_hint'));
});

test('schema: tool_policy declared optional, nullable object, strict', () => {
  const p = SCHEMA.properties.tool_policy;
  assert.deepEqual(p.type, ['object', 'null']);
  assert.equal(p.additionalProperties, false);
  assert.equal(p.properties.allow_only.minItems, 1);
  assert.equal(p.properties.deny.minItems, 1);
  assert.deepEqual(p.properties.severity.enum, ['warn', 'block']);
  assert.ok(!SCHEMA.required.includes('tool_policy'));
});

test('schema: additionalProperties remains false (no silent extra fields)', () => {
  assert.equal(SCHEMA.additionalProperties, false);
});

test('schema enums agree with exported protocol constants', () => {
  assert.deepEqual(SCHEMA.properties.routing_hint.properties.tier.enum, [...GEP_GENE_ROUTING_TIERS]);
  assert.deepEqual(SCHEMA.properties.routing_hint.properties.reasoning_level.enum, [...GEP_GENE_REASONING_LEVELS]);
  assert.deepEqual(SCHEMA.properties.tool_policy.properties.severity.enum, [...GEP_GENE_TOOL_POLICY_SEVERITIES]);
});

test('canonicalize: absent routing_hint / tool_policy produce no canonical output', () => {
  const canon = canonicalize(baseGene());
  assert.ok(!canon.includes('routing_hint'));
  assert.ok(!canon.includes('tool_policy'));
});

test('asset_id: byte-stable for pre-1.12.0 genes (absent fields never hashed)', () => {
  // A gene authored before these fields existed must keep its id.
  const legacy = baseGene();
  const idLegacy = computeAssetId(legacy);
  // Explicitly setting the new fields to a value DOES change the id (they
  // are now part of the canonical form) — proving they participate when set.
  const withHints = baseGene({
    routing_hint: { tier: 'cheap', reasoning_level: 'low' },
    tool_policy: { deny: ['Bash'], severity: 'block' },
  });
  assert.notEqual(computeAssetId(withHints), idLegacy);
  // ...but a second legacy gene with the same content hashes identically.
  assert.equal(computeAssetId(baseGene()), idLegacy);
});

test('exported routing/tool-policy enums are frozen and correct', () => {
  assert.ok(Object.isFrozen(GEP_GENE_ROUTING_TIERS));
  assert.ok(Object.isFrozen(GEP_GENE_REASONING_LEVELS));
  assert.ok(Object.isFrozen(GEP_GENE_TOOL_POLICY_SEVERITIES));
  assert.deepEqual([...GEP_GENE_ROUTING_TIERS], ['cheap', 'mid', 'expensive']);
  assert.deepEqual([...GEP_GENE_REASONING_LEVELS], ['off', 'low', 'medium', 'high']);
  assert.deepEqual([...GEP_GENE_TOOL_POLICY_SEVERITIES], ['warn', 'block']);
});
