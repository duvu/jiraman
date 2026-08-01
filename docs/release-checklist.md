# v5 Release Checklist

- [ ] Prompt-first architecture and no application runtime boundary reviewed.
- [ ] Config, state, Confluence metadata, action, fixture, and run-record schemas pass Ajv.
- [ ] Primary agent, all skills, aliases, capability profiles, and policy references validate.
- [ ] Scope, injection, approval, stale/replay, hierarchy, four-hour, ownership, and secret regressions pass.
- [ ] Clean install and v4 migration pass without changing MCP configuration.
- [ ] Two independent builds have identical manifests and archives.
- [ ] TAR and ZIP contents verify and exclude state, backups, credentials, development output, and application runtime files.
- [ ] Manual KiloCode read, degraded, proposal, reject, apply, failure, and read-after-write smoke cases pass.
- [ ] Rollback artifact and backed-up state recovery instructions were tested.
