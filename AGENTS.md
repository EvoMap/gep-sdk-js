# Agent notes — @evomap/gep-sdk

## Scope is the requester's to narrow, not yours

Deliver the complete requested outcome. Do not slice a request into `v0`, `MVP`,
or "the core bit first", and do not quietly degrade an implementation into a mock,
a stub, or a TODO to be filled in later. If something genuinely cannot land,
finish everything else and **say plainly** what is missing and why. Narrowing
scope is the requester's decision, not the implementer's.

This package is the single source of truth for the protocol: schemas, spec text,
and helpers. A change that updates the helper and not the schema — or the schema
and not the spec — leaves downstream implementations agreeing with different
copies of the protocol. All three move together or the PR says which did not.

The PR template's `## Scope and cuts` section is where the disclosure goes: what
was asked for, what is not in this PR, why, and who decides whether it lands —
or `nothing cut`.

The PR template carries the fields where that disclosure goes, and
`.github/workflows/pr-metadata-policy.yml` checks that each one is answered. It
cannot check whether an answer is honest; only a reviewer can, which is exactly
why the fields are mandatory.

Restate this when delegating to a subagent or a background job. Subagents do not
inherit this file and will otherwise default to shipping the smallest thing that
runs.

Full contract: `docs/engineering-os/scope-completeness.md`.
