# Configuration Reference

`.kilo/config/jiraman.json` is the source-controlled project policy: fixed Jira key, allowed Confluence spaces/page roots, hierarchy, WIP, readiness horizon, action TTL, and state retention. `.kilo/config/command-router.json` records tested command references. `.kilo/config/mcp-atlassian.json` records semantic capabilities and permission profiles without installation-specific tool names.

`.kilo/state/jiraman.json` is gitignored operational state. It stores pending PMG/PMA envelopes, stable DLV candidate references, privacy-safe run records, and migration references. It is never authoritative for remote Jira or Confluence facts.

## Goal Delivery Policy

`delivery.story_semantics` is fixed to `goal`: Jira `Story` is the Goal issue type, not a fourth hierarchy level. `minimum_goal_stories_per_epic` and `minimum_subtasks_per_goal` are both fixed at `2`; `maximum_subtask_hours` remains `4`, with zero also invalid. `required_goal_fields` is exactly `goal_name`, `target_completion_date`, and `definition_of_done`.

`goal_deadline_sources` permits only `sprint-end`, `milestone`, `specification`, or `explicit-user-decision`. Missing or conflicting evidence is `decision required`/`not verified` and blocks Ready and executable action status. The configured contract cannot be lowered by Jira, Confluence, or request content.

`.kilo/config/mcp-atlassian.json` records operation-specific schema expectations for Story parent/summary/due-date/DoD writes, Sub-task parent/original-estimate writes, and read-after-write verification. An exposed create/update/read operation that lacks one unambiguous due-date mapping is a named capability gap, not permission to store only narrative text and claim success.
