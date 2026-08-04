# Hot Path Rule

Repositories should maintain their own hot-path list. Common hot paths include:

- auth, permission, billing, payment;
- dispatch/send/notification code;
- CI/release/signing;
- persistence schemas and migrations;
- security-sensitive model/tool execution.

Hot-path PRs need stronger review, validation, and rollback notes.
