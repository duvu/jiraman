# Upgrade to Jiraman v6

Jiraman v6 keeps the prompt-first runtime and exact-write safety boundary while moving active project authority into a validated profile registry and partitioning local state by project/profile fingerprint.

```bash
git pull --ff-only
./install.sh /absolute/project/path --force
./verify.sh /absolute/project/path
```

The installer backs up every managed v4/v5/v6 file before replacement. A v4 state file is preserved byte-for-byte as `.kilo/state/jiraman.v4.json`; a v5 state file is preserved as `.kilo/state/jiraman.v5.json`. Both are migrated into the default `aiplatform` profile, and every migrated PMA/PMG identifier is placed in `migration.reapproval_required_ids`; migrated actions cannot execute as approvals and must be reviewed and reproposed. A valid v6 state is retained and reverified. Project-owned report/history files are never overwritten.

The v6 configuration keeps the former top-level language, Confluence, and delivery values as compatibility projections, but `profiles.<project_id>` is authoritative. The AIPLATFORM profile remains the default. Add another profile only with a unique stable ID, Jira key, aliases, Confluence scope, timezone, language defaults, delivery contract, and positive profile revision. Use exact `projects`, `context`, and `use <project-id>` commands; unknown or ambiguous project context fails closed.

Rollback is documented in [docs/rollback.md](docs/rollback.md). The installer does not create or change MCP configuration and does not install Node dependencies in the target project.
