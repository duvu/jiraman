# v5 Release Checklist

- [ ] <!-- gate:architecture --> Prompt-first architecture and no application runtime boundary reviewed.
- [ ] <!-- gate:schemas --> Config, state, metadata, action, audit, fixture, and run-record schemas pass Ajv.
- [ ] <!-- gate:skills --> Primary agent and every named skill contract validate.
- [ ] <!-- gate:aliases --> Canonical modes, v4 aliases, focus preservation, and exact write routing validate.
- [ ] <!-- gate:migration --> Clean install and v4 migration pass without changing MCP configuration.
- [ ] <!-- gate:fixtures --> Sanitized MCP and workflow fixture coverage is complete.
- [ ] <!-- gate:security --> Scope, injection, approval, stale/replay, hierarchy, four-hour, ownership, symlink, and secret regressions pass.
- [ ] <!-- gate:reproducibility --> Two independent builds have identical manifests and archives.
- [ ] <!-- gate:package-verification --> TAR and ZIP verify and exclude operational state, backups, credentials, development output, and application runtime files.
- [ ] <!-- gate:manual-smoke --> Manual KiloCode read, degraded, proposal, reject, apply, failure, and read-after-write smoke cases pass.
- [ ] <!-- gate:rollback --> Rollback artifact and backed-up state recovery instructions were tested.
