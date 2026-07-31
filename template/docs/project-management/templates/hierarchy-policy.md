# AIPLATFORM Delivery Hierarchy Policy

```text
Epic
└── Story
    └── Sub-task
```

## Epic

- Capability or outcome container.
- Has no parent delivery issue.
- Is not a sprint-capacity or daily execution unit.
- Decomposes only into Stories.

## Story

- Has exactly one Epic parent.
- Represents one demonstrable and acceptable outcome that fits within one one-week sprint.
- Is the sprint-planning and capacity-counting unit.
- Must have a complete specification and at least one child Sub-task.
- Is Ready only when all required Sub-tasks are Ready and all requirements and acceptance criteria have Sub-task coverage.

## Sub-task

- Has exactly one Story parent.
- Is the only implementation or bounded-investigation execution unit.
- Has one primary outcome, exact validation, and a testable Definition of Done.
- References the parent Story specification, requirement IDs, and acceptance-criteria IDs.
- Has an original estimate greater than `0h` and no more than `4h`.
- Must be split before Ready when estimated above four focused work hours.
- Must stop and replan remaining work into sibling Sub-tasks if four focused hours are consumed before completion.

## Prohibited Structure

- No standalone Task, Bug, Spike, Improvement, or other delivery issue types.
- No nested Epics.
- No Story under Story.
- No Sub-task directly under Epic.
- No child issue under a Sub-task.
- Issue links do not substitute for parent relationships.

Defects with independent accepted outcomes are Stories under an Epic; diagnosis, implementation, regression testing, and validation are Sub-tasks. Open-ended research is not Ready work. A bounded investigation must produce evidence, a root-cause statement, a decision, a reproduction, a benchmark, or an implementation plan within four hours.
