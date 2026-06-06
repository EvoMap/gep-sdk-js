// Pack schema: a curated Gene-id whitelist with a display name + visibility.
// Like Recipe it is NOT content-addressable (hub-assigned slug id), so there is
// no computeAssetId for it; we assert the wire shape downstream Ajv consumers
// validate against.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(resolve(__dirname, '..', 'schemas/pack.schema.json'), 'utf8'));
const PKG = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));

test('schema: required is id/type/name/gene_ids/visibility/created_at', () => {
  assert.deepEqual(SCHEMA.required, ['id', 'type', 'name', 'gene_ids', 'visibility', 'created_at']);
});
test('schema: additionalProperties is false (extensions go through schema bumps)', () => {
  assert.equal(SCHEMA.additionalProperties, false);
});
test('schema: gene_ids is a unique string array capped at 64', () => {
  const g = SCHEMA.properties.gene_ids;
  assert.equal(g.type, 'array');
  assert.equal(g.uniqueItems, true);
  assert.equal(g.maxItems, 64);
  assert.equal(g.items.type, 'string');
});
test('schema: visibility enum private/unlisted/public', () => {
  assert.deepEqual(SCHEMA.properties.visibility.enum, ['private', 'unlisted', 'public']);
});
test('schema: id is a slug, not a content hash', () => {
  assert.equal(SCHEMA.properties.id.pattern, '^[a-z0-9-]+$');
});
test('package: pack schema is exported', () => {
  assert.ok(PKG.exports['./schemas/pack.schema.json']);
});

test('schema: owner is strict (additionalProperties false) and handle is non-empty', () => {
  assert.equal(SCHEMA.properties.owner.additionalProperties, false);
  assert.equal(SCHEMA.properties.owner.properties.handle.minLength, 1);
});

test('schema: type discriminator is PascalCase Pack (consistent with Gene/Capsule/Task)', () => {
  assert.equal(SCHEMA.properties.type.const, 'Pack');
});
