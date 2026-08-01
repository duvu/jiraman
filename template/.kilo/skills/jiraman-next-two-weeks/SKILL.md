---
name: jiraman-next-two-weeks
description: "Build two-week scenarios, recommendations, sprint plans, reviews, and retrospectives without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
---

# jiraman-next-two-weeks

## Purpose

Build two-week scenarios, recommendations, sprint plans, reviews, and retrospectives without writes.

## Triggers

Exact `plan next-2-weeks` or `brainstorm`, including deliverable aliases.

## Required Evidence

Verified Epic alignment/value/urgency/dependencies/risks; Ready Stories and Sub-tasks; N+1/N+2 capacity basis; WIP; acceptance/validation evidence; prior sprint scope changes/carry-over; selected DLV lineage; governed report/page ownership and version.

## Output Contract

Stable DLV candidates and distinct scenarios; evidence-based recommendation or `No evidence-based recommendation`; Week 1/Week 2 outcomes and acceptance signals; displaced work; and a governed Confluence page proposal.

## Semantic Capabilities

`jira.board.read`, `jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, `confluence.page.search`, and `confluence.page.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Assign stable `DLV-YYYYMMDD-NN` IDs with outcome, primary Epic, supporting Stories, target sprint, acceptance signal, rationale, evidence, assumptions, hypotheses, readiness, capacity/dependency/WIP fit, risk, and confidence.
2. Classify each candidate Ready-backed, Refinement candidate, New hypothesis, or Excluded. Hypotheses never count toward runway or commitments.
3. Create materially different Flow-first, Risk-reduction, and Value-first scenarios with displaced work and separate demonstrable Week 1/Week 2 outcomes.
4. Compare qualitative alignment, value, urgency, leverage, risk reduction, readiness, capacity, validation, and WIP. Recommend only Ready-backed feasible scenarios; otherwise say `No evidence-based recommendation`.
5. Sprint planning defines the Sprint Goal/deliverables before supporting Stories and rejects incoherent or over-capacity scope.
6. Sprint review distinguishes Jira Done from accepted outcome evidence and preserves carry-over reasons.
7. Each of at most three retrospective experiments has owner role, expected signal, review date, and stop/rollback condition. Never rank individual performance.
8. Route page proposals through `jiraman-confluence-publish`; never execute them.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Without verified priority, capacity, dependency, readiness, or decision evidence, produce hypotheses/refinement needs and no capacity-feasible recommendation. Never invent numeric weights.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
