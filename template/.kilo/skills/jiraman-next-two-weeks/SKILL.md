---
name: jiraman-next-two-weeks
description: "Build independent N+1/N+2 scenarios from deadline-bound Ready Goal Stories without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
jira_ticket_contract: docs/project-management/templates/jira/index.json
jira_language_contract: docs/project-management/templates/jira/index.json#/proposal_workflows/jiraman-next-two-weeks
goal_contract: goal-name,target-completion-date,structured-ac,goal-dod,epic-parent,min-two-subtasks,max-four-hours,traceability
---

# jiraman-next-two-weeks

## Purpose

Build two-week scenarios, recommendations, sprint plans, reviews, and retrospectives without writes.

## Triggers

Exact `plan next-2-weeks` or `brainstorm`, including deliverable aliases.

## Required Evidence

Verified Epic alignment/value/urgency/dependencies/risks; Goal Story name, deadline source/date, Goal DoD, parent, specification, REQ/AC/traceability, and at least two valid Sub-tasks; independent N+1/N+2 sprint end and capacity evidence; WIP; prior scope changes/carry-over; selected DLV lineage; governed report/page ownership and version.

## Output Contract

Stable DLV candidates listing each supporting Goal's name, deadline, structured ACs, DoD/acceptance signal, readiness, and child coverage; distinct scenarios with protected/moved/at-risk deadlines; evidence-based recommendation or `No evidence-based recommendation`; separate N+1/N+2 outcomes and displaced work; and governed Confluence/Jira proposals. Any Jira proposal uses the canonical Vietnamese ticket contract.

## Semantic Capabilities

`jira.board.read`, `jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, `confluence.page.search`, and `confluence.page.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Assign stable `DLV-YYYYMMDD-NN` IDs with outcome, primary Epic, supporting Goal Stories, each Goal name/deadline/DoD/readiness/Sub-task coverage, target sprint and verified end date, acceptance signal, rationale, evidence, assumptions, hypotheses, capacity/dependency/WIP fit, risk, and confidence.
2. Classify each candidate Ready-backed, Refinement candidate, New hypothesis, or Excluded. Ready-backed requires a verified allowed deadline source with a concrete reference, canonical specification, non-empty unique REQ/Goal-DoD IDs, complete structured AC statements/verification covering every REQ, at least two uniquely referenced Sub-tasks in `(0h, 4h]` with outcome, in/out scope, steps, affected files, validation, DoD, and local AC traceability, exact parent-AC/requirement/DoD traceability maps that use only those child references, and a same-Goal acyclic child dependency graph with every other target-sprint dependency resolved. Missing/malformed/conflicting evidence is Refinement, and hypotheses or undecomposed work never count toward runway or commitments.
3. Evaluate N+1 and N+2 independently; excess N+1 cannot fill an empty/unready N+2. A committed Goal date must be on or before its verified sprint end unless an explicit approved exception is recorded.
4. Create materially different Flow-first, Risk-reduction, and Value-first scenarios with displaced work, separate demonstrable Week 1/Week 2 outcomes, and exact Goal deadlines protected, moved, or put at risk.
5. Compare qualitative alignment, value, urgency, leverage, risk reduction, Goal readiness, deadline fit, capacity, validation, dependencies, and WIP. Recommend only Ready-backed feasible scenarios; insufficient deadline/capacity/dependency/DoD evidence returns `No evidence-based recommendation`.
6. Sprint planning defines the Sprint Goal/deliverables before coherent supporting Goal Stories and rejects unverified, deadline-misaligned, or over-capacity scope.
7. Sprint review distinguishes Jira Done from Goal DoD/acceptance evidence and preserves carry-over reasons.
8. Each of at most three retrospective experiments has owner role, expected signal, review date, and stop/rollback condition. Never rank individual performance.
9. Route page proposals through `jiraman-confluence-publish`. Render any Jira PMA proposal through `docs/project-management/templates/jira/index.json`, preserve structured ACs and technical literals, and never execute it.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Without verified priority, Goal deadline/DoD/decomposition, capacity, dependency, readiness, or decision evidence, produce hypotheses/refinement needs and no capacity-feasible recommendation. Use `not verified`; never invent dates, numeric weights, or commitments.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
