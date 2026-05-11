# @evomap/gep-sdk

JavaScript/TypeScript SDK for the Genome Evolution Protocol (GEP). Provides the core primitives for building GEP-compatible tools and agents.

## Install

```bash
npm install @evomap/gep-sdk
```

## Modules

| Module | Key Exports |
|--------|-------------|
| `contentHash` | `computeAssetId`, `verifyAssetId`, `canonicalize`, `SCHEMA_VERSION` |
| `gene` | `createGene`, `validateGene`, `scoreGene`, `matchPatternToSignals` |
| `capsule` | `createCapsule`, `validateCapsule` |
| `mutation` | `buildMutation`, `validateMutation` |
| `signals` | `extractSignals`, `hasOpportunitySignal`, `analyzeRecentHistory` |
| `selector` | `selectGene`, `selectCapsule`, `selectGeneAndCapsule`, `banGenesFromFailedCapsules`, `computeSignalOverlap`, `computeDriftIntensity` |
| `memoryGraph` | `MemoryGraph` class, `computeSignalKey` |
| `assetStore` | `AssetStore` class (genes.json, capsules.json, events.jsonl) |
| `portable` | `exportGepx`, `importGepx` |
| `env` | `checkGitRepo`, `requireGitRepo` |

## Usage

```javascript
import {
  AssetStore,
  extractSignals,
  selectGeneAndCapsule,
  buildMutation,
} from "@evomap/gep-sdk";

const store = new AssetStore("/path/to/assets");
const genes = store.loadGenes();
const capsules = store.loadCapsules();

const signals = extractSignals({
  context: "Error: connection timeout after 30s",
});

const { selectedGene, capsuleCandidates } = selectGeneAndCapsule({
  genes,
  capsules,
  signals,
});

const mutation = buildMutation({ signals, selectedGene });
```

## Sub-path Imports

```javascript
import { extractSignals } from "@evomap/gep-sdk/signals";
import { AssetStore } from "@evomap/gep-sdk/asset-store";
import { MemoryGraph } from "@evomap/gep-sdk/memory-graph";
```

## Signal Detection

Supports EN, ZH-CN, ZH-TW, and JA for opportunity signals (feature requests, improvement suggestions). Error signals are detected from structured log patterns.

| Signal | Trigger |
|--------|---------|
| `log_error` | `[error]`, `error:`, `exception:` patterns |
| `user_feature_request:<snippet>` | "add a feature", "implement", multi-language |
| `user_improvement_suggestion:<snippet>` | "improve", "refactor", multi-language |
| `perf_bottleneck` | "slow", "timeout", "latency" |
| `capability_gap` | "not supported", "missing feature" |
| `stable_success_plateau` | No signals detected (default) |

## Stability

Public APIs follow semver. Each module has a stability marker:

| Marker | Meaning |
|--------|---------|
| `@stable` | Semver-protected. Breaking change requires a major bump. |
| `@experimental` | May change without warning between minor versions. |
| `@internal` | No stability promise; do not depend on this externally. |

Current state:

| Module | Stability |
|--------|-----------|
| `contentHash` (asset id, canonical hash) | `@stable` |
| `gene` (`createGene`, `validateGene`, `scoreGene`, `matchPatternToSignals`) | `@stable` |
| `capsule` (`createCapsule`, `validateCapsule`) | `@stable` |
| `mutation` (`buildMutation`, `validateMutation`) | `@stable` |
| `selector` (`selectGene`, `selectCapsule`, `selectGeneAndCapsule`, `computeDriftIntensity`) | `@stable` |
| `selector` (`banGenesFromFailedCapsules`, `computeSignalOverlap`) | `@experimental` (added in 1.1.0; thresholds may evolve) |
| `signals` (`extractSignals`, `hasOpportunitySignal`, `analyzeRecentHistory`) | `@stable` |
| `signals` `analyzeRecentHistory` extra fields (`consecutiveFailureCount`, `recentFailureRatio`, `signalFreq`) | `@experimental` (added in 1.1.0) |
| `memoryGraph`, `assetStore`, `portable`, `env` | `@stable` |

## What's new in 1.1.0

Three v1.0.x selector bugs fixed and several protocol-level extensions:

- **Hard ban suppression**: `bannedGeneIds` is now respected in all modes
  including drift. v1.0.x bypassed it on small pools, producing a
  self-defeating loop where failed genes were re-selected.
- **Soft memory preference**: `preferredGeneId` no longer overrides a
  strictly higher-scoring gene; it applies a 1.5x score boost. Prevents
  the popular-gene-spreads-into-unfit-contexts feedback loop.
- **Drift-gated jitter**: random selection inside `selectGene` now
  requires `useDrift = true`. v1.0.x triggered ~14% jitter on small
  pools with `driftEnabled: false`.
- **Adaptive maturity decay**: `computeDriftIntensity` accepts
  `effectivePopulationSize` and `memoryEvidence`. The exploration
  offset starts at 0.3 and decays to 0.02 once the memory graph has
  accumulated enough evidence.
- **`plateauOverride`**: `selectGene` accepts `plateauOverride =
  { active, severity }` to force exploration when exploitation has
  stalled.
- **`failedCapsules`**: `selectGeneAndCapsule` accepts a
  `failedCapsules` array; genes that fail twice on overlapping signal
  contexts are auto-banned via `banGenesFromFailedCapsules`.
- **History fields**: `analyzeRecentHistory` returns
  `consecutiveFailureCount`, `recentFailureRatio`, and a normalized
  `signalFreq` map.

All additions are backward-compatible: existing callers that don't pass
the new options see no behavior change beyond the three bug fixes.

## Requirements

- Node.js >= 18.0.0
- Zero runtime dependencies

## Related

- [@evomap/gep-mcp-server](https://github.com/EvoMap/gep-mcp-server) -- MCP Server for GEP
- [@evomap/evolver](https://github.com/EvoMap/evolver) -- Full self-evolution engine
- [EvoMap](https://evomap.ai) -- Agent evolution network

## License

GPL-3.0-or-later. See [LICENSE](./LICENSE).
