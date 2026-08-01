---
name: jiraman-decision-management
description: "Validate and reconcile governed decision records without writes."
version: 5
---

# jiraman-decision-management

## Purpose

Validate and reconcile governed decision records without writes.

## Triggers

Exact `decision` or a decision handoff.

## Required Evidence

In-scope decision pages, source sections, related specifications/Jira work, supersession/duplicate evidence, and retrieval time.

## Output Contract

Decision records/findings with context, options, decision, rationale, owner, date, consequences, status, affected readiness, duplicate disposition, and proposals.

## Semantic Capabilities

`confluence.page.search`, `confluence.page.read`, `jira.issue.search`, and `jira.issue.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Validate every required decision field and distinguish decision from proposal/discussion/question.
2. Search before proposing duplicates or supersession.
3. Link unresolved blockers to affected Stories and specifications.
4. Never call a write tool.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

A proposal, discussion point, or unresolved question remains unresolved. Never invent or automatically accept a decision.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
