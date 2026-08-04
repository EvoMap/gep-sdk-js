# Scope Completeness Rule

A delivery is complete when it produces a real outcome someone can use, not when
one link of the chain compiles. This rule exists because the default failure mode
of an agent-assisted repository is not a bug — it is a plausible-looking partial:
the endpoint without the migration, the UI without the empty state, the pipeline
without the rollback. Each is individually defensible and collectively unusable.

The scope an author was given is the deliverable. Narrowing it is a decision the
requester makes, not one the implementer makes quietly on the way to a PR.

## What belongs here

Rules for deciding **how much** of a requested change ships in one PR, and what
"done" means for the part that does. This rule governs scope; `pr-quality.md`
governs the evidence a PR shows; `quality-gate-design.md` governs what may block.

Not in scope here: how large a diff may be. A complete outcome can be small, and
a 3000-line refactor can still be a partial. Reviewability and completeness are
independent axes — see "Complete is not the same as large" below.

## Default practices

### Do not narrow scope silently

If the requested change cannot ship whole, the PR must say which part is missing
and why. Silent narrowing takes three common forms, all of which are the same
defect:

- **Renaming the shortfall.** Labeling a partial as `v0`, `MVP`, `phase 1`, or
  "core first" describes the reduced thing accurately while leaving the reader to
  assume the full thing was scoped. The label is not the disclosure.
- **Mid-implementation downgrade.** Starting on the full outcome and landing a
  mock, a stub, a hardcoded fixture, or a `TODO` where the hard part was. The
  commit message usually still describes the full intent.
- **Deferring the unglamorous half.** Shipping the happy path and filing the
  error states, migration, or rollback as follow-up work that nothing schedules.

The rule is not "never ship incrementally." Increments are how large work lands.
The rule is that the increment boundary is **stated and chosen**, not discovered
by a reviewer reading the diff.

### Draw the boundary at an outcome, not a layer

A useful increment crosses the stack for a narrow case. An unusable one covers
one layer for every case. Prefer the first: it can be validated end to end,
demoed, reverted as a unit, and it tells you whether the design works.

| Layer-shaped (avoid as a standalone deliverable) | Outcome-shaped (prefer) |
|---|---|
| "Add the report-generation function" | One report type: collect → detect → deliver |
| "Add the API endpoint" | One caller path: request → persist → read back → error surface |
| "Add the assistant surface" | One task the assistant actually completes, measured |

The test is a sentence with a subject: *who* can now do *what* that they could
not do before? If the answer needs "once the other PR lands," the boundary is at
a layer.

### Completeness includes the parts nobody demos

An outcome is not complete until the non-functional half exists. Each item below
is load-bearing; a delivery missing one is partial regardless of how well the
happy path works:

- **Real data.** No mocked responses or fabricated entities standing in for a
  live dependency in shipped code. Fixtures belong in tests, not in the path a
  user hits.
- **Empty and error states.** What the user sees with zero rows, a failed
  dependency, a timeout, or a permission denial — naming the failed dependency
  and the next action, not just that something went wrong.
- **Boundaries and failure paths.** The first request, the concurrent request,
  the retry, the partial write.
- **Deploy and rollback.** How the change reaches the runtime that serves it and
  how it is withdrawn. See `operational-lessons.md` for verifying the real
  control plane before assuming the repository is it.
- **End-to-end validation against the real artifact.** The built binary, the
  deployed service, the actual runtime — not only the unit tests for the changed
  module. A green test suite for a path no user traverses is not evidence.

### Complete is not the same as large, or late

Completeness is about closing a loop, not about withholding work. Two distinct
things get conflated:

- **Ship date** — when the change becomes broadly available.
- **Contact with reality** — when the first real user or real workload exercises
  it.

Delaying the first is sometimes right. Delaying the second is almost never right,
and it is what actually causes months of work to miss. A deliberately narrow but
complete loop, in front of one real user early, beats both a broad partial and a
complete thing nobody has touched. Keep the loop closed and let the audience be
small.

### Say when scope was cut

When a PR does not deliver the whole requested outcome, the body must carry:

- the part that shipped, as an outcome;
- the part that did not, specifically enough to hand to someone else;
- why it was cut — blocked, unauthorized boundary, or reviewability;
- who is expected to decide whether it lands.

This is the disclosure that makes an increment legitimate. A PR body that omits
it is asserting a complete delivery, and reviewers will read it that way.

### Why this is a declaration and not a computed field

`quality-gate-design.md` asks two things of any new field: if a tool can compute
the answer, compute it; and if the answer is load-bearing, give it a consequence
someone sees. Both apply here, with different answers.

Completeness is **not** computable. Nothing in the repository knows what was
requested, so no checker can compare delivered against asked. The gap between
those two is exactly the information only the author holds, which is why this is
a declaration rather than a derived value.

Its consequence is a reader, not a checker. The audit verifies the section is
*present* — a body that never mentions scope is the undisclosed-partial case by
construction — and warns at low severity, routing to review rather than blocking.
Whether the disclosure is *honest* is judged by the reviewer who reads it. That
is the visible consequence the gate rule asks for. Do not add a second automated
check to police this field's accuracy: per that rule, there is nothing for it to
compare against, and it would be pure noise.

## Delegated work

Rules loaded from an instruction file apply to whoever loaded it. Delegated work
— subagents, workflow stages, spawned sessions, background jobs — starts with a
fresh context and does not inherit the caller's reading of this file. A delegating
prompt must therefore restate the scope contract inline:

- the outcome to close, not the layer to implement;
- that narrowing requires reporting, not a `v0` label;
- which non-functional items above are in scope for that unit;
- what validation counts as done.

Delegation that omits this reliably returns the narrowest defensible slice, and
the caller inherits an unusable partial they then have to finish or discard.
`operational-lessons.md` states the general form of this constraint for
automations; this is the scope-specific instance.

## PR expectations

- **Scope declaration:** the outcome delivered, stated as who can now do what.
- **Cut disclosure:** any part of the request not in this PR, why, and who
  decides. Say "nothing cut" explicitly when nothing was.
- **Non-functional coverage:** which of real data / empty and error states /
  boundaries / deploy and rollback / end-to-end validation apply, and their
  status. Not-applicable is a fine answer with a reason.
- **Reality contact:** who or what has exercised this, or when they will.
- **Increment position:** if part of a series, what closes the loop and when.

A reviewer should be able to tell from the body alone whether this PR delivers a
usable outcome or an announced step toward one. Both are acceptable. Being unable
to tell which is not.
