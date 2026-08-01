# Command Reference

The canonical modes are `daily`, `health`, `runway`, `plan next-2-weeks`, `brainstorm`, `refine`, `meeting`, `risks`, `decision`, `status`, `retrospective`, `propose`, `apply`, and `reject`. Empty input is `daily`.

Aliases normalize as follows: `sprint-health` to `health`; `sprint-plan`, `deliverables`, `next-2-weeks`, `next-two-weeks`, and `two-week-deliverables` to `plan next-2-weeks`; `hierarchy` and `triage` to `refine`; `review` and `sprint-review` to `status`.

The longest exact prefix wins and remaining text is preserved as focus. Unknown modes list supported commands and remain read-only. Only exact `apply <PMG/PMA...>` can request MCP writes; exact `reject` changes local state only.
