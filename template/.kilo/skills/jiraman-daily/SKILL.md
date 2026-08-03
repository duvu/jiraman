---
name: jiraman-daily
description: "Reconcile yesterday and propose deadline-bound Goal/Sub-task daily commitments without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
jira_ticket_contract: docs/project-management/templates/jira/index.json
jira_language_contract: docs/project-management/templates/jira/index.json#/proposal_workflows/jiraman-daily
goal_contract: goal-name,target-completion-date,structured-ac,goal-dod,epic-parent,min-two-subtasks,max-four-hours,traceability
---

# jiraman-daily

## Purpose

Reconcile yesterday and propose evidence-backed daily commitments without writes.

## Triggers

Empty input or exact `daily`.

## Required Evidence

Current capability health; active sprint and Goal Stories when available; each Goal's name, deadline, deadline source, DoD conditions, parent/decomposition/readiness; bounded AIPLATFORM Sub-task fields; previous governed Daily page or fallback artifact; current decisions, risks, blockers, review/validation queues, ownership, estimates, and validation evidence. Record retrieval time and source for each fact.

## Output Contract

Capability health; evidence window; previous commitments classified `done`, `partial`, `not started`, `blocked`, or `not verified`; overdue/near-deadline and incomplete-DoD Goal risks; flow constraints; at most one primary and one fallback Sub-task per verified assignee, each naming parent Goal, Goal deadline, relevant parent and local ACs, Goal DoD condition, outcome, estimate, and validation; N+1/N+2 outlook; decisions required; PMG/PMA proposals rendered through the canonical Vietnamese Jira contract; facts, assumptions, recommendations, and confidence.

## Semantic Capabilities

`jira.project.read`, `jira.board.read`, `jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, `confluence.page.search`, and `confluence.page.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Run capability and fixed-scope preflight before the first read.
2. Read the active sprint or explicitly report no verified active sprint. Jira status alone never proves completion.
3. Reconcile prior commitments using acceptance/validation and Goal DoD evidence, not status alone. Missing Goal name/date/DoD or fewer than two valid children is a management/refinement risk and never Ready.
4. Identify overdue and near-deadline Goals, then preserve the priority order: incidents/security, unblock work, clear review/validation queues, finish active work, protect the sprint Goal, restore runway, then consider new work.
5. Every commitment names its parent Goal, verified target date, relevant Goal DoD condition, Sub-task outcome, `0h < estimate <= 4h`, and exact validation. Do not infer a deadline or completion from status.
6. Enforce configured Story and per-assignee Sub-task WIP. Unknown capacity or ownership remains unknown.
7. Any Jira update/comment proposal preserves the complete structured AC section or proposes only the missing managed section/comment; missing AC content blocks executable output. Render through `docs/project-management/templates/jira/index.json`, use only transparent counts/arithmetic from returned data, and never call a write tool.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

If sprint APIs are absent, label sprint metadata and deadline fit `not verified` and use bounded project issue evidence. If Goal fields/DoD/decomposition, previous commitments, owner, estimate, history, or capacity cannot be verified, do not infer them, classify the Goal Ready, or create personal commitments.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
