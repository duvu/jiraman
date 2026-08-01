# Troubleshooting

- Missing or ambiguous MCP capability: inspect exposed `mcp-atlassian` descriptions/schema and Kilo permissions; do not rename or configure tools through Jiraman.
- `not verified` sprint facts: enable the relevant read capability or provide bounded evidence; do not infer dates/history.
- Install conflict: rerun with `--force` only after reviewing the complete conflict list and backup location.
- Migrated pending action: inspect `.kilo/state/jiraman.v4.json`, then repropose; legacy approval is intentionally invalid.
- Stale action: rerun the source workflow and approve a new ID after current target evidence is read.
- Verification failure: stop dependent work, inspect expected/actual non-secret fields, and follow rollback guidance.
