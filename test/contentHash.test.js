import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SCHEMA_VERSION,
  canonicalize,
  computeAssetId,
  verifyAssetId,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

test('SCHEMA_VERSION matches spec front-matter and shipped schemas', () => {
  const spec = readFileSync(resolve(ROOT, 'spec/gep-spec-v1.md'), 'utf8');
  const m = spec.match(/Schema Version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/);
  assert.ok(m, 'spec must declare a Schema Version');
  assert.equal(SCHEMA_VERSION, m[1], 'JS constant lockstep with spec.md');

  // Every shipped JSON Schema's `schema_version` pattern is generic
  // (`^\\d+\\.\\d+\\.\\d+$`); the only literal version reference is in
  // `$id`. We assert that consumers reading these files alongside
  // `SCHEMA_VERSION` cannot trip over an inconsistent major.
  for (const f of readdirSync(resolve(ROOT, 'schemas'))) {
    const schema = JSON.parse(readFileSync(resolve(ROOT, 'schemas', f), 'utf8'));
    assert.equal(schema.$schema, 'http://json-schema.org/draft-07/schema#');
    assert.match(schema.$id, /^https:\/\/evomap\.ai\/gep\/schemas\//);
  }
});

test('canonicalize sorts object keys recursively and preserves array order', () => {
  const a = { b: [3, 1, 2], a: { z: 1, y: 2 } };
  assert.equal(
    canonicalize(a),
    '{"a":{"y":2,"z":1},"b":[3,1,2]}',
  );
});

test('canonicalize coerces non-finite numbers and undefined to null', () => {
  assert.equal(canonicalize({ x: NaN, y: Infinity, z: undefined }), '{"x":null,"y":null,"z":null}');
});

test('computeAssetId is deterministic and excludes asset_id field', () => {
  const a = { type: 'Gene', id: 'g1', schema_version: SCHEMA_VERSION };
  const id1 = computeAssetId(a);
  const id2 = computeAssetId({ ...a, asset_id: 'sha256:deadbeef' });
  assert.equal(id1, id2, 'asset_id field is excluded from the hash');
  assert.match(id1, /^sha256:[a-f0-9]{64}$/);
});

test('computeAssetId honours custom excludeFields', () => {
  const a = { type: 'Gene', id: 'g1', volatile: 'noise' };
  assert.notEqual(computeAssetId(a), computeAssetId(a, ['asset_id', 'volatile']));
});

test('verifyAssetId validates a stamped asset and rejects tampering', () => {
  const a = { type: 'Gene', id: 'g1', schema_version: SCHEMA_VERSION };
  a.asset_id = computeAssetId(a);
  assert.equal(verifyAssetId(a), true);
  a.id = 'tampered';
  assert.equal(verifyAssetId(a), false);
});
