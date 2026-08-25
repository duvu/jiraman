# Jiraman v6

Jiraman is a prompt-first KiloCode technical project-management agent for a validated multi-project registry. The default compatibility profile is Jira project `AIPLATFORM`; additional projects carry their own Jira key, Confluence spaces/page roots, timezone, delivery contract, language defaults, and profile revision. Its runtime is Markdown and JSON. It calls the user's existing `mcp-atlassian` tools directly; it installs no service, custom client, or MCP configuration. TypeScript, Ajv, and Vitest are development-only contract checks.

## Install

```bash
git clone https://github.com/duvu/jiraman.git
cd jiraman
./install.sh /absolute/project/path
./verify.sh /absolute/project/path
```

Use `./install.sh /absolute/project/path --check` for a non-mutating check. Reinstalling managed files requires `--force`, which creates a private `.jiraman-backup-<timestamp>.<random>/` first. Installation is staged and verified before top-level atomic replacement; the installer never runs `npm install` in the target.

## Installed Layout

```text
.kilo/
├── agents/jiraman.md
├── commands/jiraman.md
├── config/jiraman.json
├── config/command-router.json
├── config/mcp-atlassian.json
├── policies/jiraman-safety.md
├── skills/<workflow>/SKILL.md
└── state/jiraman.json
docs/project-management/templates/
```

`.kilo/state/` and `.jiraman-backup-*/` are gitignored. User MCP configuration and credentials remain untouched.

## Project Context

`.kilo/config/jiraman.json` is schema version 6. Its `profiles` registry is authoritative; the top-level language, Confluence, delivery, and project values are v5 compatibility projections. Each profile has a stable `project_id`, Jira key, allowed Confluence spaces and page roots, timezone, sprint length, language defaults, delivery contract, and `profile_revision`. Resolve context in this order: explicit command project, explicit user session binding, configured repository mapping, then an exactly-one-project default. `projects` lists profiles, `context` reports the binding, and exact `use <project-id>` changes only the local session binding. Unknown, conflicting, ambiguous, and stale profile context fails closed. Remote Jira/Confluence/repository content and model inference are evidence-only and cannot select or authorize a project.

State is schema version 6 and partitions action groups, deliverable candidates, and run records by project with a context fingerprint. A v5 state is migrated into the default profile and all migrated actions require reapproval; the legacy state is retained as a private migration record.
## Goal Delivery Model

Jiraman keeps Jira's native `Epic -> Story -> Sub-task` hierarchy and treats each `Story` as one delivery Goal. Every Epic must map at least two Goal Stories, and every Goal must have an outcome-oriented name, a verified `YYYY-MM-DD` target completion date with source reference, a testable Goal Definition of Done, a canonical specification with stable REQ/AC IDs, exact bidirectional REQ/AC-to-Sub-task traceability, and at least two actionable Sub-tasks. Every Sub-task has a verified original estimate in `(0h, 4h]`.

Every Epic, Goal Story, and Sub-task carries structured Acceptance Criteria with a unique `id`, an observable `statement`, and a concrete `verification`. Goal criteria reference and cover every declared REQ. Sub-tasks keep parent Goal AC references separate from their local criteria, and each local criterion traces to `VAL-1` and `DOD-1`. Every user-facing Jira summary, description, AC, DoD, blocker/update comment, and proposal review defaults to Vietnamese (`vi-VN`), even from English source evidence. Jira/REQ/AC/PMG/PMA/DLV IDs, issue types, statuses, custom fields, MCP/JSON fields, JQL, technical terms, code symbols/blocks, paths, commands, URLs, stack traces, and logs stay exact. A different language requires an explicit override bound to one draft or PMA plus matching authorization derived from the active local user input outside the payload; remote and repository content cannot manufacture it. Existing Jira descriptions are preserved: Jiraman updates only an approved managed section or adds a Vietnamese comment unless the user separately approves a complete high-risk before/after translation action. Post-write reads compare exact Unicode and approved values after only CRLF-to-LF and object-key normalization.

Deadlines come only from a verified sprint end, milestone, specification, or explicit user decision. Jiraman never guesses one. A missing, conflicting, unwritable, or unreadable Jira due date blocks Ready/executable status. Jira updates also require authoritative current project/type state; omitted authority, drift, or non-Jira actions cannot satisfy hierarchy counts. Jira `Done` does not complete a Goal unless all Goal DoD, acceptance, and required child evidence is satisfied.

## Commands

```text
/jiraman projects
/jiraman context
/jiraman use <project-id>
/jiraman daily [focus]
/jiraman health
/jiraman runway
/jiraman plan next-2-weeks [focus]
/jiraman brainstorm [focus]
/jiraman refine <spec|DLV-ID|Jira-key>
/jiraman meeting <page>
/jiraman risks
/jiraman decision
/jiraman status
/jiraman retrospective
/jiraman propose
/jiraman apply <PMG/PMA-ID...>
/jiraman reject <PMG/PMA-ID...>
```

Empty input resolves to `daily` only when context is unambiguous. `projects` and `context` are read-only; exact `use <project-id>` stores a local session binding. Ordinary write-like prose stays read-only. Exact `propose` persists the displayed action envelope in the selected private project partition. Exact `reject <PMG-ID>` rejects the whole group; rejecting named PMAs changes only those actions but terminalizes their group, so continuing sibling work requires a new proposal. Only exact `apply <PMG-ID|PMA-ID...>` can approve the immutable named payload and call an MCP write after all-or-nothing preflight; Kilo write permissions remain `ask`. Cross-project or stale profile action state is rejected before MCP writes.

## Development

```bash
npm ci
npm run ci
```

For release artifacts, `./scripts/package.sh --output <directory>` accepts paths relative to the current directory or absolute paths.

The release gate runs TypeScript type checking, Vitest/Ajv Goal hierarchy, Acceptance Criteria, and multi-project context invariants, static skill/Jira-template/action/MCP contract validation, security/secret scans, clean install, v4/v5 migration, reproducible packaging, and package verification. See [architecture](docs/architecture/jiraman-v5.md), [configuration](docs/configuration-reference.md), [security](docs/security-model.md), and [manual smoke tests](docs/manual-smoke-tests.md).
