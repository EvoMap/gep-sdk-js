// Copyright 2024-2026 EvoMap
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GEP_GENE_CATEGORIES,
  GEP_MUTATION_CATEGORIES,
  GEP_OUTCOME_STATUSES,
  GEP_RISK_LEVELS,
  GEP_SOURCE_TYPES,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function readSchema(name) {
  return JSON.parse(readFileSync(resolve(ROOT, 'schemas', name), 'utf8'));
}

test('GEP_GENE_CATEGORIES matches gene schema category enum', () => {
  const schema = readSchema('gene.schema.json');
  assert.deepEqual(GEP_GENE_CATEGORIES, schema.properties.category.enum);
  assert.ok(GEP_GENE_CATEGORIES.includes('explore'));
});

test('GEP_MUTATION_CATEGORIES matches mutation schema category enum', () => {
  const schema = readSchema('mutation.schema.json');
  assert.deepEqual(GEP_MUTATION_CATEGORIES, schema.properties.category.enum);
});

test('GEP_OUTCOME_STATUSES matches Capsule and EvolutionEvent schemas', () => {
  const capsule = readSchema('capsule.schema.json');
  const event = readSchema('evolution-event.schema.json');
  assert.deepEqual(GEP_OUTCOME_STATUSES, capsule.properties.outcome.properties.status.enum);
  assert.deepEqual(GEP_OUTCOME_STATUSES, event.properties.outcome.properties.status.enum);
  assert.ok(!GEP_OUTCOME_STATUSES.includes('failure'));
});

test('GEP_SOURCE_TYPES matches Capsule and EvolutionEvent schemas', () => {
  const capsule = readSchema('capsule.schema.json');
  const event = readSchema('evolution-event.schema.json');
  assert.deepEqual(
    [...GEP_SOURCE_TYPES, null],
    capsule.properties.source_type.enum,
  );
  assert.deepEqual(GEP_SOURCE_TYPES, event.properties.source_type.enum);
});

test('GEP_RISK_LEVELS matches mutation schema risk enum', () => {
  const schema = readSchema('mutation.schema.json');
  assert.deepEqual(GEP_RISK_LEVELS, schema.properties.risk_level.enum);
});
