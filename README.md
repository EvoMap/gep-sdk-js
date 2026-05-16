# @evomap/gep-sdk

Single source of truth for the **Genome Evolution Protocol (GEP)**: JSON
Schemas, the human-readable specification, and the protocol-level helpers
that downstream implementations need to agree on `asset_id` values across
runtimes.

This package intentionally carries **no algorithm code**. Selection,
signal extraction, gene scoring and the rest of the evolution behaviour
live in concrete implementations (`@evomap/evolver`,
`@evomap/gep-mcp-server`, the evox Rust crates). They consume the
schemas and helpers shipped here so that bumping a field in
`schemas/gene.schema.json` propagates to every implementation in
lockstep — instead of drifting silently across four hand-maintained
copies.

## What's in the package

| Path | Contents |
|------|----------|
| `schemas/gene.schema.json` | Gene asset schema (Draft-07 JSON Schema) |
| `schemas/capsule.schema.json` | Capsule asset schema |
| `schemas/evolution-event.schema.json` | EvolutionEvent asset schema |
| `schemas/mutation.schema.json` | Mutation asset schema |
| `schemas/task.schema.json` | Task asset schema (bounty work items) |
| `spec/gep-spec-v1.md` | Full protocol specification |
| `src/contentHash.js` | `SCHEMA_VERSION`, `canonicalize`, `computeAssetId`, `verifyAssetId` |

## Install

```bash
npm install @evomap/gep-sdk
```

## Use as a schema source

```javascript
import geneSchema from '@evomap/gep-sdk/schemas/gene.schema.json' with { type: 'json' };
import { SCHEMA_VERSION } from '@evomap/gep-sdk';
// or: import { canonicalize, computeAssetId } from '@evomap/gep-sdk/content-hash';
```

Rust / non-JS consumers can resolve the same files through the package
on disk (e.g. `node_modules/@evomap/gep-sdk/schemas/gene.schema.json`)
and feed them into a code-generator such as `typify`.

## Use the asset-id helpers

```javascript
import { SCHEMA_VERSION, computeAssetId, verifyAssetId } from '@evomap/gep-sdk';

const gene = {
  type: 'Gene',
  schema_version: SCHEMA_VERSION,
  id: 'gene_repair_from_errors',
  category: 'repair',
  signals_match: ['log_error'],
  strategy: ['Inspect logs', 'Apply fix', 'Re-run validation'],
  constraints: { max_files: 20, forbidden_paths: ['.git', 'node_modules'] },
  validation: ['npm test'],
};
gene.asset_id = computeAssetId(gene);

verifyAssetId(gene); // true
```

`canonicalize` produces deterministic JSON (sorted keys at every level,
non-finite numbers and `undefined` coerced to `null`); `computeAssetId`
applies SHA-256 to the canonicalized form and prefixes `sha256:`.

## Stability

| Surface | Stability |
|---------|-----------|
| Schemas (`schemas/*.schema.json`) | `@stable` — additive minor bumps; breaking changes require a major version |
| Specification (`spec/gep-spec-v1.md`) | `@stable` |
| `SCHEMA_VERSION`, `canonicalize`, `computeAssetId`, `verifyAssetId` | `@stable` |

Anything not listed above is not part of this package.

## Migrating from 1.1.x

`@evomap/gep-sdk@1.1.0` exposed selection / signal-extraction /
memory-graph / asset-store helpers (`selectGene`, `extractSignals`,
`MemoryGraph`, `AssetStore`, …). Those modules have been removed in
**1.2.0** because they conflated a protocol package with implementation
behaviour. If you depended on any of them:

- **Use `@evomap/evolver`** for a complete self-evolution engine.
- **Use `@evomap/gep-mcp-server`** to expose evolution as MCP tools.
- For ad-hoc projects that *really* need the JS algorithm code, pin
  `@evomap/gep-sdk@1.1.0`. That release line will not receive new
  features, only critical fixes.

## Requirements

- Node.js >= 18.0.0
- Zero runtime dependencies

## Related

- [@evomap/evolver](https://github.com/EvoMap/evolver) — self-evolution engine
- [@evomap/gep-mcp-server](https://github.com/EvoMap/gep-mcp-server) — MCP server exposing GEP tools
- [EvoMap](https://evomap.ai) — agent evolution network

## License

GPL-3.0-or-later. See [LICENSE](./LICENSE).
