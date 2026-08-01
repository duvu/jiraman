---
name: jiraman-apply-actions
description: "Propose, reject, or directly apply only named approved PMG/PMA actions with full preflight and verification."
version: 5
side_effects: approved-write
policy: .kilo/policies/jiraman-safety.md
---

# jiraman-apply-actions

## Purpose

Propose, reject, or directly apply only named approved PMG/PMA actions with full preflight and verification.

## Triggers

Exact `propose`, `apply <PMG/PMA...>`, or `reject <PMG/PMA...>` only.

## Required Evidence

Named immutable action envelopes from private state; approval identity/context/hash; capability health; current Jira/Confluence target reads; dependency draft references; hierarchy, estimate, scope, ownership, version/timestamp, and expiry evidence.

## Output Contract

For propose: review summary and machine-valid PMG/PMA payload. For reject: local rejected state and audit summary. For apply: all-or-nothing preflight, ordered exact tool calls, per-action read-after-write comparison, created IDs, final states, failures, rollback guidance, and minimal audit record.

## Semantic Capabilities

Reads: `jira.issue.read`, `confluence.page.read`; approved writes as required: `jira.issue.create`, `jira.issue.update`, `jira.comment.create`, `jira.link.create`, `jira.transition.execute`, `confluence.page.create`, `confluence.page.update`, or `confluence.comment.create`. Destructive capabilities are forbidden. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. PMG IDs use `PMG-YYYYMMDD-NN`; PMA IDs use `PMA-YYYYMMDD-NN`. Approved payloads are immutable; material change requires a new ID.
2. Classify operations low, medium, high, or forbidden. High risk requires per-action approval; eligible lower risk may use group approval. Delete is forbidden.
3. Load only named IDs and validate state, hash, identity, approval set, expiry, scope, operation/risk, and replay state.
4. Resolve one exact schema-compatible exposed MCP tool for every action. Re-read every target and compare status, parent, sprint, fields, links, page version, ownership markers, and stored preconditions. Resolve parent-before-child/create-then-link draft references deterministically.
5. Validate AIPLATFORM/space scope, hierarchy, `<= 4h` Sub-tasks, and Confluence ownership. Display non-secret before/current/desired drift. If one check fails, write nothing and require a new proposal.
6. After a clean all-or-nothing preflight, execute parent-before-child in dependency order using only approved fields/content. Stop after unexpected failure and skip dependents.
7. Re-read every changed entity and compare actual to desired. Tool success without a match becomes `verification-failed`. Record expected/actual non-secret fields and rollback guidance.
8. Append minimal approval context, timestamps, tool-result category, created IDs, before/after summaries, verification, and failure. Applied actions cannot transition back to executable or replay.

## Side Effects

`propose` is read-only. `reject` mutates only `.kilo/state/jiraman.json` and calls no MCP write. Exact `apply` may call only the exact approved MCP writes after all checks pass.

## Degraded Mode

Any unknown/expired/rejected/applied/modified/partially approved ID, identity mismatch, stale target, unresolved dependency, missing exact write tool, non-`ask` permission, or missing verification read blocks the whole group before writes.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
