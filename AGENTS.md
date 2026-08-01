# Repository Guidelines

## Project Structure & Module Organization

Jiraman is a distributable Kilo Code agent, not a compiled application. Treat `template/` as the source of installed content:

- `template/.kilo/agent/jiraman.md` defines agent behavior.
- `template/.kilo/commands/jiraman.md` routes slash commands.
- `template/.kilo/config/` contains YAML and Markdown policy.
- `template/docs/project-management/` contains operational logs and reusable specifications.
- `install.sh` copies managed files into a target project; `verify.sh` checks the installed contract.
- `README.md`, `UPGRADE.md`, and `CHANGELOG.md` describe usage, migration, and releases.

Keep related agent, command, policy, template, and documentation changes synchronized.

## Build, Test, and Development Commands

There is no build step or dependency installation. Run from the repository root:

```bash
./verify.sh template
```

This validates required files, command routing, hierarchy safeguards, JSON state, and YAML policy when PyYAML is available.

Exercise a clean installation without touching a real project:

```bash
target=$(mktemp -d)
./install.sh "$target"
./verify.sh "$target"
rm -rf "$target"
```

Use `./install.sh /absolute/project/path --force` only intentionally; it replaces managed files after creating a timestamped backup.

## Coding Style & Naming Conventions

Shell scripts target Bash, begin with `set -euo pipefail`, quote path variables, and use two-space indentation. Keep Markdown concise, with fenced examples and descriptive headings. Preserve two-space YAML indentation and existing key naming. Use lowercase, hyphenated document names such as `two-week-deliverable-plan.md`; Jira identifiers remain uppercase (`AIPLATFORM-123`, `DLV-YYYYMMDD-NN`).

## Testing Guidelines

`verify.sh` is the repository's test harness. Add focused assertions there when changing an enforced policy or installed-file contract. A change is ready only when direct template verification and a clean temporary installation both exit successfully. Do not test `--force` against a working project.

## Commit & Pull Request Guidelines

Recent history uses short, imperative subjects such as `Add next-two-week deliverable brainstorming`. Follow that style, keep each commit focused, and update the changelog for user-visible behavior. Pull requests should explain the policy or workflow change, identify affected installed files, note upgrade implications, and list verification commands and results. Link the relevant issue; include screenshots only when rendered Kilo behavior materially changes.

## Security & Configuration

Never commit credentials, MCP configuration, or live operational state. The installer deliberately leaves MCP setup untouched, and installed `.kilo/state/` content must remain gitignored.
