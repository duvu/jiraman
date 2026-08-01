---
name: jiraman-confluence-reporting
description: "Prepare daily, weekly, sprint, retrospective, and two-week Confluence report proposals."
version: 5
side_effects: none
policy: .kilo/policies/jiraman-safety.md
---

# jiraman-confluence-reporting

## Purpose

Prepare daily, weekly, sprint, retrospective, and two-week Confluence report proposals.

## Triggers

Exact `status` or a reporting handoff.

## Required Evidence

Current evidence gathered directly by the active skill, retrieval time, sources consulted, target page identity/ownership/version, Jira live links/queries when supported, and prior managed content.

## Output Contract

Report proposal separating executive summary, delivered outcomes, sprint goal, flow constraints, next outcomes, risks, dependencies, decisions required, scope changes, assumptions, evidence confidence, and ownership/version preconditions.

## Semantic Capabilities

`jira.sprint.read`, `jira.issue.search`, `jira.issue.read`, `confluence.page.search`, and `confluence.page.read`. Semantic names are matched against exposed tool descriptions and schemas; they are never assumed installation-specific names.

## Workflow

1. Support Daily Control, Weekly Status, Sprint Planning, Sprint Review, Retrospective, and Next-Two-Week Plan formats.
2. Distinguish outcomes from activity and issue counts; prefer live Jira links/queries over copied status tables.
3. Record evidence retrieval time and sources.
4. Route every page proposal through `jiraman-confluence-publish`; never execute it.

## Side Effects

None. Jira and Confluence writes are prohibited; emit reviewable proposals only.

## Degraded Mode

Missing history is `not verified`, not zero. If ownership/version is missing, return a local draft only. Unchanged managed content produces no action.

## Shared Policy

Read and enforce .kilo/policies/jiraman-safety.md; it is authoritative for scope, source ownership, untrusted content, evidence labels, privacy, and write safety.
