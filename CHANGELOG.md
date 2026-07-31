# Changelog

## v4

- Added `deliverables`, `brainstorm`, and `next-2-weeks` modes plus `next-two-weeks` and `two-week-deliverables` aliases for outcome-based planning across Sprint N+1 and Sprint N+2.
- Defined deliverables as planning outcomes mapped to one primary Epic and one or more Stories, never as a fourth Jira hierarchy level.
- Added Ready-backed, refinement-candidate, new-hypothesis, and excluded classifications.
- Added stable `DLV-*` candidate IDs and `refine <DLV-ID>` handoff.
- Added Flow-first, Risk-reduction, and Value-first scenario generation with an evidence-based recommendation and explicit trade-offs.
- Required acceptance signals, rationale, capacity/dependency fit, confidence, assumptions, and hypotheses for proposed deliverables.
- Prevented brainstormed hypotheses from counting toward Ready runway.
- Integrated a compact two-week deliverable outlook into daily reports and deliverable-first selection into sprint planning.
- Added a durable two-week deliverable artifact directory and template.
- Added a backward-compatible deliverable policy extension without requiring a destructive operational-state migration.

## v3

- Enforced exactly three logical delivery levels: `Epic -> Story -> Sub-task`.
- Treated Stories as sprint/runway units and Sub-tasks as the only execution units.
- Excluded unsupported issue types and invalid hierarchy from Ready calculations.
- Added Epic, Story, Sub-task, and hierarchy-policy templates.
- Required stable requirement and acceptance-criteria identifiers.
- Required full Story-to-Sub-task traceability before a Story is Ready.
- Required one specific, verifiable outcome per Sub-task.
- Required Sub-task Original Estimates greater than `0h` and no more than `4h`, including validation.
- Added a four-hour focused-execution timebox: stop, record evidence, and replan remaining scope into sibling Sub-tasks when the timebox expires.
- Removed per-Sub-task risk multiplication; contingency is held at sprint-capacity level.
- Added `hierarchy` and `refine` modes.
- Counted Ready runway at Story level only to prevent parent/child double counting.
- Added hierarchy and specification summaries to operational state and daily reports.
