---
name: jiraman-daily
description: "Reconcile yesterday and propose evidence-backed daily commitments without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
---

# jiraman-daily

## Purpose

Reconcile yesterday and propose evidence-backed daily commitments without writes.

## Triggers

Empty input or exact `daily`.

## Required Evidence

Current capability health; active sprint and goal when available; bounded AIPLATFORM Story/Sub-task fields; previous governed Daily page or fallback artifact; current decisions, risks, blockers, review/validation queues, ownership, estimates, and validation evidence. Record retrieval time and source for each fact.

## Output Contract

Capability health; evidence window; previous commitments classified `done`, `partial`, `not started`, `blocked`, or `not verified`; flow constraints; at most one primary and one fallback Sub-task per verified assignee; N+1/N+2 outlook; decisions required; PMG/PMA proposals; facts, assumptions, recommendations, and confidence.

## Semantic Capabilities

`jira.project.read`, `jira.board.read`, `jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, `confluence.page.search`, and `confluence.page.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Run capability and fixed-scope preflight before the first read.
2. Read the active sprint or explicitly report no verified active sprint. Jira status alone never proves completion.
3. Reconcile prior commitments using acceptance/validation evidence and changed fields, not status alone.
4. Prioritize incidents/security, unblock work, clear review/validation queues, finish active work, protect the sprint goal, restore runway, then consider new work.
5. Enforce configured Story and per-assignee Sub-task WIP. Unknown capacity or ownership remains unknown.
6. Use only transparent counts/arithmetic from returned data and never call a write tool.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

If sprint APIs are absent, label sprint metadata `not verified` and use bounded project issue evidence. If previous commitments, owner, estimate, history, or capacity cannot be verified, do not infer them or create personal commitments.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
