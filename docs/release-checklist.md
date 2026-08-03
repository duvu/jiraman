# v5 Release Checklist

- [ ] <!-- gate:architecture checks:prompt-first,no-runtime --> Prompt-first architecture and no application runtime boundary reviewed.
- [ ] <!-- gate:schemas checks:config,state,action,run-record --> Config, Goal backlog/Sub-task, state, metadata, action, audit, fixture, and run-record schemas plus relational invariants pass.
- [ ] <!-- gate:skills checks:primary-agent,named-skills --> Primary agent and every named skill preserve the machine-declared Goal name/deadline/DoD/child contract.
- [ ] <!-- gate:aliases checks:canonical,v4-aliases,exact-write --> Canonical modes, v4 aliases, focus preservation, and exact write routing validate.
- [ ] <!-- gate:migration checks:clean-install,v4-migration,mcp-preservation --> Clean install and v4 migration pass without changing MCP configuration.
- [ ] <!-- gate:fixtures checks:mcp,workflow,sanitized --> Sanitized MCP, Goal hierarchy/action/template, deadline/DoD, and workflow fixture coverage is complete.
- [ ] <!-- gate:security checks:scope,injection,approval,replay,symlink,secrets --> Scope, injection, protected Goal policy, approval, stale/replay, hierarchy/cardinality, four-hour, ownership, symlink, and secret regressions pass.
- [ ] <!-- gate:reproducibility checks:manifest,tar,zip --> Two independent builds have identical manifests and TAR/ZIP archives.
- [ ] <!-- gate:package-verification checks:tar,zip,no-state,no-backup,no-runtime --> TAR and ZIP verify and exclude operational state, backups, credentials, development output, and application runtime files.
- [ ] <!-- gate:manual-smoke checks:read,degraded,proposal,reject,apply,failure,read-after-write --> Manual KiloCode Goal draft/proposal, degraded due-date, Jira/Confluence apply, failure, and read-after-write smoke cases pass in an approved safe scope.
- [ ] <!-- gate:rollback checks:package,managed-files,action-state --> Previous package, managed-file backup, and action-state recovery instructions were tested.

## Release Failure Invariants

`scripts/ci.sh` wraps each release-critical command with a stable identifier: `SHELL_SYNTAX`, `TYPE_SAFETY`, `SECURITY_INVARIANTS`, `CONTRACT_VALIDATION`, `SECRET_OUTPUT`, `SOURCE_CONTRACT`, `CLEAN_INSTALL`, `V4_MIGRATION`, `PACKAGE_BUILD`, `PACKAGE_REPRODUCIBILITY`, or `PACKAGE_INTEGRITY`. A failed command exits non-zero and emits `FAIL invariant=<IDENTIFIER>`.

The CI sanitizer preserves only the recognized identifier, removes all trailing diagnostic content, and redacts unknown invariant-like lines. GitHub Actions publishes the identifier in the job summary and retains only the sanitized failure log.
