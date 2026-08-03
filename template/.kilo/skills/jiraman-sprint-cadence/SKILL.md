---
name: jiraman-sprint-cadence
description: "Plan and review Goal Stories using deadline, DoD, acceptance, and child evidence without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
goal_contract: goal-name,target-completion-date,goal-dod,epic-parent,min-two-subtasks,max-four-hours,traceability
---

# jiraman-sprint-cadence

## Purpose

Prepare evidence-bound sprint planning, review, and retrospective proposals without writes.

## Triggers

Exact `retrospective`, normalized `sprint-plan`, or an internal sprint review/planning handoff.

## Required Evidence

Verified capacity, Goal readiness, Goal names/deadlines/DoD/parents/Sub-task plans, dependencies, WIP, Sprint Goal, scope changes, carry-over, acceptance criteria, validation and Goal DoD evidence, repository/CI evidence when available, and governed target-page ownership/version.

## Output Contract

Sprint Goal and coherent deadline-bound Goal Story scope; accepted-Goal review listing satisfied/unsatisfied DoD conditions distinct from Jira status; explicit carry-over and missed-deadline reasons; and at most three retrospective experiments with owner role, expected signal, review date, and stop/rollback condition.

## Semantic Capabilities

`jira.board.read`, `jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, `confluence.page.search`, and `confluence.page.read`. Semantic names are matched against exposed descriptions/schemas, never assumed tool names.

## Workflow

1. Define the Sprint Goal and deliverables before selecting coherent supporting Goal Stories. Select only Goals with verified name/deadline/DoD, complete specification/traceability, Epic parent, at least two valid Sub-tasks, capacity fit, and resolved target-sprint dependencies.
2. Reject scope that exceeds verified capacity, misses its sprint-end deadline without an approved exception, lacks Goal readiness, breaches WIP, or loses outcome coherence.
3. Review every Goal DoD condition against acceptance criteria, required Sub-tasks, validation, Jira state, repository/CI, and stakeholder outcome evidence. Jira `Done` without complete Goal DoD evidence is `DoD incomplete`, never accepted completion.
4. Preserve carry-over and scope-change reasons. Retrospective input includes missed Goal deadlines, Goal DoD failures, attempted over-four-hour decomposition, and excessive Sub-task carry-over without scoring individuals.
5. Propose at most three evidence-backed experiments; never rank individual performance.
6. Route governed page and optional PMA proposals without executing them.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Missing Goal deadline/DoD/decomposition, capacity, acceptance, ownership, or history remains `not verified`; do not fabricate scope, dates, or outcome acceptance.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
