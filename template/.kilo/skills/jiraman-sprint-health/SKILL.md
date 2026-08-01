---
name: jiraman-sprint-health
description: "Diagnose sprint health, flow bottlenecks, and Ready runway from direct MCP evidence."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
---

# jiraman-sprint-health

## Purpose

Diagnose sprint health, flow bottlenecks, and Ready runway from direct MCP evidence.

## Triggers

Exact `health` or `runway`, including normalized v4 `sprint-health`.

## Required Evidence

Capability health; active sprint/goal; bounded AIPLATFORM issues with status, hierarchy, estimates, blockers, assignees, dependencies, changed dates, and acceptance evidence; verified capacity basis; relevant specifications, decisions, and risks.

## Output Contract

For health: Green, Amber, Red, or Not verified with triggering rules, goal/outcome view, WIP/aging/queue/blocker/dependency findings, and smallest corrective actions. For runway: N+1, N+2, reserve, total coverage, hard-floor gap, operating-target gap, unready potential, exact readiness recovery, and outcome-coherence risk.

## Semantic Capabilities

`jira.project.read`, `jira.board.read`, `jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, and optional `confluence.page.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Detect WIP breaches, stale work, review/validation congestion, blockers, unassigned active Sub-tasks, and explicit dependency risks from returned fields.
2. A blocked Sprint Goal may be Red even when most issues are Done; issue counts are not value.
3. Count a Story once. Never add a Story estimate and child Sub-task estimates. Never count an Epic.
4. Only Stories satisfying N+1/N+2 readiness and resolved dependencies count as Ready. Excess N+1 cannot compensate for empty N+2.
5. Unready estimates are potential only. Green volume can still have incoherent outcomes.
6. Recommend finish/unblock/refine before start and never call a write tool.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

No active sprint produces a labeled no-active-sprint view. Missing change history, capacity, dates, or estimates yields `not verified`, never invented percentiles, trends, or issue-count capacity.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
