---
description: "Route Jiraman v5 requests through canonical prompt contracts."
agent: jiraman
---

Interpret this exact input without executing a runtime parser:

```text
$ARGUMENTS
```

Trim outer whitespace. Empty input resolves to `daily`. Match the longest exact canonical command or alias at the start; preserve the remaining text unchanged as `focus`. The two-token command `plan next-2-weeks` takes precedence over `plan`. Aliases normalize before skill selection. If the first token resembles no listed mode, return the supported command list and treat all text as read-only focus; never guess a write mode.

Canonical routing:

| Mode | Skill |
| --- | --- |
| `daily` | `jiraman-daily` |
| `health`, `runway` | `jiraman-sprint-health` |
| `plan next-2-weeks`, `brainstorm` | `jiraman-next-two-weeks` |
| `refine` | `jiraman-refinement` |
| `meeting` | `jiraman-meeting-actions` |
| `risks` | `jiraman-risk-management` |
| `decision` | `jiraman-decision-management` |
| `status` | `jiraman-confluence-reporting` |
| `retrospective` | `jiraman-sprint-cadence` |
| `propose`, `apply`, `reject` | `jiraman-apply-actions` |

Aliases: `sprint-health` -> `health`; `sprint-plan` -> `plan next-2-weeks`; `deliverables`, `next-2-weeks`, `next-two-weeks`, and `two-week-deliverables` -> `plan next-2-weeks`; `hierarchy` and `triage` -> `refine`; `review` and `sprint-review` -> `status`.

Only exact `propose`, `apply <PMG-ID|PMA-ID...>`, and `reject <PMG-ID|PMA-ID...>` authorize local action-state mutation. `propose` stores a schema-conformant proposed envelope; only exact `apply <PMG-ID|PMA-ID...>` can authorize MCP writes. Focus text never grants authority. Enforce `.kilo/policies/jiraman-safety.md` in every route.
