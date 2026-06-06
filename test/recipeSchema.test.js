// Recipe schema landed in 1.9.0 as an additive package export. A recipe is the
// create payload a node sends to POST /a2a/recipe — an ordered Gene/Capsule
// step sequence (a "genome"). Unlike Gene/Capsule it is NOT content-addressable
// (the Hub assigns the id), so there is no computeAssetId for it; we only assert
// the wire shape downstream Ajv consumers validate against.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCHEMA_VERSION } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'schemas/recipe.schema.json'), 'utf8'),
);
const PKG = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));

test('schema: requires title and steps only', () => {
  assert.deepEqual(SCHEMA.required, ['title', 'steps']);
});

test('schema: title is a string 3..200 chars', () => {
  const p = SCHEMA.properties.title;
  assert.equal(p.type, 'string');
  assert.equal(p.minLength, 3);
  assert.equal(p.maxLength, 200);
});

test('schema: steps is a bounded array (1..20) mirroring the hub step cap', () => {
  const p = SCHEMA.properties.steps;
  assert.equal(p.type, 'array');
  assert.equal(p.minItems, 1);
  assert.equal(p.maxItems, 20);
});

test('schema: each step requires a sha256 asset_id and a Gene|Capsule asset_type', () => {
  const item = SCHEMA.properties.steps.items;
  assert.deepEqual(item.required, ['asset_id', 'asset_type']);
  assert.equal(item.properties.asset_id.pattern, '^sha256:[a-f0-9]{64}$');
  assert.deepEqual(item.properties.asset_type.enum, ['Gene', 'Capsule']);
});

test('schema: price_per_execution, when given, is at least 1', () => {
  assert.equal(SCHEMA.properties.price_per_execution.minimum, 1);
});

test('schema: additionalProperties true (forward-compatible, like task)', () => {
  // Recipe is a managed Hub record, not a content-addressed asset, so unknown
  // forward fields must not break older validators.
  assert.equal(SCHEMA.additionalProperties, true);
  assert.equal(SCHEMA.properties.steps.items.additionalProperties, true);
});

test('package: recipe schema is exported and SCHEMA_VERSION is 1.11.0', () => {
  assert.equal(PKG.exports['./schemas/recipe.schema.json'], './schemas/recipe.schema.json');
  assert.equal(SCHEMA_VERSION, '1.11.0');
});

test('sample: a minimal valid recipe payload has the expected shape', () => {
  const recipe = {
    title: 'Clean Code Refactorer',
    steps: [
      { asset_id: 'sha256:' + 'a'.repeat(64), asset_type: 'Gene', position: 0 },
      { asset_id: 'sha256:' + 'b'.repeat(64), asset_type: 'Capsule', position: 1 },
    ],
  };
  // structural sanity (no ajv in this zero-dep package): required keys present,
  // step count within bounds, ids match the declared pattern.
  assert.ok(recipe.title.length >= 3);
  assert.ok(recipe.steps.length >= 1 && recipe.steps.length <= 20);
  const re = new RegExp(SCHEMA.properties.steps.items.properties.asset_id.pattern);
  for (const s of recipe.steps) {
    assert.ok(re.test(s.asset_id));
    assert.ok(['Gene', 'Capsule'].includes(s.asset_type));
  }
});
