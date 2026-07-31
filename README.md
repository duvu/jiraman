# Jiraman for Kilo Code — v3

Project-local technical PM agent for the fixed Jira project `AIPLATFORM`.

It uses the existing `mcp-atlassian` integration, runs one-week sprints, maintains at least two fully Ready sprint-equivalents ahead of the active sprint, and enforces this delivery model:

```text
Epic -> Story -> Sub-task
```

A Story is the sprint-planning unit. A Sub-task is the only implementation or bounded-investigation execution unit. Every Sub-task must be spec-traceable, actionable, exactly verifiable, estimated at no more than four focused work hours, and stopped for replanning if the four-hour focused-work timebox expires.

## Assumptions

- Kilo Code is already installed.
- Your own `mcp-atlassian` server is already configured and working in Kilo.
- This package must not install, replace, or modify the MCP server.
- The Jira project is always `AIPLATFORM`.

## Install

Clone this repository, then install Jiraman into the target Kilo project:

```bash
git clone https://github.com/duvu/jiraman.git
cd jiraman
./install.sh /absolute/path/to/your/project
```

If Jiraman files already exist:

```bash
./install.sh /absolute/path/to/your/project --force
```

`--force` creates a timestamped backup before replacing managed Jiraman files.

## Files

```text
.kilo/
├── agent/jiraman.md
├── commands/jiraman.md
├── config/jiraman.yaml
└── state/jiraman.json       # operational state; gitignored

docs/project-management/
├── daily/
├── weekly-reports/
├── sprint-reviews/
├── templates/
│   ├── epic-spec.md
│   ├── story-spec.md
│   ├── subtask-spec.md
│   └── hierarchy-policy.md
├── risk-register.md
└── decision-log.md
```

## Mandatory hierarchy

```text
Epic
└── Story
    └── Sub-task
```

- Epic: capability or outcome container; never a daily execution or sprint-capacity unit.
- Story: one-sprint accepted outcome; exactly one Epic parent; sprint-planning and capacity unit.
- Sub-task: concrete execution unit; exactly one Story parent; `0h < estimate ≤ 4h` focused effort including validation.
- No standalone Task, Bug, Spike, Improvement, or other delivery issue types.
- A defect with an independent outcome is a Story; diagnosis, implementation, regression testing, and validation are Sub-tasks.
- A bounded investigation may be a Sub-task only when it produces evidence, a root cause, a decision, a reproduction, a benchmark, or an implementation plan in no more than four hours.

## Spec-driven readiness

A Story counts toward the active or future sprint runway only when:

- it has exactly one Epic parent;
- its specification is complete;
- requirements and acceptance criteria have stable IDs;
- all required Sub-tasks exist;
- every Sub-task is actionable, traceable, exactly verifiable, and estimated at no more than four hours;
- every requirement and acceptance criterion is covered by one or more Sub-tasks;
- dependencies, access, blockers, and required decisions are resolved;
- the Story fits within one one-week sprint.

Both future sprint-equivalents must be fully decomposed to Ready Sub-tasks. A Story outline without executable Sub-tasks does not count.

## Estimation and buffering

The four-hour maximum applies to one Sub-task's focused execution, including validation:

```text
0h < Sub-task Original Estimate <= 4h
```

Jiraman does not double a Sub-task estimate for risk buffering. Contingency is held at sprint-capacity level through the configured capacity factor. Unknown work must be split or preceded by a bounded investigation; its estimate must not be artificially reduced to four hours. If focused work reaches four hours before completion, record evidence and move the remaining scope into new sibling Sub-tasks rather than extending the original item.

Capacity is counted once per Story:

1. Prefer Story points recorded on Stories.
2. Otherwise, when hour-based capacity is used, aggregate unique Ready Sub-task original estimates for each Story.
3. Never add Story and Sub-task estimates together.
4. Never count Epics.

## Kilo MCP permissions

Open Kilo Settings -> Agent Behaviour -> Auto Approve and inspect the exact tools exposed by your existing MCP server.

Use this policy:

- Jira read/search/get/list tools: `allow`
- Jira create/update/comment/transition/assign/sprint-write tools: `ask`
- Destructive tools, when present: `deny` unless a separate controlled workflow exists

Tool names are installation-specific. Use the exact names displayed by Kilo. The agent additionally enforces `apply <ACTION_ID...>` before calling a Jira write tool.

## Reload

Start a new Kilo chat after installation so the agent and slash command are loaded.

## Smoke tests

Audit hierarchy and issue types:

```text
/jiraman hierarchy
```

Audit the two-sprint runway:

```text
/jiraman runway
```

Refine one Story into a complete specification and actionable Sub-tasks:

```text
/jiraman refine AIPLATFORM-123
```

Run the daily PM loop:

```text
/jiraman
```

## Main commands

```text
/jiraman daily
/jiraman hierarchy
/jiraman triage AIPLATFORM-123
/jiraman refine AIPLATFORM-123
/jiraman sprint-health
/jiraman sprint-plan
/jiraman runway
/jiraman review AIPLATFORM-123
/jiraman status weekly
/jiraman sprint-review
```

## Applying a proposed Jira action

A read-only run may produce action IDs such as:

```text
PMA-20260731-01
```

Apply only named actions:

```text
/jiraman apply PMA-20260731-01
```

Before creating a Story or Sub-task, Jiraman revalidates the exact issue type, parent relationship, specification, traceability, validation, and estimate. Kilo should still prompt because Jira write tools remain configured as `ask`.

## Initial WIP policy

- Maximum active Stories: 4
- Maximum active Story per assignee: 1
- Maximum In Progress Sub-task per assignee: 1
- Review queue limit: 3
- Testing queue limit: 2

Tune WIP after observing actual throughput and cycle time. Do not increase WIP merely because two future sprints are fully prepared.
