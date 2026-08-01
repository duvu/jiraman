---
name: jiraman-sprint-cadence
description: "Prepare evidence-bound sprint planning, review, and retrospective proposals without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
---

# jiraman-sprint-cadence

## Purpose

Prepare evidence-bound sprint planning, review, and retrospective proposals without writes.

## Triggers

Exact `retrospective`, normalized `sprint-plan`, or an internal sprint review/planning handoff.

## Required Evidence

Verified capacity, readiness, dependencies, WIP, Sprint Goal, scope changes, carry-over, acceptance criteria, validation evidence, repository/CI evidence when available, and governed target-page ownership/version.

## Output Contract

Sprint Goal and coherent scope proposal; accepted-outcome review distinct from Jira status; explicit carry-over reasons; and at most three retrospective experiments with owner role, expected signal, review date, and stop/rollback condition.

## Semantic Capabilities

`jira.board.read`, `jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, `confluence.page.search`, and `confluence.page.read`. Semantic names are matched against exposed descriptions/schemas, never assumed tool names.

## Workflow

1. Define the Sprint Goal and deliverables before selecting supporting Ready Stories.
2. Reject scope that exceeds verified capacity, dependencies, readiness, WIP, or outcome coherence.
3. Compare acceptance criteria, validation, Jira state, repository/CI evidence, and stakeholder outcome evidence; Done alone is not accepted.
4. Preserve carry-over and scope-change reasons.
5. Propose at most three evidence-backed experiments; never rank individual performance.
6. Route governed page and optional PMA proposals without executing them.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Missing capacity, acceptance, ownership, or history remains `not verified`; do not fabricate scope or outcome acceptance.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
