# Repository Guidelines

## Project Structure & Module Organization

Jiraman is a distributable, prompt-first KiloCode agent rather than an application. Treat `template/` as the source of installed runtime content:

- `template/.kilo/agents/jiraman.md` is the minimal primary orchestrator.
- `template/.kilo/skills/*/SKILL.md` contains named workflow contracts.
- `template/.kilo/commands/`, `config/`, and `policies/` define routing and shared policy.
- `schemas/`, `examples/`, and `tests/fixtures/` are development-time contracts.
- `src/` contains TypeScript validators only; it is not installed as a runtime client.
- `install.sh`, `verify.sh`, and `scripts/` manage installation and release artifacts.

Keep agent, skill, router, policy, schema, fixture, installer, and documentation changes synchronized.

## Build, Test, and Development Commands

```bash
npm ci
npm run typecheck
npm test
npm run validate
npm run ci
```

`npm run ci` is the release-equivalent gate: shell syntax, TypeScript/Vitest/Ajv checks, security scans, clean installation, v4 migration, and reproducible package verification. Use `./verify.sh --source-tree` for the source contract and `./verify.sh /absolute/project/path` for an installation.

## Coding Style & Naming Conventions

Use strict TypeScript without untyped escape hatches. Keep validators deterministic and development-only. Shell scripts use Bash, `set -euo pipefail`, quoted paths, and two-space indentation. Markdown should be concise and reference the canonical shared policy instead of duplicating it. Skill directories use lowercase hyphenated names; Jira identifiers stay uppercase (`AIPLATFORM-123`, `PMG-YYYYMMDD-NN`).

## Testing Guidelines

Use Vitest and Ajv. Prefer executable structural and adversarial checks over assertions against prose or prewritten outcome flags. Add fixtures for every boundary changed, including invalid cases. A release change is ready only when `npm run ci` succeeds.

## Commit & Pull Request Guidelines

Use short imperative subjects. Keep commits focused and update `CHANGELOG.md` for user-visible behavior. Pull requests must explain affected installed paths, migration implications, linked issues, and exact validation results. Include screenshots only when rendered Kilo behavior changes materially.

## Security & Configuration

Never commit credentials, live MCP configuration, or operational state. Jiraman must use the existing external `mcp-atlassian` server directly and must not install a custom Jira/Confluence client. Installed `.kilo/state/` and backups remain gitignored.
