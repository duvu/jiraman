# Command Reference

The canonical modes are `daily`, `health`, `runway`, `plan next-2-weeks`, `brainstorm`, `refine`, `meeting`, `risks`, `decision`, `status`, `retrospective`, `propose`, `apply`, and `reject`. Empty input is `daily`.

Aliases normalize as follows: `sprint-health` to `health`; `sprint-plan`, `deliverables`, `next-2-weeks`, `next-two-weeks`, and `two-week-deliverables` to `plan next-2-weeks`; `hierarchy` and `triage` to `refine`; `review` and `sprint-review` to `status`.

The longest exact prefix wins and remaining text is preserved as focus. Unknown modes list supported commands and remain read-only. Exact `propose` stores the displayed PMG/PMA envelope locally. Rejecting a PMG rejects every action; rejecting named PMAs changes only those actions but terminalizes their containing PMG. Sibling work must be reproposed under a new group. Only exact `apply <PMG/PMA...>` records approval and can request MCP writes.

For a multi-action high-risk group, `apply` must enumerate every PMA in that group; a single PMA is executable only when the PMG contains one action. Lower-risk groups may be selected by PMG. Partial group approval is never persisted.

`refine` drafts Epic/Goal Story/Sub-task contracts. `runway`, `plan next-2-weeks`, and `brainstorm` count only deadline-bound Ready Goal Stories with at least two valid Sub-tasks and evaluate N+1/N+2 independently. `daily`, `health`, `status`, and sprint review report Goal deadline and DoD evidence; Jira `Done` alone is not accepted completion. `propose`/`apply` block if Goal due date cannot be written and read back through the exposed `mcp-atlassian` schema.
