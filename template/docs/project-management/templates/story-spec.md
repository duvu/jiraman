# Story Specification Template

A Story is the sprint-planning and accepted-outcome unit. It must have exactly one Epic parent and must fit within one one-week sprint.

## Epic Parent

- Epic: `<AIPLATFORM-KEY>`

## Canonical Specification

- Source: `<repository path, Confluence/Jira reference, or this Jira description>`
- Version/commit/date: `<stable reference>`

## Outcome

Describe one observable result that can be accepted independently.

## Context

Explain the problem, users, systems, data, or operational need.

## Scope

### In Scope

- `<included behavior>`

### Out Of Scope

- `<explicit exclusion>`

## Requirements

- `REQ-1`: `<specific functional or nonfunctional requirement>`
- `REQ-2`: `<specific functional or nonfunctional requirement>`

## Acceptance Criteria

- `AC-1`: `<testable acceptance condition>`
- `AC-2`: `<testable acceptance condition>`

Use Given/When/Then when it improves precision:

```text
AC-3
Given <precondition>
When <action or event>
Then <observable result>
```

## Constraints And Nonfunctional Requirements

- `<security, performance, compatibility, data, operational, regulatory, or architecture constraint>`

## Dependencies And Preconditions

- `<issue key, decision, access, environment, data, or external input>`

## Validation Plan

- Automated: `<exact test suite or command>`
- Integration: `<exact check or scenario>`
- Manual/operational: `<exact observable check, if applicable>`

## Rollout Or Recovery

- Rollout: `<steps or not applicable>`
- Recovery/rollback: `<steps or not applicable>`

## Sub-task Traceability Map

| Requirement / AC | Covering Sub-task | Validation |
|---|---|---|
| `REQ-1`, `AC-1` | `<SUBTASK-KEY or proposed title>` | `<command/check>` |
| `REQ-2`, `AC-2` | `<SUBTASK-KEY or proposed title>` | `<command/check>` |

## Story Definition Of Done

- All required Sub-tasks are Done.
- Every acceptance criterion is verified.
- Integration validation passes when applicable.
- CI passes when applicable.
- Deliverable or implementation evidence is recorded.
