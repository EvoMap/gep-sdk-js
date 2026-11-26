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
  GEP_SWARM_HANDOFF_STAGES,
  GEP_WORK_ORDER_FUNDING_MODES,
  GEP_WORK_ORDER_TIERS,
  GEP_WORK_ORDER_TIER_FLOORS,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TASK_SCHEMA = JSON.parse(readFileSync(resolve(ROOT, 'schemas/task.schema.json'), 'utf8'));
const SPEC_TEXT = readFileSync(resolve(ROOT, 'spec/gep-spec-v1.md'), 'utf8');
const README_TEXT = readFileSync(resolve(ROOT, 'README.md'), 'utf8');

function matchesJsonType(value, expectedType) {
  if (expectedType === 'null') return value === null;
  if (expectedType === 'array') return Array.isArray(value);
  if (expectedType === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
  if (expectedType === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (expectedType === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expectedType;
}

function validateAgainstSchema(value, schema, path = '$') {
  const errors = [];

  if (Object.hasOwn(schema, 'const') && value !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    return errors;
  }

  if (schema.type !== undefined) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowedTypes.some(t => matchesJsonType(value, t))) {
      errors.push(`${path}: expected type ${allowedTypes.join('|')}, got ${JSON.stringify(value)}`);
      return errors;
    }
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(`${path}: value ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
  }

  if (value === null || value === undefined) {
    return errors;
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: length ${value.length} < minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: length ${value.length} > maxLength ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: does not match pattern ${schema.pattern}`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: array length ${value.length} < minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: array length ${value.length} > maxItems ${schema.maxItems}`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateAgainstSchema(item, schema.items, `${path}[${index}]`));
      });
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    for (const reqKey of schema.required ?? []) {
      if (!Object.hasOwn(value, reqKey) || value[reqKey] === undefined) {
        errors.push(`${path}: missing required property "${reqKey}"`);
      }
    }
    const props = schema.properties ?? {};
    for (const [key, propVal] of Object.entries(value)) {
      if (propVal === undefined) continue;
      if (Object.hasOwn(props, key)) {
        errors.push(...validateAgainstSchema(propVal, props[key], `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected additional property "${key}"`);
      }
    }
  }

  return errors;
}

function validWorkOrder(overrides = {}) {
  return {
    type: 'Task',
    task_id: 'wo_20261127_001',
    title: 'Implement WorkOrder v1 schema validation',
    status: 'open',
    tier: 'standard',
    compute_funding_mode: 'buyer_gateway_key',
    compute_max_credits: 240,
    labor_reward_credits: 60,
    verify_commands: ['npm test', 'npm pack --dry-run'],
    parent_swarm_run_id: 'swarm_run_abc123',
    leaf_index: 3,
    handoff_stage: 'handed_to_agent',
    repo_mount: {
      owner_repo: 'EvoMap/gep-sdk-js',
      base_sha: 'd3dac469a9cfb69efad0c0d640ca7c9faa687c72',
      writable_paths: ['schemas/', 'src/', 'spec/', 'test/'],
    },
    ...overrides,
  };
}

test('task.schema.json accepts legacy minimal Task and full WorkOrder v1 payloads', () => {
  assert.deepEqual(
    validateAgainstSchema({ type: 'Task', task_id: 'task_legacy_1', status: 'open' }, TASK_SCHEMA),
    [],
  );
  assert.deepEqual(validateAgainstSchema(validWorkOrder(), TASK_SCHEMA), []);
});

test('task.schema.json accepts nullable WorkOrder v1 fields as null and preserves outer forward-compatibility', () => {
  const nullableAndExtended = validWorkOrder({
    parent_swarm_run_id: null,
    leaf_index: null,
    repo_mount: null,
    worker_local_deadline_ms: 1700000000000,
  });
  assert.deepEqual(validateAgainstSchema(nullableAndExtended, TASK_SCHEMA), []);
});

test('task.schema.json accepts exact numeric, string, and array boundary limits', () => {
  const minBounds = validWorkOrder({
    compute_max_credits: 1,
    labor_reward_credits: 1,
    leaf_index: 0,
    verify_commands: ['a'],
    repo_mount: {
      owner_repo: 'a/b',
      base_sha: '1234567',
      writable_paths: ['x'],
    },
  });
  const maxBounds = validWorkOrder({
    compute_max_credits: 10000,
    labor_reward_credits: 100000,
    leaf_index: 63,
    parent_swarm_run_id: 's'.repeat(128),
    verify_commands: Array.from({ length: 10 }, () => 'c'.repeat(512)),
    repo_mount: {
      owner_repo: 'r'.repeat(160),
      base_sha: 'f'.repeat(64),
      writable_paths: Array.from({ length: 20 }, () => 'p'.repeat(256)),
    },
  });

  assert.deepEqual(validateAgainstSchema(minBounds, TASK_SCHEMA), []);
  assert.deepEqual(validateAgainstSchema(maxBounds, TASK_SCHEMA), []);
});

const INVALID_CASES = [
  ['missing required status', { type: 'Task', task_id: 'wo_1' }, '$.status'],
  ['empty task_id', validWorkOrder({ task_id: '' }), '$.task_id'],
  ['wrong type discriminator', validWorkOrder({ type: 'Gene' }), '$.type'],
  ['unknown status enum', validWorkOrder({ status: 'in_progress' }), '$.status'],
  ['unknown tier enum', validWorkOrder({ tier: 'enterprise' }), '$.tier'],
  ['null tier (non-nullable)', validWorkOrder({ tier: null }), '$.tier'],
  ['unknown compute_funding_mode', validWorkOrder({ compute_funding_mode: 'free_pool' }), '$.compute_funding_mode'],
  ['null compute_funding_mode', validWorkOrder({ compute_funding_mode: null }), '$.compute_funding_mode'],
  ['compute_max_credits below 1', validWorkOrder({ compute_max_credits: 0 }), '$.compute_max_credits'],
  ['compute_max_credits above 10000', validWorkOrder({ compute_max_credits: 10001 }), '$.compute_max_credits'],
  ['compute_max_credits float', validWorkOrder({ compute_max_credits: 12.5 }), '$.compute_max_credits'],
  ['labor_reward_credits below 1', validWorkOrder({ labor_reward_credits: 0 }), '$.labor_reward_credits'],
  ['labor_reward_credits above 100000', validWorkOrder({ labor_reward_credits: 100001 }), '$.labor_reward_credits'],
  ['labor_reward_credits float', validWorkOrder({ labor_reward_credits: 99.9 }), '$.labor_reward_credits'],
  ['verify_commands empty command string', validWorkOrder({ verify_commands: [''] }), '$.verify_commands[0]'],
  ['verify_commands command over 512 chars', validWorkOrder({ verify_commands: ['x'.repeat(513)] }), '$.verify_commands[0]'],
  ['verify_commands over 10 items', validWorkOrder({ verify_commands: Array.from({ length: 11 }, (_, i) => `cmd_${i}`) }), '$.verify_commands'],
  ['verify_commands non-array', validWorkOrder({ verify_commands: 'npm test' }), '$.verify_commands'],
  ['parent_swarm_run_id over 128 chars', validWorkOrder({ parent_swarm_run_id: 'p'.repeat(129) }), '$.parent_swarm_run_id'],
  ['parent_swarm_run_id wrong type', validWorkOrder({ parent_swarm_run_id: 42 }), '$.parent_swarm_run_id'],
  ['leaf_index negative', validWorkOrder({ leaf_index: -1 }), '$.leaf_index'],
  ['leaf_index above 63', validWorkOrder({ leaf_index: 64 }), '$.leaf_index'],
  ['leaf_index non-integer', validWorkOrder({ leaf_index: 1.5 }), '$.leaf_index'],
  ['unknown handoff_stage enum', validWorkOrder({ handoff_stage: 'running' }), '$.handoff_stage'],
  ['null handoff_stage', validWorkOrder({ handoff_stage: null }), '$.handoff_stage'],
  [
    'repo_mount missing required writable_paths',
    validWorkOrder({ repo_mount: { owner_repo: 'EvoMap/gep-sdk-js', base_sha: 'abcdef1' } }),
    '$.repo_mount',
  ],
  [
    'repo_mount extra unknown property rejected by strict additionalProperties:false',
    validWorkOrder({
      repo_mount: {
        owner_repo: 'EvoMap/gep-sdk-js',
        base_sha: 'abcdef1',
        writable_paths: ['src/'],
        branch: 'master',
      },
    }),
    '$.repo_mount',
  ],
  [
    'repo_mount owner_repo shorter than 3 chars',
    validWorkOrder({
      repo_mount: { owner_repo: 'ab', base_sha: 'abcdef1', writable_paths: ['src/'] },
    }),
    '$.repo_mount.owner_repo',
  ],
  [
    'repo_mount owner_repo longer than 160 chars',
    validWorkOrder({
      repo_mount: { owner_repo: 'o'.repeat(161), base_sha: 'abcdef1', writable_paths: ['src/'] },
    }),
    '$.repo_mount.owner_repo',
  ],
  [
    'repo_mount base_sha shorter than 7 chars',
    validWorkOrder({
      repo_mount: { owner_repo: 'EvoMap/gep-sdk-js', base_sha: '123456', writable_paths: ['src/'] },
    }),
    '$.repo_mount.base_sha',
  ],
  [
    'repo_mount base_sha longer than 64 chars',
    validWorkOrder({
      repo_mount: { owner_repo: 'EvoMap/gep-sdk-js', base_sha: 'f'.repeat(65), writable_paths: ['src/'] },
    }),
    '$.repo_mount.base_sha',
  ],
  [
    'repo_mount writable_paths empty array',
    validWorkOrder({
      repo_mount: { owner_repo: 'EvoMap/gep-sdk-js', base_sha: 'abcdef1', writable_paths: [] },
    }),
    '$.repo_mount.writable_paths',
  ],
  [
    'repo_mount writable_paths over 20 entries',
    validWorkOrder({
      repo_mount: {
        owner_repo: 'EvoMap/gep-sdk-js',
        base_sha: 'abcdef1',
        writable_paths: Array.from({ length: 21 }, (_, i) => `dir_${i}/`),
      },
    }),
    '$.repo_mount.writable_paths',
  ],
  [
    'repo_mount writable_paths empty entry string',
    validWorkOrder({
      repo_mount: { owner_repo: 'EvoMap/gep-sdk-js', base_sha: 'abcdef1', writable_paths: [''] },
    }),
    '$.repo_mount.writable_paths[0]',
  ],
  [
    'repo_mount writable_paths entry over 256 chars',
    validWorkOrder({
      repo_mount: {
        owner_repo: 'EvoMap/gep-sdk-js',
        base_sha: 'abcdef1',
        writable_paths: ['p'.repeat(257)],
      },
    }),
    '$.repo_mount.writable_paths[0]',
  ],
];

for (const [label, payload, expectedPathPrefix] of INVALID_CASES) {
  test(`task.schema.json rejects invalid payload: ${label}`, () => {
    const errors = validateAgainstSchema(payload, TASK_SCHEMA);
    assert.ok(errors.length > 0, `Expected schema rejection for ${label}`);
    assert.ok(
      errors.some(err => err.startsWith(expectedPathPrefix) || err.startsWith('$:')),
      `Expected error near ${expectedPathPrefix}, got: ${errors.join('; ')}`,
    );
  });
}

test('WorkOrder v1 constants are deeply frozen and floors sit inside schema credit bounds', () => {
  assert.equal(Object.isFrozen(GEP_WORK_ORDER_TIERS), true);
  assert.equal(Object.isFrozen(GEP_WORK_ORDER_FUNDING_MODES), true);
  assert.equal(Object.isFrozen(GEP_SWARM_HANDOFF_STAGES), true);
  assert.equal(Object.isFrozen(GEP_WORK_ORDER_TIER_FLOORS), true);

  const computeSchema = TASK_SCHEMA.properties.compute_max_credits;
  const laborSchema = TASK_SCHEMA.properties.labor_reward_credits;

  for (const tier of GEP_WORK_ORDER_TIERS) {
    const floor = GEP_WORK_ORDER_TIER_FLOORS[tier];
    assert.ok(floor, `missing floor for tier ${tier}`);
    assert.equal(Object.isFrozen(floor), true);
    assert.ok(
      floor.compute_min_credits >= computeSchema.minimum &&
        floor.compute_min_credits <= computeSchema.maximum,
    );
    assert.ok(
      floor.labor_min_credits >= laborSchema.minimum &&
        floor.labor_min_credits <= laborSchema.maximum,
    );
    assert.ok(Number.isInteger(floor.max_iterations) && floor.max_iterations > 0);
  }

  assert.deepEqual(GEP_WORK_ORDER_TIER_FLOORS, {
    light: { compute_min_credits: 25, labor_min_credits: 10, max_iterations: 12 },
    standard: { compute_min_credits: 120, labor_min_credits: 30, max_iterations: 24 },
    flagship: { compute_min_credits: 400, labor_min_credits: 80, max_iterations: 40 },
  });
});

test('spec/gep-spec-v1.md and README.md document all WorkOrder v1 fields and exported constants', () => {
  const requiredTokens = [
    'verify_commands',
    'tier',
    'compute_funding_mode',
    'compute_max_credits',
    'labor_reward_credits',
    'parent_swarm_run_id',
    'leaf_index',
    'handoff_stage',
    'repo_mount',
    'owner_repo',
    'base_sha',
    'writable_paths',
    'GEP_WORK_ORDER_TIERS',
    'GEP_WORK_ORDER_FUNDING_MODES',
    'GEP_SWARM_HANDOFF_STAGES',
    'GEP_WORK_ORDER_TIER_FLOORS',
  ];

  for (const token of requiredTokens) {
    assert.ok(SPEC_TEXT.includes(`\`${token}\``), `spec/gep-spec-v1.md must document ${token}`);
    assert.ok(README_TEXT.includes(`\`${token}\``), `README.md must document ${token}`);
  }
});
