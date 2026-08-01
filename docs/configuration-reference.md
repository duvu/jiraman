# Configuration Reference

`.kilo/config/jiraman.json` is the source-controlled project policy: fixed Jira key, allowed Confluence spaces/page roots, hierarchy, WIP, readiness horizon, action TTL, and state retention. `.kilo/config/command-router.json` records tested command references. `.kilo/config/mcp-atlassian.json` records semantic capabilities and permission profiles without installation-specific tool names.

`.kilo/state/jiraman.json` is gitignored operational state. It stores pending PMG/PMA envelopes, stable DLV candidate references, privacy-safe run records, and migration references. It is never authoritative for remote Jira or Confluence facts.
