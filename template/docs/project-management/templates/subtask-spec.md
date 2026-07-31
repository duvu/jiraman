# Sub-task Specification Template

A Sub-task is the only implementation or bounded-investigation execution unit. It must have exactly one Story parent and must take no more than four focused work hours, including validation.

## Recommended Title

Use a specific imperative verb and object:

```text
Add OIDC audience validation to gateway requests
```

Avoid vague titles such as `Backend work`, `Fix auth`, `Research issue`, or `Implement changes`.

## Parent Story And Specification Reference

- Story: `<AIPLATFORM-KEY>`
- Canonical spec: `<repository path or Story-description section>`

## Outcome

State one concrete, observable deliverable.

## Traceability

- Requirements: `<REQ-1, REQ-2>`
- Acceptance criteria: `<AC-1, AC-2>`

## Scope

### In Scope

- `<specific implementation, test, migration, documentation, validation, or investigation work>`

### Out Of Scope

- `<meaningful exclusion that prevents expansion>`

## Implementation Or Investigation Steps

1. `<bounded step>`
2. `<bounded step>`
3. `<validation step>`

For an investigation, specify the required bounded output: reproduction, evidence, root cause, benchmark, decision recommendation, or implementation plan.

## Affected Modules Or Files

- `<exact/module/path when verified>`
- `not verified` when evidence is unavailable; do not invent paths.

## Dependencies And Preconditions

- `<issue, access, environment, data, decision, or prerequisite>`

## Validation Commands Or Checks

```bash
<exact command>
```

Expected result:

```text
<observable success condition>
```

## Definition Of Done

- `<testable completion condition>`
- Validation evidence is attached or referenced.
- Parent Story traceability remains accurate.

## Original Estimate

- Focused execution: `<estimate > 0h and <= 4h>`

Any estimate above `4h` requires splitting before the Sub-task can be Ready or scheduled. Do not reduce an estimate artificially; split the scope or create a bounded investigation first. If four focused work hours are consumed before completion, stop, record the evidence and remainder, and create new sibling Sub-tasks for the remaining bounded work.
