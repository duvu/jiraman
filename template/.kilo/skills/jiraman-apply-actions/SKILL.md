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

For propose: the currently displayed concrete recommendation, its source evidence, fresh target facts, and dependency draft references. For apply/reject: named immutable action envelopes from private state. Apply additionally requires approval identity/context/hash, capability health, current Jira/Confluence target reads, hierarchy, estimate, scope, ownership, version/timestamp, and expiry evidence.

## Output Contract

For propose: review summary, machine-valid PMG/PMA payload, canonical hash, and the IDs persisted with `proposed` status. For reject: local rejected state and audit summary. For apply: named approval context, all-or-nothing preflight, ordered exact tool calls, per-action read-after-write comparison, created IDs, final states, failures, rollback guidance, and minimal audit record.

## Semantic Capabilities

Reads: `jira.issue.read`, `confluence.page.read`; approved writes as required: `jira.issue.create`, `jira.issue.update`, `jira.comment.create`, `jira.link.create`, `jira.transition.execute`, `confluence.page.create`, `confluence.page.update`, or `confluence.comment.create`. Destructive capabilities are forbidden. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. PMG IDs use `PMG-YYYYMMDD-NN`; PMA IDs use `PMA-YYYYMMDD-NN`. Compute `payload_hash` as SHA-256 over UTF-8 canonical JSON of actions sorted by PMA ID, excluding only each action's top-level `status`, recursively sorting object keys, and preserving nested array order. Approved payloads are immutable; material change requires a new ID.
2. For exact `propose`, use only the currently displayed concrete recommendation. Re-read required targets, classify operations low, medium, high, or forbidden, reject delete, allocate collision-free PMG/PMA IDs, construct every required action field, compute the canonical hash, and validate the complete envelope. Persist it under `pending_action_groups[PMG-ID]` with group/actions `proposed` and an empty approval tuple. Preserve private-state mode. If evidence or desired state is not concrete, write no state.
3. For exact `reject <IDs>`, load only named IDs, validate current hash/status, transition them to `rejected`, append a minimal local audit result, and call no MCP tool.
4. For exact `apply <IDs>`, load only named IDs. Treat the explicit command as approval only for the displayed immutable hash: capture the current non-empty user identity/context, approval time, hash, and exact approved IDs, then persist `approved`. A PMG selection may approve only an eligible lower-risk whole group; every high-risk action must be named by PMA ID. Kilo `ask` permission remains mandatory before any MCP write.
5. Immediately validate state, recomputed hash, identity, complete approval set, expiry, scope, operation/risk, and replay status. Resolve one exact schema-compatible exposed MCP tool for every action. Re-read every target and compare status, parent, sprint, fields, links, page version, ownership markers, and stored preconditions. Resolve parent-before-child/create-then-link draft references deterministically.
6. Validate AIPLATFORM/space scope, hierarchy, `<= 4h` Sub-tasks, and Confluence ownership. Display non-secret before/current/desired drift. If one check fails, write nothing and require a new proposal.
7. After a clean all-or-nothing preflight, execute parent-before-child in dependency order using only approved fields/content. Stop after unexpected failure and skip dependents.
8. Re-read every changed entity and compare actual to desired. Tool success without a match becomes `verification-failed`. Record expected/actual non-secret fields and rollback guidance.
9. Append minimal approval context, timestamps, tool-result category, created IDs, before/after summaries, verification, and failure. Applied actions cannot transition back to executable or replay.

## Side Effects

Exact `propose` and `reject <IDs>` mutate only `.kilo/state/jiraman.json` and call no MCP write. Exact `apply <IDs>` records named approval locally, then may call only the exact approved MCP writes after all checks pass.

## Degraded Mode

Missing concrete proposal evidence, an unknown/expired/rejected/applied/modified/partially approved ID, empty identity, stale target, unresolved dependency, missing exact write tool, non-`ask` permission, or missing verification read blocks the whole group before writes.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
