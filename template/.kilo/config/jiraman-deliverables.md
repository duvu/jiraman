# Jiraman Next-Two-Week Deliverable Policy

This policy extends the `jiraman` agent with outcome planning and brainstorming for the two future one-week sprints after the active sprint. For the modes defined here, this policy and `.kilo/commands/jiraman.md` extend and supersede the older mode list in `.kilo/agent/jiraman.md`. All existing Jira safety, hierarchy, readiness, WIP, evidence, and `apply PMA-*` rules remain mandatory.

## Supported Modes

- `deliverables [focus]`
- `brainstorm [focus]`
- `next-2-weeks [focus]`
- `next-two-weeks [focus]` — alias for `next-2-weeks`
- `two-week-deliverables [focus]` — alias for `next-2-weeks`

The existing `daily`, `sprint-plan`, `sprint-health`, `runway`, `status weekly`, and `refine` modes must also use the integration rules in this policy.

## Planning Horizon

- Default horizon: `Sprint N+1` and `Sprint N+2` after the active sprint.
- The active sprint is excluded from the two-week horizon unless the user explicitly asks for the remainder of the current sprint plus the next sprint.
- Each target sprint is one calendar week.
- When no active sprint exists, use the next two board-aligned one-week windows and label the assumption.
- Never imply that two future sprints are active concurrently.

## Deliverable Definition

A deliverable is an observable stakeholder, operational, platform, architecture, security, compliance, or product outcome that can be accepted by the end of its target sprint.

A deliverable:

- is a planning concept, not a Jira issue type;
- does not create a fourth Jira hierarchy level;
- maps to one primary Epic;
- maps to one or more supporting Stories;
- has a target sprint: `N+1` or `N+2`;
- has a measurable acceptance signal;
- states why it should be delivered now;
- fits verified sprint capacity and dependencies before it is recommended as feasible.

Reject activity-only wording such as `work on authentication`, `improve tests`, or `implement backend`. Prefer an accepted outcome such as:

> Developers authenticate through the approved development identity flow, invalid-audience tokens are rejected, and the behavior is demonstrated by automated validation and audit evidence.

A deliverable that spans both weeks must expose an independently demonstrable Week 1 outcome and Week 2 outcome. Do not hide a two-week batch behind one vague result.

## Mandatory Jira Model

Deliverables never change the project hierarchy:

```text
Epic -> Story -> Sub-task
```

- Stories remain sprint-planning and capacity units.
- Sub-tasks remain the only implementation or bounded-investigation execution units.
- Every Sub-task remains actionable, spec-traceable, exactly verifiable, and estimated at `> 0h` and `<= 4h`.
- A brainstormed idea contributes nothing to Ready runway until its Stories and Sub-tasks satisfy the existing Definition of Ready.

## Candidate IDs And Classes

Assign each candidate a stable ID:

```text
DLV-YYYYMMDD-NN
```

Classify every candidate as exactly one of:

1. `Ready-backed`
   - All supporting Stories are fully Ready.
   - Capacity, dependency, and WIP fit are verified.
   - It may appear in the recommended capacity-feasible plan.
2. `Refinement candidate`
   - The outcome is relevant, but specification, hierarchy, decomposition, traceability, estimate, dependency, access, capacity, or decision gaps remain.
   - State each exact gap and the work required to close it.
3. `New hypothesis`
   - The idea is not adequately represented in Jira.
   - State the hypothesis, expected value, required evidence, assumptions, and confidence.
   - It is not a commitment and does not count toward Ready runway.
4. `Excluded`
   - It is not recommended in the horizon because of priority, capacity, dependency, duplication, evidence, scope, sequencing, or WIP constraints.
   - State the exclusion reason.

A green Ready runway does not prove that the available Stories form coherent or valuable deliverables. Assess readiness and outcome coherence separately.

## Evidence Inputs

Use available evidence from:

1. Active sprint goal and unfinished outcomes that affect sequencing.
2. Future sprint scope and ranked fully Ready backlog Stories.
3. Epic outcomes, priorities, exit criteria, deadlines, and stakeholder value.
4. Security, compliance, incident, or mandatory operational commitments.
5. Blockers, dependency chains, architecture decisions, and critical path.
6. Recent delivery, carry-over, failed validation, and defect evidence.
7. Risk register, decision log, canonical specifications, repository architecture, tests, configuration, and recent commits.
8. The user's explicit focus or constraints.

Do not invent stakeholder priority, deadline, capacity, demand, business value, or implementation status. Use `not verified` for unavailable evidence. Label extrapolations as assumptions and novel ideas as hypotheses.

## Recommendation Criteria

Evaluate candidates qualitatively against:

- Epic or strategic alignment;
- stakeholder or operational value;
- urgency or mandatory deadline;
- dependency leverage and sequencing;
- risk reduction;
- readiness and evidence quality;
- capacity and one-sprint fit;
- validation clarity;
- WIP impact.

Do not manufacture precise numeric scores or weights. Use numeric scoring only when the weights and measures are provided or verified.

For every proposed deliverable, include:

- `DLV-*` ID;
- concise accepted-outcome statement;
- candidate class;
- target sprint;
- primary Epic;
- supporting existing Story keys or `New candidate`;
- why now;
- acceptance signal;
- capacity, dependency, readiness, and WIP fit;
- principal risk;
- exact refinement required before commitment;
- confidence: `High`, `Medium`, `Low`, or `Not verified`;
- evidence, assumptions, and hypotheses.

Only `Ready-backed` candidates may be presented as capacity-feasible recommendations. Valuable but unready outcomes belong under refinement candidates.

## Brainstorming Scenarios

For `brainstorm` and `next-2-weeks`, generate two or three materially distinct scenarios when evidence permits:

- `Flow-first`: finish, integrate, validate, and operationalize work already close to delivery.
- `Risk-reduction`: remove the largest blocker, uncertainty, security exposure, architecture decision, or dependency risk.
- `Value-first`: maximize the most important verified stakeholder or operational outcome that fits capacity.

Do not create superficial scenarios that differ only in ordering. For each scenario, state:

- Week 1 outcome;
- Week 2 outcome;
- primary Epics and candidate Stories;
- prerequisites;
- displaced or delayed work;
- capacity and readiness feasibility;
- principal trade-off;
- assumptions and hypotheses;
- confidence.

Recommend one scenario only when evidence permits. Otherwise state `No evidence-based recommendation` and identify the missing decision input.

## Mode Workflows

### `deliverables [focus]`

Produce one evidence-based, capacity-feasible recommended plan for `N+1` and `N+2`:

- planning horizon and capacity basis;
- recommended two-week theme or `No coherent theme verified`;
- Week 1 deliverables;
- Week 2 deliverables;
- supporting Epics and Stories;
- acceptance signals;
- Ready-backed versus refinement/hypothesis/excluded classification;
- capacity, dependency, readiness, and WIP fit;
- trade-offs and displaced work;
- facts, assumptions, evidence gaps, and confidence;
- proposed Jira actions without executing them.

### `brainstorm [focus]`

Produce two or three distinct scenarios, compare trade-offs, and select one only when evidence permits. Ideas remain hypotheses until refined and Ready.

### `next-2-weeks [focus]`

Produce the recommended plan first, followed by concise alternative scenarios and the decision inputs that would change the recommendation.

### `sprint-plan`

Define coherent deliverable outcomes before selecting Story scope. Then map each selected deliverable to Ready Stories and actionable Sub-tasks without exceeding capacity or WIP.

### `daily`

Include a compact `N+1`/`N+2` deliverable outlook. Refresh the full outlook only when sprint scope, priority, capacity, blockers, dependencies, decisions, evidence, or user focus changed materially.

### `sprint-health` and `runway`

Report separately:

- Ready-runway sufficiency;
- whether Ready Stories form coherent deliverable outcomes;
- exact refinement needed when either condition fails.

### `status weekly`

Include the recommended next-two-week deliverable outlook and its confidence.

### `refine <DLV-ID>`

Resolve the selected candidate from the latest two-week deliverable artifact. Produce, without writing Jira:

- primary Epic mapping or proposed Epic specification;
- complete Story outcome/specification candidates;
- stable requirement and acceptance-criteria IDs;
- full Story-to-Sub-task traceability;
- actionable sibling Sub-tasks, each `<= 4h`;
- exact validation and Definition of Done;
- dependencies, estimates, assumptions, and proposed `PMA-*` Jira actions.

## Artifacts

Use:

```text
docs/project-management/two-week-deliverables/<YYYY-MM-DD>-AIPLATFORM.md
```

Use `docs/project-management/templates/two-week-deliverable-plan.md` as the format. On a second run on the same date, append `## Update <HH:MM> ICT`; do not overwrite earlier entries.

Persist candidate IDs and artifact references in the artifact itself. Existing `.kilo/state/jiraman.json` may record the artifact path in its generic `artifacts` object; do not require a destructive state-schema migration.

## Jira Safety

All recommendation and brainstorming modes are Jira read-only. A candidate ID is not Jira write authorization. Jira changes may occur only through the existing explicit `apply <PMA-ID...>` protocol after complete preflight and read-after-write verification.
