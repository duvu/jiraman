---
name: jiraman-meeting-actions
description: "Extract governed meeting outcomes and reconciled action proposals without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
jira_ticket_contract: docs/project-management/templates/jira/index.json
---

# jiraman-meeting-actions

## Purpose

Extract governed meeting outcomes and reconciled action proposals without writes.

## Triggers

Exact `meeting` with a page/reference.

## Required Evidence

In-scope meeting page/section, retrieval time, related Jira/Confluence search results, and current risk/decision records.

## Output Contract

Decisions, action items, risks, questions, dependencies, verified owners/dates, duplicate disposition, readiness effects, and evidence-backed page/PMA proposals. Any Jira proposal uses the canonical Vietnamese ticket template and complete structured ACs or remains non-executable.

## Semantic Capabilities

`confluence.page.search`, `confluence.page.read`, `jira.issue.search`, and `jira.issue.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Extract each item with source page and section evidence.
2. Only a concrete outcome with valid Epic/Story context becomes Jira work.
3. Search Jira and Confluence before proposing a duplicate; existing matches become update/link proposals.
4. Link unresolved blocking decisions to readiness findings. A Jira candidate without source-backed AC statements and verification remains a refinement gap; never invent them.
5. Render any complete Jira proposal through `docs/project-management/templates/jira/index.json`, preserving parent AC refs and technical literals, then never call a write tool.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Ambiguous owner, date, decision, parent, or duplicate is reported, never guessed. Preserve discussion/proposal/question separately from an accepted decision.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
