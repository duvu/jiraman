---
name: jiraman-sprint-health
description: "Diagnose Goal deadline/DoD health, flow bottlenecks, and independent N+1/N+2 Ready runway."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
jira_ticket_contract: docs/project-management/templates/jira/index.json
goal_contract: goal-name,target-completion-date,structured-ac,goal-dod,epic-parent,min-two-subtasks,max-four-hours,traceability
---

# jiraman-sprint-health

## Purpose

Diagnose sprint health, flow bottlenecks, and Ready runway from direct MCP evidence.

## Triggers

Exact `health` or `runway`, including normalized v4 `sprint-health`.

## Required Evidence

Capability health; active sprint/Goal; bounded AIPLATFORM Goal Stories with name, target date/source, Goal DoD/evidence, Epic parent, child count, traceability, status, blockers and dependencies; Sub-task estimates/assignees/validation; verified N+1/N+2 sprint dates and capacity basis; relevant specifications, decisions, and risks.

## Output Contract

For health: Green, Amber, Red, or Not verified plus per-Goal `on track`, `at risk`, `overdue`, `DoD incomplete`, `completed with evidence`, or `not verified`; structured AC completeness, cardinality, WIP/aging/queue/blocker/dependency findings; and smallest corrective actions. For runway: independent N+1/N+2 Goal coverage, reserve, gaps, unready potential, exact readiness recovery, deadlines/AC/DoD/child coverage, outcome-coherence risk, and canonical Vietnamese Jira proposals when needed.

## Semantic Capabilities

`jira.project.read`, `jira.board.read`, `jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, and optional `confluence.page.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Detect WIP breaches, stale work, review/validation congestion, blockers, unassigned active Sub-tasks, and explicit dependency risks from returned fields.
2. Classify each Goal from verified deadline and DoD evidence as `on track`, `at risk`, `overdue`, `DoD incomplete`, `completed with evidence`, or `not verified`. Jira Done alone never proves completion.
3. Flag every ticket missing structured ACs, every Epic with fewer than two Goals, and every Goal with uncovered REQs, unresolved parent AC refs, fewer than two valid Sub-tasks, missing Goal fields, incomplete traceability, or an estimate outside `(0h, 4h]`.
4. A blocked Sprint Goal may be Red even when most issues are Done; issue counts are not value. Count a Goal Story once, never add its estimate to child estimates, and never count an Epic.
5. Only Goal Stories satisfying the full shared contract, sprint deadline fit, and resolved dependencies count as Ready. Evaluate N+1 and N+2 separately; excess N+1 cannot compensate for empty N+2.
6. Unready estimates are potential only. Green volume can still have incoherent outcomes or deadline/DoD risk.
7. Recommend finish/unblock/refine before start. Render any Jira corrective-action proposal through `docs/project-management/templates/jira/index.json`; missing ACs permit only a managed-section/comment proposal. Never call a write tool.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

No active sprint produces a labeled no-active-sprint view. Missing change history, capacity, Goal deadline/DoD/decomposition, sprint dates, or estimates yields `not verified`, never invented completion, percentiles, trends, or issue-count capacity.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
