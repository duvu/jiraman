# Upgrade to Jiraman v3

Version 3 introduces mandatory Epic -> Story -> Sub-task hierarchy, spec-driven Story readiness, complete Sub-task traceability, and a hard four-hour maximum for each Sub-task.

## Upgrade

Update the local checkout, then reinstall the managed files:

```bash
cd /path/to/jiraman
git pull --ff-only
./install.sh /absolute/path/to/project --force
```

The installer creates a timestamped backup before replacing managed files.

Review and preserve any pending action IDs from the old `.kilo/state/jiraman.json` before upgrading. Version 3 uses state schema 3 and resets operational state by default.

The v2 per-item estimate multiplier is removed for Jira Sub-tasks. Version 3 holds contingency at sprint-capacity level so no planned Sub-task exceeds four hours.

After installation, start a new Kilo chat and run:

```text
/jiraman hierarchy
/jiraman runway
```

Expect existing Task, Bug, Spike, orphan Story, incomplete Story specification, and oversized Sub-task records to be reported as refinement or hierarchy findings. Jiraman will propose normalization actions but will not modify Jira until specific action IDs are applied.
