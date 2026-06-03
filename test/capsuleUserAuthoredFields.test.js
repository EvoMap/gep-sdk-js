// Capsule user-authored DIY fields landed in schema 1.8.0 as an additive,
// backward-compatible change. The same invariants from 1.7.0 cost fields
// apply here:
//   1. the JSON Schema declares each new field as optional, nullable,
//      with the documented enum / shape;
//   2. capsules persisted before 1.8.0 keep their pre-existing asset_id
//      under canonicalization, because absent properties never enter the
//      canonical form;
//   3. setting a field to `null` is a *new* wire shape distinct from
//      omission (mirrors the cost-fields rule from 1.7.0).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SCHEMA_VERSION,
  canonicalize,
  computeAssetId,
  GEP_SOURCE_TYPES,
  GEP_CAPSULE_VISIBILITIES,
  GEP_CAPSULE_COST_TIERS,
} from '../src/index.js';

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

test('schema_version: at least 1.8.0 (capsule user-authored fields landed here)', () => {
  // The capsule user-authored fields landed in 1.8.0; later additive bumps
  // (e.g. 1.9.0 recipe schema) must not regress below it.
  const [maj, min] = SCHEMA_VERSION.split('.').map(Number);
  assert.ok(maj > 1 || (maj === 1 && min >= 8), `expected >= 1.8.0, got ${SCHEMA_VERSION}`);
});

test('schema: source_type enum extended with user_authored', () => {
  const enumVals = SCHEMA.properties.source_type.enum;
  assert.ok(enumVals.includes('user_authored'),
    `source_type enum missing 'user_authored': ${JSON.stringify(enumVals)}`);
  // Existing values still present (no breaking change).
  for (const v of ['generated', 'reused', 'reference', null]) {
    assert.ok(enumVals.includes(v));
  }
});

test('protocolConstants: GEP_SOURCE_TYPES includes user_authored', () => {
  assert.ok(GEP_SOURCE_TYPES.includes('user_authored'));
  // Existing values preserved.
  for (const v of ['generated', 'reused', 'reference']) {
    assert.ok(GEP_SOURCE_TYPES.includes(v));
  }
});

test('schema: visibility declared optional, nullable, enum-bounded', () => {
  const p = SCHEMA.properties.visibility;
  assert.deepEqual(p.type, ['string', 'null']);
  assert.deepEqual(p.enum, ['private', 'unlisted', 'public', null]);
  assert.ok(!SCHEMA.required.includes('visibility'));
});

test('protocolConstants: GEP_CAPSULE_VISIBILITIES matches schema enum', () => {
  // Frozen export side-by-side with the schema enum (sans the null).
  const schemaVals = SCHEMA.properties.visibility.enum.filter(v => v !== null);
  assert.deepEqual([...GEP_CAPSULE_VISIBILITIES], schemaVals);
});

test('schema: scope declared optional, nullable, array of non-empty strings', () => {
  const p = SCHEMA.properties.scope;
  assert.deepEqual(p.type, ['array', 'null']);
  assert.equal(p.items.type, 'string');
  assert.equal(p.items.minLength, 1);
  assert.ok(!SCHEMA.required.includes('scope'));
});

test('schema: cost_tier declared optional, nullable, enum-bounded', () => {
  const p = SCHEMA.properties.cost_tier;
  assert.deepEqual(p.type, ['string', 'null']);
  assert.deepEqual(p.enum, ['cheap', 'standard', 'premium', null]);
  assert.ok(!SCHEMA.required.includes('cost_tier'));
});

test('protocolConstants: GEP_CAPSULE_COST_TIERS matches schema enum', () => {
  const schemaVals = SCHEMA.properties.cost_tier.enum.filter(v => v !== null);
  assert.deepEqual([...GEP_CAPSULE_COST_TIERS], schemaVals);
});

test('schema: pack_of declared optional, nullable, array of asset_id strings', () => {
  // Items must match the same `^sha256:...` pattern as `asset_id` itself —
  // otherwise downstream Hub recall (Stage 4) would silently receive invalid
  // pointers like `pack_of: ["garbage"]`.
  const p = SCHEMA.properties.pack_of;
  assert.deepEqual(p.type, ['array', 'null']);
  assert.equal(p.items.type, 'string');
  assert.equal(p.items.pattern, '^sha256:[a-f0-9]{64}$');
  assert.equal(p.items.pattern, SCHEMA.properties.asset_id.pattern);
  assert.ok(!SCHEMA.required.includes('pack_of'));
});

test('schema: author declared optional, nullable, sealed object', () => {
  const p = SCHEMA.properties.author;
  assert.deepEqual(p.type, ['object', 'null']);
  assert.equal(p.additionalProperties, false);
  assert.ok(p.properties.handle);
  assert.equal(p.properties.handle.minLength, 1);
  assert.ok(p.properties.evox_install_id);
  assert.equal(p.properties.evox_install_id.minLength, 1);
  assert.ok(!SCHEMA.required.includes('author'));
});

test('schema: author sub-object requires both handle and evox_install_id', () => {
  // Without `required`, an empty `{}` would satisfy the author shape and
  // produce useless author records. The whole purpose of `author` is
  // identification (handle) and cross-node reconciliation (evox_install_id),
  // so neither sub-field is meaningfully optional.
  const p = SCHEMA.properties.author;
  assert.deepEqual(p.required, ['handle', 'evox_install_id']);
});

test('schema: additionalProperties remains false (no silent extra fields)', () => {
  assert.equal(SCHEMA.additionalProperties, false);
});

test('canonicalize: absent user-authored fields produce no canonical output', () => {
  const canon = canonicalize(baseCapsule());
  for (const f of ['visibility', 'scope', 'cost_tier', 'pack_of', 'author']) {
    assert.ok(!canon.includes(f),
      `canonical output unexpectedly contains "${f}": ${canon}`);
  }
});

test('asset_id: pre-1.8.0 carry-forward — adding any new field changes the hash', () => {
  // Documentation-by-test for downstream migrations: each new field, when
  // *present* on the wire (even as null), produces a fresh asset_id.
  const baseHash = computeAssetId(baseCapsule());
  const variants = [
    { source_type: 'user_authored' },
    { visibility: 'private' },
    { visibility: null },
    { scope: ['rust'] },
    { cost_tier: 'cheap' },
    { pack_of: ['sha256:' + 'b'.repeat(64)] },
    { author: { handle: 'alice', evox_install_id: 'evox_install_42' } },
  ];
  for (const v of variants) {
    assert.notEqual(
      baseHash,
      computeAssetId(baseCapsule(v)),
      `expected hash to change when adding ${JSON.stringify(v)}`,
    );
  }
});
