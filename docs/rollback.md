# Rollback

Keep the previous verified release archive and the `.jiraman-backup-<timestamp>/` produced by `--force`. To roll back, stop active apply work, copy the current `.kilo/state/jiraman.json` aside, restore every backed-up managed file to its original path, and reinstall the previously verified package only if a backup is incomplete. Restart KiloCode and run its read-only smoke checks.

Do not execute v5-approved actions in v4. Preserve v5 state for audit; pending actions require review under the restored version. MCP configuration is external and needs no rollback.
