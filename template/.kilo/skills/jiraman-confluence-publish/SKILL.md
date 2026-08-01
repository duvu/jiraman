---
name: jiraman-confluence-publish
description: "Resolve governed pages and create safe version-bound Confluence proposals without writes."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
---

# jiraman-confluence-publish

## Purpose

Resolve governed pages and create safe version-bound Confluence proposals without writes.

## Triggers

Internal handoff from reporting, planning, meeting, risk, decision, or refinement.

## Required Evidence

Configured space/root, page type, current page ID/version/content/labels/metadata, ownership markers, desired managed content, relevant Jira links, and retrieval time.

## Output Contract

No-op, create, managed-section update, human-page comment, or delimited proposed patch with page ID, current version, relevant current content, exact desired content, reason, preconditions, rollback source, and ambiguity findings.

## Semantic Capabilities

`confluence.page.search`, `confluence.page.read`, and optional `confluence.label.read` and `confluence.comment.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Use lookup order: configured page ID, metadata key, label, then title. Stop on duplicate or ambiguous matches.
2. Page tree types are Project Home, Goals/Roadmap, Next Two Weeks, Epics, Specifications, Decisions, Risks/Dependencies, Sprints, Status Reports, Meetings, and Archive, each governed by the inventory.
3. Full replacement is allowed only for explicit `jiraman-managed` pages. Mixed pages update only marked managed sections. Human pages default to comment or delimited patch.
4. No-op when managed content is unchanged. Re-read during apply rather than using a patching service.
5. Audit missing Story/spec links, orphan records, broken/cross-scope references, lifecycle, last-reviewed/review-due dates, and material Jira changes. Exclude archived/superseded from active rules and use `not verified` when history is unavailable.
6. Every freshness/link finding names entities, evidence, rule, severity, confidence, and suggested action.
7. Never call a write tool.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Missing version/ownership/root or ambiguous matches blocks an executable proposal. Return a local draft and `not verified` gaps.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
