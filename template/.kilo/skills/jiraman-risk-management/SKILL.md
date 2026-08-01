---
name: jiraman-risk-management
description: "Validate and reconcile governed risk records without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
---

# jiraman-risk-management

## Purpose

Validate and reconcile governed risk records without writes.

## Triggers

Exact `risks` or a risk handoff.

## Required Evidence

In-scope risk pages, source sections, related Jira work, decisions, duplicates, and retrieval time.

## Output Contract

Risk records/findings with owner, likelihood, impact, mitigation, trigger, status, review date, evidence, duplicate disposition, and page/PMA proposals.

## Semantic Capabilities

`confluence.page.search`, `confluence.page.read`, `jira.issue.search`, and `jira.issue.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Validate every required risk field.
2. Search before proposing new records; update/link existing records.
3. Connect risk effects to dependencies/readiness when evidenced.
4. Never call a write tool.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Missing owner/exposure/trigger/status/review date remains an explicit gap. Do not accept, close, or assign a risk without evidence.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
