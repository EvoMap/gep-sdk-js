# Contributing to @evomap/gep-sdk

Thanks for your interest in helping shape the Genome Evolution Protocol.
This package is the protocol's source of truth — schemas, the human spec,
and the cross-implementation `asset_id` helpers — so contributions here
ripple out to every downstream implementation (`evolver`,
`gep-mcp-server`, the evox Rust crates, and any third-party agent stack).

## Scope

In scope:

- Bug fixes to `canonicalize` / `computeAssetId` / `verifyAssetId`
  (these MUST stay byte-deterministic; see "Determinism guarantees" below)
- Additive JSON Schema changes (new optional fields → MINOR bump of
  `SCHEMA_VERSION`); breaking schema changes (MAJOR bump)
- Specification clarifications, typos, examples, edge-case wording
- Tests covering edge cases of the helpers above

Out of scope:

- Selection algorithms, signal extraction, gene scoring, memory-graph
  mechanics, or any other behavioural decision. Those live in concrete
  implementations; re-introducing them here is exactly the drift this
  package exists to prevent.
- Adding runtime dependencies. The SDK is intentionally
  zero-dependency; please don't break that.

## Contributor License Agreement (CLA)

Before we can merge any PR, contributors must sign the EvoMap
Individual Contributor License Agreement (ICLA) — or, if contributing
on behalf of a company, a Corporate CLA (CCLA). The agreement is
modelled on the Apache Software Foundation's standard ICLA/CCLA.

**How it works**: when you open your first PR, the
[CLA Assistant](https://github.com/cla-assistant/cla-assistant) bot
will post a link. Click through and sign with your GitHub identity.
Your future PRs are then auto-approved against the same signature.

The full agreement texts:

- [ICLA (individual)](./CLA/ICLA.md)
- [CCLA (corporate)](./CLA/CCLA.md)

By signing, you grant EvoMap (a) a perpetual copyright license to your
contribution under the terms of this repository's [Apache-2.0
LICENSE](./LICENSE), and (b) a patent peace covenant. You retain
ownership of your contribution. The CLA exists so EvoMap can offer
strong forward-looking guarantees to downstream users of the protocol
(re-licensing flexibility, patent peace, defence of the spec).

## Development workflow

```bash
git clone git@github.com:EvoMap/gep-sdk-js.git
cd gep-sdk-js
npm install      # zero deps; this is mostly a no-op
npm test         # runs node:test against test/*.test.js
```

Open a branch, push it to a fork, send a PR against `master`. CLA
Assistant will gate the merge until signature is on file.

## Determinism guarantees

`canonicalize` / `computeAssetId` are reproduced byte-for-byte across
JavaScript, Rust, and Python implementations of GEP. **Any change to
these functions is a protocol-level change**, even if it looks like a
local refactor. A PR that changes their output without bumping the
SDK MAJOR version and coordinating a cross-implementation rollout
will be rejected.

Edge cases that must remain stable:

- `null`, `undefined` → both serialise as `null`
- Non-finite numbers (`NaN`, `Infinity`, `-Infinity`) → `null`
- `-0` and `0` are equal (use `String(n)` semantics)
- Object keys are emitted in `Array.prototype.sort()` lexical order
- Strings are JSON-escaped (uses `JSON.stringify` semantics)
- `asset_id` is always excluded from its own hash input

If you find a divergence between implementations, file an issue
*before* sending a fix — we'll need to coordinate the rollout.

## Trademark policy

"EvoMap", "GEP", and "Genome Evolution Protocol" are trademarks of
EvoMap. The Apache 2.0 License does not grant permission to use them
(see Section 6 of the License and the repository's `NOTICE` file).
Forks and re-implementations of the protocol are welcome and
encouraged, but must not be marketed under these names without prior
written permission from EvoMap. Reach out at `licensing@evomap.ai`
if you'd like to discuss attribution or co-marketing.
