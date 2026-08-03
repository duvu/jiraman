---
name: jiraman-confluence-reporting
description: "Prepare Goal deadline, DoD, and active-Sub-task aware Confluence report proposals."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
goal_contract: goal-name,target-completion-date,structured-ac,goal-dod,epic-parent,min-two-subtasks,max-four-hours,traceability
---

# jiraman-confluence-reporting

## Purpose

Prepare daily, weekly, sprint, retrospective, and two-week Confluence report proposals.

## Triggers

Exact `status` or a reporting handoff.

## Required Evidence

Current evidence gathered directly by the active skill, retrieval time, sources consulted, Goal names/deadlines/deadline evidence/DoD evidence/active Sub-tasks, target page identity/ownership/version, Jira live links/queries when supported, and prior managed content.

## Output Contract

Report proposal separating executive summary, each Goal's name/deadline status/DoD evidence or gaps/active Sub-task summary, delivered outcomes, sprint Goal, flow constraints, next outcomes, risks, dependencies, decisions required, scope changes, assumptions, evidence confidence, and ownership/version preconditions.

## Semantic Capabilities

`jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, `confluence.page.search`, and `confluence.page.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Support Daily Control, Weekly Status, Sprint Planning, Sprint Review, Retrospective, and Next-Two-Week Plan formats.
2. For every reported Goal show target date and one of `on track`, `at risk`, `overdue`, `completed`, or `not verified`; list satisfied/unsatisfied Goal DoD evidence and active child Sub-tasks. Never infer dates, completion, or DoD evidence from Jira status alone.
3. Distinguish outcomes from activity and issue counts; prefer live Jira links/queries for state and due date over copied or unverifiable facts.
4. Record evidence retrieval time and sources.
5. Route every page proposal through `jiraman-confluence-publish`; never execute it.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Missing history, due-date read capability, or Goal DoD evidence is `not verified`, not zero or complete. If ownership/version is missing, return a local draft only. Unchanged managed content produces no action.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
