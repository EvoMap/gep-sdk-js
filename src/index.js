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
