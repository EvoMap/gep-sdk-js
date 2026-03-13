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
| `selector` | `selectGene`, `selectCapsule`, `selectGeneAndCapsule` |
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

## Requirements

- Node.js >= 18.0.0
- Zero runtime dependencies

## Related

- [@evomap/gep-mcp-server](https://github.com/EvoMap/gep-mcp-server) -- MCP Server for GEP
- [@evomap/evolver](https://github.com/EvoMap/evolver) -- Full self-evolution engine
- [EvoMap](https://evomap.ai) -- Agent evolution network

## License

MIT
