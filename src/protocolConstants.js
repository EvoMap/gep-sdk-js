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
  'user_authored',
]);

export const GEP_RISK_LEVELS = Object.freeze([
  'low',
  'medium',
  'high',
]);

// Capsule visibility controls who can recall a published capsule from the
// EvoMap Hub. `private` = author-only; `unlisted` = recallable by direct
// asset_id but not surfaced in browse/search; `public` = listed.
export const GEP_CAPSULE_VISIBILITIES = Object.freeze([
  'private',
  'unlisted',
  'public',
]);

// Coarse cost-tier label used by routers (e.g. evox model_router) to
// prefer cheap capsules first when a budget is set. Distinct from the
// numeric `cost_tokens` / `cost_usd` fields, which are point-in-time
// measurements; `cost_tier` is a stable selector.
export const GEP_CAPSULE_COST_TIERS = Object.freeze([
  'cheap',
  'standard',
  'premium',
]);

// Optional Gene.routing_hint tier — the cost class an EvoX-side router
// (e.g. evox model_router) should prefer when this gene is selected.
// NOTE: this is the routing-hint axis (`cheap|mid|expensive`) and is
// deliberately distinct from GEP_CAPSULE_COST_TIERS (`cheap|standard|
// premium`), which selects published capsules by price. The Rust side
// (`crates/evox-evo-session`) does case-sensitive matching on these.
export const GEP_GENE_ROUTING_TIERS = Object.freeze([
  'cheap',
  'mid',
  'expensive',
]);

// Optional Gene.routing_hint reasoning level — how much reasoning budget
// the router should grant. `off` disables extended reasoning.
export const GEP_GENE_REASONING_LEVELS = Object.freeze([
  'off',
  'low',
  'medium',
  'high',
]);

// Optional Gene.tool_policy severity — whether a tool-gate violation
// warns or hard-blocks the tool call. Defaults to `warn` when a policy
// list is present but severity is omitted.
export const GEP_GENE_TOOL_POLICY_SEVERITIES = Object.freeze([
  'warn',
  'block',
]);

// Five-coordinate evidence-projection axes (schema 1.13.0). These carry the
// machine-decidable coordinates a gene must state to enter the strict K_auto
// subdomain (claim-level conflict detection, verifier-specific projection).
// The version + content_hash coordinates already exist as schema_version and
// asset_id; these constants cover the remaining decidable axes. Absent axes
// keep a gene OUT of K_auto — undecidable coordinates never get benefit of the
// doubt, matching evolver-core's kautoValidator conservatism.

// Gene.claims[].kind — the class of assertion a claim makes.
export const GEP_GENE_CLAIM_KINDS = Object.freeze([
  'behavioral',
  'structural',
  'performance',
  'safety',
]);

// Gene.runtime_profile.env_class — the execution environment class under
// which a gene's claims were established.
export const GEP_GENE_RUNTIME_ENV_CLASSES = Object.freeze([
  'ci',
  'local',
  'prod',
  'sandbox',
]);

// Gene.verifier_profile.decision — the verifier's judgement on the claims.
export const GEP_GENE_VERIFIER_DECISIONS = Object.freeze([
  'pass',
  'fail',
  'inconclusive',
]);
