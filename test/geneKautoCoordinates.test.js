// Gene claims / scope / runtime_profile / verifier_profile landed in schema
// 1.13.0 as additive, backward-compatible fields. They carry the remaining
// machine-decidable coordinates of the five-coordinate evidence projection
// (the version + content_hash coordinates already exist as schema_version and
// asset_id). Only a gene that states these decidable coordinates enters the
// strict K_auto subdomain; absent coordinates keep it out (undecidable axes
// never get benefit of the doubt). Invariants:
//   1. the JSON Schema declares all four as non-required, nullable, with
//      additionalProperties:false sub-objects and the same enums the constants
//      export — downstream Ajv consumers do the runtime validation, we only
//      assert the wire shape;
//   2. genes persisted before 1.13.0 keep their pre-existing asset_id under
//      canonicalization, because absent properties never enter the canonical
//      form (spec §5);
//   3. the shared enums are exported as protocol constants so evolver /
//      Hub / evox-Rust consume them instead of re-declaring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SCHEMA_VERSION,
  canonicalize,
  computeAssetId,
  GEP_GENE_CLAIM_KINDS,
  GEP_GENE_RUNTIME_ENV_CLASSES,
  GEP_GENE_VERIFIER_DECISIONS,
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

test('schema includes 1.13.0 coordinates in the current 1.14.0 contract', () => {
  assert.equal(SCHEMA_VERSION, '1.14.0');
});

test('schema: claims/scope/runtime_profile/verifier_profile are optional', () => {
  for (const field of ['claims', 'scope', 'runtime_profile', 'verifier_profile']) {
    assert.ok(SCHEMA.properties[field], `${field} declared`);
    assert.ok(!SCHEMA.required.includes(field), `${field} not required`);
  }
});

test('schema: coordinate axes are nullable and strict', () => {
  // claims is a nullable array of strict objects
  assert.deepEqual(SCHEMA.properties.claims.type, ['array', 'null']);
  assert.equal(SCHEMA.properties.claims.items.additionalProperties, false);
  assert.deepEqual(SCHEMA.properties.claims.items.required, ['predicate']);

  // scope / runtime_profile / verifier_profile are nullable strict objects
  for (const field of ['scope', 'runtime_profile', 'verifier_profile']) {
    assert.deepEqual(SCHEMA.properties[field].type, ['object', 'null'], field);
    assert.equal(SCHEMA.properties[field].additionalProperties, false, field);
  }
});

test('schema: enums agree with exported protocol constants', () => {
  assert.deepEqual(
    SCHEMA.properties.claims.items.properties.kind.enum,
    [...GEP_GENE_CLAIM_KINDS],
  );
  assert.deepEqual(
    SCHEMA.properties.runtime_profile.properties.env_class.enum,
    [...GEP_GENE_RUNTIME_ENV_CLASSES],
  );
  assert.deepEqual(
    SCHEMA.properties.verifier_profile.properties.decision.enum,
    [...GEP_GENE_VERIFIER_DECISIONS],
  );
});

test('asset_id byte-stability: a legacy gene with no coordinate keys is unchanged', () => {
  // A pre-1.13.0 gene simply has none of the new keys. Adding the fields to
  // the schema must not alter its canonical form or asset_id — absent keys
  // never enter canonicalization (spec §5). Pinned constant guards against a
  // future canonicalize() change silently re-hashing the entire corpus.
  const legacy = baseGene({ schema_version: '1.13.0' });
  assert.equal(
    computeAssetId(legacy),
    'sha256:c4bece55c5d3a60af89cc727306c4969494b8bb65c5b10debc55646d64d1cfdb',
  );
});

test('coordinate contract: omit vs explicit null are NOT interchangeable', () => {
  // canonicalize() keeps own-keys even when their value is undefined/null and
  // renders them as `null`, so an explicit `claims: null` DOES change the
  // hash. Producers that have no coordinate MUST omit the key, not send null —
  // the same rule the tool_policy precedent documents. This test locks that
  // behaviour so K_auto producers can rely on it.
  const omitted = baseGene();
  const explicitNull = baseGene({
    claims: null, scope: null, runtime_profile: null, verifier_profile: null,
  });
  assert.notEqual(computeAssetId(omitted), computeAssetId(explicitNull));
});

test('asset_id: present coordinates DO enter the canonical form', () => {
  // A K_auto gene that actually states its coordinates must hash differently
  // from the bare gene — the coordinates are content, not metadata.
  const bare = baseGene();
  const kauto = baseGene({
    claims: [{ predicate: 'exit_code==0', kind: 'behavioral' }],
    scope: { signals: ['rounding-v2'], predicate: 'matches(rounding-v2)' },
    runtime_profile: { runtime: 'node@22', env_class: 'ci' },
    verifier_profile: { verifier: 'npm-test', decision: 'pass' },
  });
  assert.notEqual(computeAssetId(bare), computeAssetId(kauto));
  // and it round-trips: recompute over the same object is stable
  assert.equal(computeAssetId(kauto), computeAssetId({ ...kauto }));
});
