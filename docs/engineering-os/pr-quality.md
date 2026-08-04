# PR Quality Rule

Every non-trivial PR should expose enough evidence for review:

- what changed and why;
- whether the full requested scope shipped, and what was cut if not (`scope-completeness.md`);
- whether hot paths are touched;
- tests or quality gate output;
- risks and rollback path;
- alternatives considered for architectural changes.

Large PRs should be split unless the change is mechanical and machine-verifiable.
Splitting decides how much lands per PR; it never converts an undisclosed partial
into a complete delivery. Each split must still close an outcome and name the
remainder.
