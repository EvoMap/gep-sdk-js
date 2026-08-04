# Engineering Operating System Adoption

This repository has adopted selected files from EvoMap Engineering Operating System.

## Installed modules

### pr-template

- `.github/PULL_REQUEST_TEMPLATE.md` — Reviewable PR metadata template

### pr-gate

- `scripts/validate_pr_metadata.py` — Presence-only PR metadata validator; derives its contract from the PR template
- `.github/workflows/pr-metadata-policy.yml` — Base-branch-enforced workflow running the PR metadata validator

### rules

- `docs/engineering-os/pr-quality.md` — Cross-repo PR quality contract
- `docs/engineering-os/scope-completeness.md` — Deliver a complete outcome; disclose any narrowed scope
- `docs/engineering-os/quality-gate-design.md` — Tiered, evictable, measured quality gates
- `docs/engineering-os/hot-paths.md` — Hot-path ownership and change discipline
- `docs/engineering-os/identity-resolution.md` — Display identity vs dispatch identity contract
- `docs/engineering-os/operational-lessons.md` — Durable operational practice extracted from memory

## Local ownership

Replace generic examples with repository-specific paths, owners, validation commands, and rollback notes before treating the policy as complete.
