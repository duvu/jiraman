---
name: jiraman-apply-actions
description: "Apply only named approved PMG/PMA actions after Goal hierarchy, due-date, child, estimate, and read-back preflight."
version: 5
side_effects: approved-write
policy: .kilo/policies/jiraman-safety.md
jira_ticket_contract: docs/project-management/templates/jira/index.json
goal_contract: goal-name,target-completion-date,structured-ac,goal-dod,epic-parent,min-two-subtasks,max-four-hours,traceability
---

# jiraman-apply-actions

## Purpose

Propose, reject, or directly apply only named approved PMG/PMA actions with full preflight and verification.

## Triggers

Exact `propose`, `apply <PMG/PMA...>`, or `reject <PMG/PMA...>` only.

## Required Evidence

For propose: the currently displayed concrete recommendation, complete structured Epic/Goal/Sub-task Acceptance Criteria, Goal name/date/DoD/specification/traceability evidence, fresh target facts, and dependency draft references. For apply/reject: named immutable action envelopes from private state. Apply additionally requires approval identity/context/hash, the managed Jira description-section mapping, operation-specific due-date read/write schema resolution, current Jira/Confluence target reads, Goal hierarchy/child counts, estimates, scope, ownership, version/timestamp, and expiry evidence.

## Output Contract

For propose: review summary, machine-valid PMG/PMA payload preserving every AC ID/statement/verification, Goal field, parent AC reference, local AC trace, and child action, plus canonical hash and IDs persisted with `proposed` status. For reject: local rejected state and audit summary. For apply: named approval context, all-or-nothing Goal/AC preflight, ordered exact tool calls, per-action read-after-write comparison including the full AC managed section, due date/DoD/parent/estimate, created IDs, final states, failures, rollback guidance, and minimal audit record.

## Semantic Capabilities

Reads: `jira.issue.read`, `confluence.page.read`; approved writes as required: `jira.issue.create`, `jira.issue.update`, `jira.comment.create`, `jira.link.create`, `jira.transition.execute`, `confluence.page.create`, `confluence.page.update`, or `confluence.comment.create`. Story create/update requires one unambiguous writable Jira due-date field and issue read requires the corresponding read-back field. Destructive capabilities are forbidden. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. PMG IDs use `PMG-YYYYMMDD-NN`; PMA IDs use `PMA-YYYYMMDD-NN`. Compute `payload_hash` as SHA-256 over UTF-8 canonical JSON of actions sorted by PMA ID, excluding only each action's top-level `status`, recursively sorting object keys, and preserving nested array order. Approved payloads are immutable; material change requires a new ID.
2. For exact `propose`, use only the currently displayed concrete recommendation. Re-read required targets, classify operations low, medium, high, or forbidden, reject delete, allocate collision-free PMG/PMA IDs, construct every required action field, compute the canonical hash, and validate the complete envelope. Persist it under `pending_action_groups[PMG-ID]` with group/actions `proposed` and an empty approval tuple. Preserve private-state mode. If evidence or desired state is not concrete, write no state.
3. For exact `reject <IDs>`, load only named IDs and validate current hash/status. A PMG reject transitions the group and every action to `rejected`. A PMA reject transitions only each named action, sets its containing group to terminal `rejected`, and preserves unnamed sibling action statuses as audit history. The terminal group cannot be approved or applied; propose a new group for any sibling work that should continue. Append a minimal local audit result and call no MCP tool.
4. For exact `apply <IDs>`, load only named IDs. Treat the explicit command as approval only for the displayed immutable hash: capture the current non-empty user identity/context, approval time, hash, and exact approved IDs, then persist `approved`. A PMG selection may approve only an eligible lower-risk whole group. If any action is high risk, the command must enumerate every PMA in that all-or-nothing group; a single PMA is valid only for a one-action group. Partial group approval is invalid. Kilo `ask` permission remains mandatory before any MCP write.
5. Immediately validate state, recomputed hash, identity, complete approval set, expiry, scope, operation/risk, and replay status. Resolve one exact schema-compatible exposed MCP tool for every write and the exact Jira read capability for each evidence-only `issue.reuse` reference. For Jira updates and reuse references, require fresh authoritative `before_state` project/type/parentage. Reject desired type/project drift, any reuse mutation, and Story/Sub-task parent references that resolve to the wrong issue type. A parent not resolved within the group requires freshly read `parent_issue_type` and `parent_project` authority. Validate an update's effective state from before plus approved changes and a reuse reference from unmodified before state. Epic, Story, and Sub-task effective state each requires at least one unique structured AC with a concrete statement and verification. Story ACs cover every declared REQ; every new Goal AC is referenced by a child; every Sub-task has separate parent AC refs plus local ACs traced to its validation and DoD. Story effective state also requires AIPLATFORM, issue type `Story`, Epic parent, summary exactly equal to approved `goal_name`, verified `target_completion_date`, mapped due date, explicit Goal DoD, canonical specification, and validation. Sub-task effective state also requires its Goal parent, actionable outcome, validation, Sub-task DoD, requirements, and original estimate in `(0h, 4h]`.
6. Resolve due-date create/update/read fields from exposed schemas before considering a Goal executable. Missing or ambiguous write/read mapping blocks the whole group with the exact semantic operation and field remediation; narrative-only deadline storage never counts as operational readiness.
7. For existing targets and `issue.reuse` references, re-read and compare type, project, parent, summary, due date, structured AC content, DoD content, estimate, status, sprint, links, page version, ownership markers, and stored preconditions. A reuse reference has desired state exactly `{reuse: true}`, performs no Jira write, and counts only when its freshly read full state satisfies the same Goal/Sub-task contract and effective parentage as a create/update. An existing ticket missing AC can receive only a proposed `acceptance-criteria` managed-section update or a managed Vietnamese comment; never replace its human-owned description. For creates, read the existing project/parent/page-root container, prove duplicate absence, validate unique draft references, and count only schema-valid AIPLATFORM Jira create/update actions or immutable reuse references with valid effective parentage toward the required two Goals per new Epic and two Sub-tasks per new Goal; never read a nonexistent target. Preflight every action and dependency before any write. Bind created IDs only to their preapproved draft references in deterministic parent-before-child order.
8. Validate AIPLATFORM/space scope, exact Goal hierarchy, child counts, deadline evidence, `0h < Sub-task estimate <= 4h`, immutable fields, and Confluence ownership. Display non-secret before/current/desired drift. If one check fails, write nothing and require a new proposal.
9. After a clean all-or-nothing preflight, execute parent-before-child in dependency order using only approved fields/content. Stop after unexpected failure and skip dependents.
10. Re-read every changed entity and compare actual to desired, including every AC ID, statement, and verification after only documented line-ending/rich-text normalization, plus Story summary/type/parent/due date/DoD and Sub-task parent/original estimate. A lost, renamed, reordered-content, or incomplete AC and any other missing or mismatched Goal field becomes `verification-failed`. Record expected/actual non-secret fields and rollback guidance.
11. Append minimal approval context, timestamps, tool-result category, created IDs, before/after summaries, verification, and failure. Applied actions cannot transition back to executable or replay.

## Side Effects

Exact `propose` and `reject <IDs>` mutate only `.kilo/state/jiraman.json` and call no MCP write. Exact `apply <IDs>` records named approval locally, then may call only the exact approved MCP writes after all checks pass.

## Degraded Mode

Missing, vague, duplicated, uncovered, untraced, or mismatched Acceptance Criteria; missing concrete Goal evidence; an unknown/expired/rejected/applied/modified/partially approved ID; empty identity; stale target; unresolved dependency; insufficient child count; invalid estimate; unsafe human-content overwrite; missing or ambiguous due-date/AC mapping; missing exact write tool; non-`ask` permission; or missing verification read blocks the whole group before writes and names remediation.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
