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

// @evomap/gep-sdk — single source of truth for the GEP protocol surface.
//
// This package intentionally carries no algorithm code. It distributes:
//   - the JSON Schemas (./schemas/*.schema.json)
//   - the human-readable specification (./spec/gep-spec-v1.md)
//   - the protocol-level helpers needed for cross-implementation
//     `asset_id` agreement (canonicalize / computeAssetId / verifyAssetId
//     and the SCHEMA_VERSION constant).
//
// Selection, signal extraction, gene scoring, memory-graph mechanics and
// every other behavioural decision live in concrete implementations
// (evolver, gep-mcp-server, evox-Rust). They MUST NOT be re-implemented
// here; doing so would re-introduce the drift this package exists to
// eliminate.
export { SCHEMA_VERSION, canonicalize, computeAssetId, verifyAssetId } from './contentHash.js';
export {
  GEP_GENE_CATEGORIES,
  GEP_MUTATION_CATEGORIES,
  GEP_OUTCOME_STATUSES,
  GEP_SOURCE_TYPES,
  GEP_RISK_LEVELS,
  GEP_CAPSULE_VISIBILITIES,
  GEP_CAPSULE_COST_TIERS,
  GEP_GENE_ROUTING_TIERS,
  GEP_GENE_REASONING_LEVELS,
  GEP_GENE_TOOL_POLICY_SEVERITIES,
} from './protocolConstants.js';
