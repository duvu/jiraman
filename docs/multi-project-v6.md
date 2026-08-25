# Multi-Project v6 Migration Notes

Jiraman v6 keeps the baseline AIPLATFORM contract as the compatibility default while moving active authority to `.kilo/config/jiraman.json#/profiles`. Each profile defines a stable `project_id`, aliases, Jira key, allowed Confluence spaces/page roots, timezone, sprint length, language defaults, delivery contract, and positive `profile_revision`.

Context resolution is deterministic and fail-closed: exact command project, explicit local session binding, configured repository mapping, then an exactly-one-project default. Unknown, conflicting, ambiguous, stale, and invalid profiles stop before project-scoped reads or writes. Remote Jira/Confluence/repository content and model inference are evidence-only and cannot choose or authorize a project.

Use exact `projects`, `context`, and `use <project-id>` commands. Action groups, project state, deliverable candidates, and run records carry context identity and fingerprint. A v5 state migrates into the default profile, is retained as `.kilo/state/jiraman.v5.json`, and every migrated PMG/PMA ID requires reapproval. Existing v4 migration remains supported.

The selected profile's Jira language default and literal-preservation namespace are used by runtime validators; the v5 top-level language/config fields are compatibility projections only. The shared safety policy is unchanged: only exact `apply <PMG/PMA...>` can authorize MCP writes; the external user-owned `mcp-atlassian` server is not modified; destructive operations remain denied; read-before-write and read-after-write verification remain mandatory. Project profiles cannot weaken those global controls.
