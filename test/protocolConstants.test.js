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
  GEP_ATTESTATION_SCHEMA,
  GEP_DEFAULT_MAX_DELEGATION_DEPTH,
  GEP_DELEGATION_POLICY_LAYERS,
  GEP_GENE_CATEGORIES,
  GEP_KYA_PROOF_SCHEMA,
  GEP_MUTATION_CATEGORIES,
  GEP_OUTCOME_STATUSES,
  GEP_RISK_LEVELS,
  GEP_SOURCE_TYPES,
  GEP_SWARM_HANDOFF_STAGES,
  GEP_VERIFICATION_MODES,
  GEP_WORK_ORDER_FUNDING_MODES,
  GEP_WORK_ORDER_TIERS,
  GEP_WORK_ORDER_TIER_FLOORS,
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

test('WorkOrder v1 task schema enums and tier floors match exported protocol constants', () => {
  const schema = readSchema('task.schema.json');
  assert.deepEqual(GEP_WORK_ORDER_TIERS, schema.properties.tier.enum);
  assert.deepEqual(GEP_WORK_ORDER_FUNDING_MODES, schema.properties.compute_funding_mode.enum);
  assert.deepEqual(GEP_SWARM_HANDOFF_STAGES, schema.properties.handoff_stage.enum);
  assert.deepEqual(Object.keys(GEP_WORK_ORDER_TIER_FLOORS), [...GEP_WORK_ORDER_TIERS]);
  assert.deepEqual(GEP_WORK_ORDER_TIER_FLOORS.standard, {
    compute_min_credits: 120,
    labor_min_credits: 30,
    max_iterations: 24,
  });
});

test('WorkOrder v1.1 delegation & privilege attenuation constants and task schema properties', () => {
  const schema = readSchema('task.schema.json');

  assert.equal(Object.isFrozen(GEP_DELEGATION_POLICY_LAYERS), true);
  assert.deepEqual(GEP_DELEGATION_POLICY_LAYERS, ['ceiling', 'human', 'agent', 'rar']);

  assert.equal(Object.isFrozen(GEP_VERIFICATION_MODES), true);
  assert.deepEqual(GEP_VERIFICATION_MODES, [
    'direct_deterministic',
    'sampled_zk_audit',
    'economic_stake',
    'escrow_clause',
  ]);
  assert.deepEqual(schema.properties.verification_mode.enum, GEP_VERIFICATION_MODES);

  assert.equal(GEP_ATTESTATION_SCHEMA, 'evomap.workorder.attestation.v1');
  assert.equal(GEP_KYA_PROOF_SCHEMA, 'evomap.kya.attribute_proof.v1');
  assert.equal(GEP_DEFAULT_MAX_DELEGATION_DEPTH, 1);

  assert.deepEqual(schema.properties.delegation_depth, {
    type: 'integer',
    minimum: 0,
  });
  assert.deepEqual(schema.properties.max_delegation_depth, {
    type: 'integer',
    minimum: 0,
    default: GEP_DEFAULT_MAX_DELEGATION_DEPTH,
  });

  const delegationAttestation = schema.properties.delegation_attestation;
  assert.equal(delegationAttestation.type, 'object');
  assert.equal(delegationAttestation.additionalProperties, false);
  assert.equal(delegationAttestation.properties.schema.const, GEP_ATTESTATION_SCHEMA);
  assert.deepEqual(Object.keys(delegationAttestation.properties), [
    'schema',
    'parent_task_id',
    'leaf_task_id',
    'contract_digest',
    'delivery_digest',
    'verifier_node_id',
    'depth',
    'issued_at',
    'attestation_digest',
  ]);

  const kyaAttestation = schema.properties.kya_attestation;
  assert.equal(kyaAttestation.type, 'object');
  assert.equal(kyaAttestation.additionalProperties, false);
  assert.equal(kyaAttestation.properties.schema.const, GEP_KYA_PROOF_SCHEMA);
  assert.deepEqual(Object.keys(kyaAttestation.properties), [
    'schema',
    'proof_type',
    'issuer',
    'max_spend_credits',
    'expires_at',
    'proof_digest',
  ]);
});

