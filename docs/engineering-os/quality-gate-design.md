# Quality Gate Design Rule

Quality gates accumulate. Every incident adds a permanent guard, and guards are
rarely retired, so the aggregate cost — build friction and agent context tax —
grows without bound while the marginal defect it prevents shrinks. A thicker gate
wall is not a safer repository: a repo with thin, well-owned gates can carry the
same or lower defect-escape rate as one buried in ratchets. This rule keeps gates
light and effective by tiering them, bounding ratchets, expiring dead guards, and
spending the quality budget where it actually catches defects.

## What belongs here

Design rules for any mechanism that can block or annotate a change: CI checks,
structural guards, count ratchets, lint ceilings, adversarial review bots, and the
agent-facing instruction files that every session must load.

## Default practices

### Tier gates: block versus inform

A gate should HARD-BLOCK a change only when the invariant it enforces is all of:
unambiguous, machine-decidable with ~zero false positives, and genuinely
irreversible or catastrophic — leaked secrets, fund movement, data loss, a broken
public/cross-service contract. Everything else — style, "smells," aggregate counts,
heuristics with real false-positive rates — should WARN and route to review, not
fail the build. Reserving the red light for the few things that truly must stop the
line is what keeps the green path fast.

### Bound ratchets, or they become taxes

A "must-not-increase" count ratchet (unwrap count, escape-hatch count, lock count)
does not prevent bad code; it prevents net-new instances of a pattern. That has
three costs: it blocks unrelated changes that merely touch the number, it invites
gaming (move the code to a file the scanner misses), and it rarely drives the count
to zero on its own. Keep a hard-block ratchet only for the catastrophic few.
Convert the rest to a review-flag ("this increased — justify it") plus an owned,
scheduled burn-down with a target, so the number actually shrinks instead of just
never rising.

### Every guard needs an owner, a hit record, and an expiry

A guard with no evidence it catches real defects is pure tax. Instrument each one:
count the real regressions it caught versus the legitimate changes it blocked.
Review the set on a fixed cadence and retire — or downgrade to warn — any guard that
has not caught a real defect within the review window. Make pruning periodic and
data-driven, not a cleanup that "someone will do eventually"; unpruned, guards only
accumulate.

### Agent-facing instruction files are a gate too

A large always-on instructions file is a gate paid by every session, whether or not
its rules apply to the task at hand. Keep a small load-bearing core — the few rules
that are truly universal — and move everything else into on-demand modules loaded
only when the relevant subsystem is touched. Prefer one strong adversarial review
pass plus focused tests over a wall of preventive rules: a single good reviewer
catches more real defects per unit of friction than a dozen count ratchets, and it
does not tax the sessions that never trip it.

### Give a self-declared field a consequence someone sees

Templates often ask the author to classify their own change — does this touch a hot
path, a public contract, user data. A checker can verify the field is present and
well-formed, but not that the answer is true, so the field's accuracy rests entirely
on what answering honestly costs versus what it saves.

Two repositories measured the same way make the point. In one, the declaration only
selects an automatic ratchet: nothing changes for the author either way, and over
200 pull requests 8 declared "no" while touching a file the repository's own manifest
lists as hot — a 4% inaccuracy rate, spread across four authors, seven already
merged. In the other, answering "yes" to any high-risk field forces a human sign-off
field and a blocking metadata check on every pull request event. Over the same
sample size: zero mismatches, and the declarations that were "yes" carried written
rationale beyond what the template asked for.

The difference is not author diligence; it is that in the second repository the
answer is read by a person. The sharpest evidence is a control inside the *first*
repository: the same template also asks for three numeric deltas, and there the
quality gate prints each current-versus-baseline count on every run and fails when
one grows. Same authors, same template, same review culture — only the consequence
differs, and across the pull requests whose baseline change could be recovered from
git, all thirty of those declared numbers matched the actual delta exactly. Authors
copy a number a tool just showed them; they estimate a yes/no nobody will check.

A field whose value routes only machinery drifts, because nobody notices when it is
wrong. So when a declaration is load-bearing, attach a visible consequence to it — a
required reviewer, a sign-off, a blocking check, or simply computing the answer and
showing it — rather than adding a second automated check to police the first. Add the
declared-versus-actual audit where that consequence is missing and cannot be added;
skip it where the consequence already works, because there it is pure noise.

The corollary is worth stating: **if the honest answer is computable, compute it and
show the author, instead of asking them to declare it.** A field that a tool can fill
should not be a question.



Judge a repository's quality machinery by how many defects reach users or
production, not by how many gates it has. A new gate should justify itself against
escape rate and be removable when it does not move it. A thin-gate, low-escape
repository is the target operating point, not an anomaly to harden away.

## PR expectations

- Adding a hard-block gate: state which tier-1 condition it meets (irreversible /
  catastrophic / zero-false-positive) and why a warning is insufficient.
- Adding or raising a ratchet: name the owner, the burn-down target, and the review
  cadence; default to a review-flag rather than a hard block.
- Removing or downgrading a gate: cite its hit record (or absence of one) over the
  review window.
- Adding a check that audits a self-declared field: report the measured mismatch
  rate over a stated sample, and say why a visible consequence on the declaration
  is not the better fix.
- Adding a declared field at all: if a tool can compute the answer, compute it and
  show the author rather than asking them to assert it.
