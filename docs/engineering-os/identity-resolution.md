# Identity Resolution Rule

Stable person display names are runtime/user data, not repository fixtures.

Allowed sources:

- user-confirmed runtime settings;
- organization directory exact match;
- local memory for operator preferences;
- contact directory as fallback display hint.

Forbidden:

- using display names as message dispatch IDs;
- committing real open IDs or personal emails into test fixtures;
- merging identities without explicit evidence.
