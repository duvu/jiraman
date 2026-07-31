# Changelog

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
