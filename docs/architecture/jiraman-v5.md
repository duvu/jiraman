# Jiraman v5 Architecture

Jiraman v5 is a KiloCode-native Markdown agent and skill package. It is not an application or service. All Jira and Confluence interaction uses the user's existing `mcp-atlassian` tools directly. TypeScript, Node, Ajv, and Vitest are development-time validation, test, and packaging tools only. No Python runtime, custom collector, metrics engine, database, executor, background service, or second Atlassian client is planned or installed.

## Dependency Map

```text
KiloCode
  -> .kilo/commands/jiraman.md       intent parsing contract
  -> .kilo/agents/jiraman.md         bounded orchestration
  -> .kilo/skills/*/SKILL.md         workflow instructions
  -> .kilo/policies/jiraman-safety.md canonical scope/trust/write policy
  -> existing mcp-atlassian          Jira and Confluence reads/writes
  -> Jira / Confluence               authoritative remote systems

Development only:
  schemas + examples + fixtures -> TypeScript/Ajv/Vitest -> install/package checks
```

Dependencies point inward to the shared policy and configuration. Skills may call exposed `mcp-atlassian` tools directly after capability preflight; they never import another runtime layer. The primary agent routes to a named package skill and never embeds a complete workflow. Command parsing semantics are authoritative in Markdown; JSON fixtures and TypeScript only check examples and references.

## Ownership

| Concern | Single authority |
| --- | --- |
| Global scope, trust, evidence, writes | `.kilo/policies/jiraman-safety.md` |
| Project/WIP/page-root settings | `.kilo/config/jiraman.json` |
| Canonical modes and aliases | `.kilo/config/command-router.json` |
| Semantic MCP contract/profiles | `.kilo/config/mcp-atlassian.json` |
| Workflow behavior | matching `.kilo/skills/*/SKILL.md` |
| Pending actions and minimal run metadata | gitignored `.kilo/state/jiraman.json` |
| JSON validation | root `schemas/` during development/release |

## Goal Contract Boundary

Goal is a semantic role of Jira `Story`; no custom issue type or fourth hierarchy level exists. The shared safety policy owns the invariant of at least two Goal Stories per Epic, at least two Sub-tasks per Goal, verified Goal name/date/DoD/specification, exact traceability, and `(0h, 4h]` Sub-task estimates. Schemas own structural rejection, TypeScript owns cross-document relation, authoritative action-state, readiness, and installed-metadata invariants, skills own evidence acquisition and classification, and Confluence templates expose the same fields to readers. Skill and page indexes explicitly mark Goal-aware documents; the page index also declares required Goal section-region tokens. Release validation derives frontmatter from one canonical contract and rejects missing, duplicate, undeclared, or empty indexed Goal regions without pinning prose.

Jira remains authoritative for issue type, project, hierarchy, due date, original estimate, and execution state. Updates merge fresh authoritative `before_state` with approved changes and reject type/project drift. Evidence-only `issue.reuse` references preserve fresh state, reject desired mutations, and perform no write. Only valid in-scope Jira creates/updates or immutable reuse references with correctly typed effective parentage count toward Goal cardinality. Confluence owns narrative specifications and evidence. Executable Goal writes require operation-specific due-date schema support and read-after-write verification; missing support blocks apply without introducing another Atlassian client.

MCP configuration, credentials, and tool registration are external user-owned state. Jiraman must never create or modify them.

## Installed Layout

```text
.kilo/
├── agents/jiraman.md
├── commands/jiraman.md
├── config/{jiraman.json,command-router.json,mcp-atlassian.json}
├── policies/jiraman-safety.md
├── skills/<skill-name>/SKILL.md
└── state/jiraman.json              # gitignored operational state
docs/project-management/templates/ # governed artifact templates
```

## Runtime and Tooling Boundary

At runtime, the agent reads Markdown/JSON, inspects the tools exposed in the current Kilo session, and calls only an unambiguous schema-compatible `mcp-atlassian` tool. The repository's TypeScript code cannot call Jira or Confluence and is not copied into the Kilo runtime layout. Missing or ambiguous tools yield a blocked or documented degraded result.

## v4 Migration Map

| v4 path | Decision |
| --- | --- |
| `.kilo/agent/jiraman.md` | migrate to `.kilo/agents/jiraman.md`; do not retain |
| `.kilo/commands/jiraman.md` | replace with canonical v5 Markdown router |
| `.kilo/config/jiraman.yaml` | migrate settings into `jiraman.json`; back up original |
| `.kilo/config/jiraman-deliverables.md` | split into planning skill and shared policy; remove |
| `.kilo/state/jiraman.json` | preserve byte-for-byte backup; retain pending IDs for reproposal |
| project-management templates/logs | retain user content; install missing v5 templates only |

The installer backs up every replaced v4 managed file. Pending v4 action payloads are never silently treated as approved v5 actions; their original state remains recoverable and their IDs are marked `reapproval_required` in v5 state.
