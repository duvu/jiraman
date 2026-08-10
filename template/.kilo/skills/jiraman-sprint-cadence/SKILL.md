---
name: jiraman-sprint-cadence
description: "Plan and review Goal Stories using deadline, DoD, acceptance, and child evidence without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
jira_ticket_contract: docs/project-management/templates/jira/index.json
jira_language_contract: docs/project-management/templates/jira/index.json#/proposal_workflows/jiraman-sprint-cadence
goal_contract: goal-name,target-completion-date,structured-ac,goal-dod,epic-parent,min-two-subtasks,max-four-hours,traceability
---

# jiraman-sprint-cadence

## Purpose

Prepare evidence-bound sprint planning, review, and retrospective proposals without writes.

## Triggers

Exact `retrospective`, normalized `sprint-plan`, or an internal sprint review/planning handoff.

## Required Evidence

Verified capacity, Goal readiness, Goal names/deadlines/DoD/parents/Sub-task plans, dependencies, WIP, Sprint Goal, scope changes, carry-over, acceptance criteria, validation and Goal DoD evidence, repository/CI evidence when available, and governed target-page ownership/version.

## Output Contract

Sprint Goal and coherent deadline-bound Goal Story scope; accepted-Goal review listing satisfied/unsatisfied structured ACs and DoD conditions distinct from Jira status; explicit carry-over and missed-deadline reasons; at most three retrospective experiments with owner role, expected signal, review date, and stop/rollback condition; and canonical Vietnamese Jira proposals when needed.

## Semantic Capabilities

`jira.board.read`, `jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, `confluence.page.search`, and `confluence.page.read`. Semantic names are matched against exposed descriptions/schemas, never assumed tool names.

## Workflow

1. Define the Sprint Goal and deliverables before selecting coherent supporting Goal Stories. Select only Goals with verified name/deadline/DoD, complete structured AC statements/verification and exact traceability, Epic parent, at least two complete Sub-tasks with scope, steps, affected files, validation, DoD, local ACs, capacity fit, and an acyclic same-Goal dependency graph with all other target-sprint dependencies resolved.
2. Reject scope that exceeds verified capacity, misses its sprint-end deadline without an approved exception, lacks Goal readiness, breaches WIP, or loses outcome coherence.
3. Review every Goal DoD condition against acceptance criteria, required Sub-tasks, validation, Jira state, repository/CI, and stakeholder outcome evidence. Jira `Done` without complete Goal DoD evidence is `DoD incomplete`, never accepted completion.
4. Preserve carry-over and scope-change reasons. Retrospective input includes missed Goal deadlines, Goal DoD failures, attempted over-four-hour decomposition, and excessive Sub-task carry-over without scoring individuals.
5. Propose at most three evidence-backed experiments; never rank individual performance.
6. Route governed page proposals normally; render optional Jira PMA proposals through `docs/project-management/templates/jira/index.json`, preserving AC content and technical literals, without executing them.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Missing Goal deadline/DoD/decomposition, capacity, acceptance, ownership, or history remains `not verified`; do not fabricate scope, dates, or outcome acceptance.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
