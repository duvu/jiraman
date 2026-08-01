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
