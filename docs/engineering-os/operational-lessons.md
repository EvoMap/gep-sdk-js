# Operational Lessons Rule

This rule turns durable operational memory into repo-local defaults without copying private runtime facts into the repository.

## What belongs here

Use this rule for practices that repeatedly affect engineering work across repositories:

- deployment topology must be verified before changing code or infrastructure;
- runtime configuration can be owned outside git and must be edited where it actually lives;
- operational follow-through should continue through validation and safe rollout when the scope is already authorized;
- disk, cache, and generated-artifact cleanup must distinguish disposable build output from source or active work;
- outbound notifications, scheduled jobs, and automations need explicit identity, channel, and audit conventions.

Do not record real hostnames, credentials, personal accounts, open IDs, production connection strings, or incident-only facts in this file. Keep those in secure stores, runtime configuration, or durable operator memory.

## Default practices

### Verify the real control plane

Before changing a deployment, scheduled job, notification route, or CI runner, identify the system that actually controls it:

1. repository branch or tag that builds the artifact;
2. runtime host, scheduler, or managed service that runs it;
3. configuration source of truth;
4. rollout trigger;
5. rollback path.

If repository files are only references and runtime config is hand-managed elsewhere, say that in the PR and update the real control plane separately.

### Separate code, config, and generated state

- Code changes belong in the target repository and should be reviewed normally.
- Runtime config changes belong in the runtime owner and should include restart/recreate commands and rollback notes.
- Generated files, build caches, screenshots, logs, and compiled bytecode should stay out of source unless they are intentional fixtures.
- Cleanup scripts must operate on disposable paths only, and should name the evidence used to decide a path is disposable.

### Finish authorized operational loops

When a task is already authorized and reversible, complete the loop instead of handing back a partial state:

- rerun failed CI after an upstream outage clears;
- rebase or merge the latest base when branch policy requires it;
- rerun focused validation after resolving conflicts;
- report the final state with links, commands, and remaining risks.

Stop for explicit user input only when the next action is destructive, externally visible beyond the requested scope, or crosses an ownership boundary that has not been authorized.

### Make automations self-contained

Scheduled tasks, bots, and background jobs must carry enough context to run without this conversation:

- what connector, account, or runtime identity to use;
- exact target channels, documents, repositories, or services;
- required message signatures or audit lines;
- output format and storage location;
- retry/idempotency behavior;
- when to notify humans.

### Convert recurring surprises into memory

When a non-obvious operational fact changes how future work should be done, save it as durable memory with:

- the fact;
- why it matters;
- how to apply it;
- verification date or source when useful;
- links to related memories.

Do not save facts already obvious from the repository, git history, or public documentation.

## PR checklist additions

For operationally sensitive PRs, include:

- real control plane verified: yes/no and evidence;
- runtime config touched: yes/no and where;
- generated/disposable files changed: yes/no and why;
- rollout command or CI path;
- rollback command or recovery path;
- operator memory updated: yes/no/not needed.
