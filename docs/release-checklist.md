# v5 Release Checklist

- [ ] <!-- gate:architecture checks:prompt-first,no-runtime --> Prompt-first architecture and no application runtime boundary reviewed.
- [ ] <!-- gate:schemas checks:config,state,action,run-record --> Config, state, metadata, action, audit, fixture, and run-record schemas pass Ajv.
- [ ] <!-- gate:skills checks:primary-agent,named-skills --> Primary agent and every named skill contract validate.
- [ ] <!-- gate:aliases checks:canonical,v4-aliases,exact-write --> Canonical modes, v4 aliases, focus preservation, and exact write routing validate.
- [ ] <!-- gate:migration checks:clean-install,v4-migration,mcp-preservation --> Clean install and v4 migration pass without changing MCP configuration.
- [ ] <!-- gate:fixtures checks:mcp,workflow,sanitized --> Sanitized MCP and workflow fixture coverage is complete.
- [ ] <!-- gate:security checks:scope,injection,approval,replay,symlink,secrets --> Scope, injection, approval, stale/replay, hierarchy, four-hour, ownership, symlink, and secret regressions pass.
- [ ] <!-- gate:reproducibility checks:manifest,tar,zip --> Two independent builds have identical manifests and TAR/ZIP archives.
- [ ] <!-- gate:package-verification checks:tar,zip,no-state,no-backup,no-runtime --> TAR and ZIP verify and exclude operational state, backups, credentials, development output, and application runtime files.
- [ ] <!-- gate:manual-smoke checks:read,degraded,proposal,reject,apply,failure,read-after-write --> Manual KiloCode read, degraded, proposal, reject, apply, failure, and read-after-write smoke cases pass.
- [ ] <!-- gate:rollback checks:package,managed-files,action-state --> Previous package, managed-file backup, and action-state recovery instructions were tested.
