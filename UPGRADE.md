# Upgrade to Jiraman v5

Jiraman v5 moves the primary agent from `.kilo/agent/jiraman.md` to `.kilo/agents/jiraman.md`, replaces v4 YAML/policy extensions with one JSON configuration and named skills, and keeps runtime behavior prompt-first.

```bash
git pull --ff-only
./install.sh /absolute/project/path --force
./verify.sh /absolute/project/path
```

The installer backs up every managed v4 file before replacement. A v4 state file is preserved byte-for-byte as `.kilo/state/jiraman.v4.json`; its `PMA-*`/`PMG-*` identifiers are placed in `migration.reapproval_required_ids`. They cannot execute as v5 approvals and must be reviewed and reproposed. Project-owned report/history files are never overwritten.

Rollback is documented in [docs/rollback.md](docs/rollback.md). The installer does not create or change MCP configuration and does not install Node dependencies in the target project.
