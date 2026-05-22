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

// Protocol-level enums that have drifted across Hub / Evolver / MCP before.
// These constants intentionally carry no behaviour; consumers can import them
// when constructing validators, tool schemas, or docs.

export const GEP_GENE_CATEGORIES = Object.freeze([
  'repair',
  'optimize',
  'innovate',
  'explore',
]);

export const GEP_MUTATION_CATEGORIES = GEP_GENE_CATEGORIES;

export const GEP_OUTCOME_STATUSES = Object.freeze([
  'success',
  'failed',
]);

export const GEP_SOURCE_TYPES = Object.freeze([
  'generated',
  'reused',
  'reference',
]);

export const GEP_RISK_LEVELS = Object.freeze([
  'low',
  'medium',
  'high',
]);
