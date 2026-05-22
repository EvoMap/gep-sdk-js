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
| `src/protocolConstants.js` | Shared protocol enums such as `GEP_GENE_CATEGORIES` and `GEP_OUTCOME_STATUSES` |

## Install

```bash
npm install @evomap/gep-sdk
```

## Use as a schema source

```javascript
import geneSchema from '@evomap/gep-sdk/schemas/gene.schema.json' with { type: 'json' };
import { SCHEMA_VERSION, GEP_GENE_CATEGORIES } from '@evomap/gep-sdk';
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
| Protocol constants (`GEP_*`) | `@stable` — kept in lockstep with the shipped schemas |

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

## Contributing

Pull requests are welcome. All contributors must sign our
[Individual CLA](./CLA/ICLA.md) (or [Corporate CLA](./CLA/CCLA.md))
before merge — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the
workflow. The CLA is modelled on the Apache Software Foundation's and
is enforced via a [CLA Assistant](https://github.com/cla-assistant/github-action)
GitHub Action.

## Licence

- **Source code** (`src/`, `schemas/`, repository tooling) — licensed
  under the [Apache License, Version 2.0](./LICENSE). See [NOTICE](./NOTICE)
  for attribution requirements.
- **Specification** (`spec/gep-spec-v1.md` and any other documents
  under `spec/` or `docs/`) — licensed under
  [Creative Commons Attribution 4.0 International (CC-BY-4.0)](./spec/LICENSE-CC-BY-4.0.txt).
  Implementations may freely re-distribute and adapt the spec text
  with attribution to EvoMap.

The licences cover code and documentation only. **"EvoMap", "GEP",
and "Genome Evolution Protocol" are trademarks of EvoMap.** Apache 2.0
and CC-BY-4.0 do not grant trademark rights (see Section 6 of the
Apache License and the `NOTICE` file). Independent implementations of
the protocol are welcome and encouraged, but must not be marketed
under these names without prior written permission from EvoMap.
Contact `licensing@evomap.ai` to discuss attribution or co-marketing.

### Pre-1.3 history

`@evomap/gep-sdk` 1.0.x – 1.2.x was published under GPL-3.0-or-later.
Versions 1.3.0 and later are Apache-2.0. If you have an existing
deployment on 1.2.x and need to remain on the GPL line, those releases
remain available on npm; new fixes will be backported only on a
best-effort basis.
