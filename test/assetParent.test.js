import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeAssetId, verifyAssetId } from '../src/index.js';

const schemas = ['gene', 'capsule'].map(kind => JSON.parse(
  readFileSync(new URL(`../schemas/${kind}.schema.json`, import.meta.url), 'utf8'),
));
const parent = 'sha256:' + 'a'.repeat(64);

for (const schema of schemas) {
  test(`${schema.title}: accepts an optional canonical parent without loosening other fields`, () => {
    const field = schema.properties.parent;
    assert.ok(field, 'A declared asset parent must survive strict wire validation');
    assert.equal(field.type, 'string');
    assert.equal(field.minLength, 71);
    assert.equal(field.maxLength, 71);
    assert.equal(schema.required.includes('parent'), false);
    assert.equal(schema.additionalProperties, false);
    const matches = value => typeof value === field.type && value.length >= field.minLength
      && value.length <= field.maxLength && new RegExp(field.pattern).test(value);
    assert.equal(matches(parent), true);
    for (const invalid of [null, 1, [], '', 'gene-local', 'sha256:a', 'sha256:' + 'A'.repeat(64), parent + '\n']) {
      assert.equal(matches(invalid), false, `Invalid parent ${JSON.stringify(invalid)}`);
    }
  });
}

test('declaring a parent binds the derived asset identity and later tampering fails verification', () => {
  const child = { type: 'Gene', schema_version: '1.14.0', id: 'child', parent };
  child.asset_id = computeAssetId(child);
  assert.equal(verifyAssetId(child), true);
  assert.notEqual(child.asset_id, computeAssetId({ ...child, parent: 'sha256:' + 'b'.repeat(64) }));
  const original = { type: 'Gene', schema_version: '1.14.0', id: 'child' };
  assert.notEqual(child.asset_id, computeAssetId(original));
  child.parent = 'sha256:' + 'b'.repeat(64);
  assert.equal(verifyAssetId(child), false);
});

test('pre-lineage Gene and Capsule golden identities remain unchanged without parent', () => {
  const gene = { type: 'Gene', schema_version: '1.14.0', id: 'gene-lineage', category: 'repair',
    signals_match: ['lineage'], strategy: ['Preserve the source identity'],
    constraints: { max_files: 1, forbidden_paths: ['.git'] }, validation: ['node --test'] };
  const capsule = { type: 'Capsule', schema_version: '1.14.0', id: 'capsule-lineage',
    trigger: ['lineage'], gene: 'gene-lineage', summary: 'Preserved lineage', confidence: 1,
    blast_radius: { files: 1, lines: 1 }, outcome: { status: 'success', score: 1 } };
  // Independent JSON/SHA-256 vectors; do not update historical schema_version when loading old assets.
  assert.equal(computeAssetId(gene), 'sha256:12bea2147ed3d697601c755f92fc9f08dc79d6f38e8d8883d02bb3454b4df20e');
  assert.equal(computeAssetId(capsule), 'sha256:c3d70d07fae9cb08929301a7651426f8639b3a676b32005d529769d6af0ef7a8');
});
