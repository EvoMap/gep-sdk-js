// Gene skills_required landed in schema 1.15.0 as an additive, backward-
// compatible field: the Skill Store skills a gene's strategy depends on.
// Invariants:
//   1. the JSON Schema declares it optional, with strict items that name a
//      Skill Store skill — downstream Ajv consumers do the runtime
//      validation, we only assert the wire shape;
//   2. genes persisted before 1.15.0 keep their asset_id, because absent
//      properties never enter the canonical form (spec §5);
//   3. the dependency list is content-addressed: changing it changes the
//      asset_id, so a hub cannot swap the skill a published gene points at.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeAssetId } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'schemas/gene.schema.json'), 'utf8'),
);
const FIELD = SCHEMA.properties.skills_required;

function gene(overrides = {}) {
  return {
    type: 'Gene',
    schema_version: '1.14.0',
    id: 'gene_weekly_report',
    category: 'optimize',
    signals_match: ['weekly_report'],
    strategy: ['Open the report-builder skill', 'Run its build script'],
    constraints: { max_files: 5, forbidden_paths: ['.git'] },
    validation: ['npm test'],
    ...overrides,
  };
}

test('schema: skills_required is an optional, bounded array of strict Skill Store references', () => {
  assert.ok(!SCHEMA.required.includes('skills_required'));
  assert.equal(FIELD.type, 'array');
  assert.deepEqual([FIELD.minItems, FIELD.maxItems], [1, 8]);
  assert.deepEqual(FIELD.items.required, ['type', 'skill_id']);
  assert.equal(FIELD.items.additionalProperties, false);
  assert.deepEqual(Object.keys(FIELD.items.properties).sort(), ['name', 'skill_id', 'type', 'version']);
  assert.deepEqual(FIELD.items.properties.type.enum, ['internal']);
});

test('schema: skill_id admits store identifiers and rejects paths and URLs', () => {
  const pattern = new RegExp(FIELD.items.properties.skill_id.pattern);
  for (const id of ['skill_report_builder', 'pdf-tools', 'a']) assert.ok(pattern.test(id), id);
  for (const id of ['', '../escape', 'a/b', 'https://example.com/s', '.hidden', 'x'.repeat(101)]) {
    assert.ok(!pattern.test(id), id);
  }
});

test('a gene without skills_required keeps its pre-1.15.0 asset_id', () => {
  assert.equal(
    computeAssetId(gene()),
    'sha256:eba9f70fd22b726958202b48d8b40729d88697daccea938587130a0f3583ab47',
  );
});

test('the dependency list is part of the content address', () => {
  const requires = (skill_id, version) => gene({ skills_required: [{ type: 'internal', skill_id, version }] });
  const pinned = computeAssetId(requires('skill_report_builder', '1.0.0'));
  assert.notEqual(pinned, computeAssetId(gene()));
  assert.notEqual(pinned, computeAssetId(requires('skill_other', '1.0.0')));
  assert.notEqual(pinned, computeAssetId(requires('skill_report_builder', '2.0.0')));
});
