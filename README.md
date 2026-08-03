# Jiraman v5

Jiraman is a prompt-first KiloCode technical project-management agent for the fixed Jira project `AIPLATFORM`. Its runtime is Markdown and JSON. It calls the user's existing `mcp-atlassian` tools directly; it installs no service, custom client, or MCP configuration. TypeScript, Ajv, and Vitest are development-only contract checks.

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

## Goal Delivery Model

Jiraman keeps Jira's native `Epic -> Story -> Sub-task` hierarchy and treats each `Story` as one delivery Goal. Every Epic must map at least two Goal Stories, and every Goal must have an outcome-oriented name, a verified `YYYY-MM-DD` target completion date with source reference, a testable Goal Definition of Done, a canonical specification with stable REQ/AC IDs, exact bidirectional REQ/AC-to-Sub-task traceability, and at least two actionable Sub-tasks. Every Sub-task has a verified original estimate in `(0h, 4h]`.

Deadlines come only from a verified sprint end, milestone, specification, or explicit user decision. Jiraman never guesses one. A missing, conflicting, unwritable, or unreadable Jira due date blocks Ready/executable status. Jira updates also require authoritative current project/type state; omitted authority, drift, or non-Jira actions cannot satisfy hierarchy counts. Jira `Done` does not complete a Goal unless all Goal DoD, acceptance, and required child evidence is satisfied.

## Commands

```text
/jiraman daily
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

Empty input resolves to `daily`. V4 aliases remain documented in [the command reference](docs/command-reference.md). Ordinary write-like prose stays read-only. Exact `propose` persists the displayed action envelope locally. Exact `reject <PMG-ID>` rejects the whole group; rejecting named PMAs changes only those actions but terminalizes their group, so continuing sibling work requires a new proposal. Only exact `apply <PMG-ID|PMA-ID...>` can approve the immutable named payload and call an MCP write after all-or-nothing preflight; Kilo write permissions remain `ask`.

## Development

```bash
npm ci
npm run ci
```

For release artifacts, `./scripts/package.sh --output <directory>` accepts paths relative to the current directory or absolute paths.

The release gate runs TypeScript type checking, Vitest/Ajv Goal hierarchy invariants, static skill/template/action/MCP contract validation, security/secret scans, clean install, v4 migration, reproducible packaging, and package verification. See [architecture](docs/architecture/jiraman-v5.md), [configuration](docs/configuration-reference.md), [security](docs/security-model.md), and [manual smoke tests](docs/manual-smoke-tests.md).
