# Jiraman Multi-Project Baseline

> Baseline created before implementing multi-project support. This document records the
> current single-project contract and the release evidence that future changes must not
> silently weaken.

## Baseline identity

| Field | Value |
|---|---|
| Repository | `git@github.com:duvu/jiraman.git` |
| Source snapshot commit | `6b18a69665805dc94549d99ff9ba111af5a2268f` |
| Source snapshot tree | `2891bda4e30d51adbe68a92e31d731e625c0f90a` |
| Source snapshot archive SHA-256 | `a28d6c5cc1be133f361138eecd7388ad14b3e5c0122d09ba8c6ec60bf89fd86d` |
| Branch at capture | `main` |
| Capture time | `2026-08-18T08:59:01+07:00` |
| Package version | `5.0.0` |
| Working tree at capture | clean |

The source snapshot commit is the comparison point for the multi-project work. The
baseline record itself is documentation only; it does not represent multi-project
implementation.

## Current product contract

Jiraman is currently single-project and hard-scoped to Jira project `AIPLATFORM`.
The active installed runtime assumes:

- Jira scope: `AIPLATFORM`.
- Confluence scope: space key `AIPLATFORM`; page roots are configured in the project
  config.
- Jira hierarchy: `Epic -> Story -> Sub-task`.
- `Story` is the delivery-semantic `Goal`.
- Minimum two Goal Stories per Epic.
- Minimum two Sub-tasks per Goal.
- Maximum Sub-task estimate: four hours.
- Default Jira/user-facing language: `vi-VN`.
- MCP server: existing external-user-owned `mcp-atlassian` server.
- Write boundary: exact `apply <PMG/PMA...>` only.
- Writes require all-or-nothing preflight, read-before-write, and read-after-write
  verification.
- Destructive Jira/Confluence operations are denied.

No project resolver, project registry, active-project session binding, or
project-partitioned state exists in this baseline.

## Current authority locations

The `AIPLATFORM` assumption is distributed across runtime content, validators, schemas,
fixtures, and documentation. The main authorities are:

- `template/.kilo/agents/jiraman.md`
- `template/.kilo/policies/jiraman-safety.md`
- `template/.kilo/config/jiraman.json`
- `template/.kilo/config/mcp-atlassian.json`
- `template/.kilo/state/jiraman.json`
- `schemas/config.schema.json`
- `schemas/state.schema.json`
- `schemas/action-group.schema.json`
- `schemas/backlog-draft.schema.json`
- `schemas/confluence-page-metadata.schema.json`
- `schemas/deliverable-plan.schema.json`
- `schemas/subtask-draft.schema.json`
- `src/goal-action-rules.ts`
- `src/security-rules.ts`
- `src/validate.ts`
- `src/workflow-rules.ts`
- `verify.sh`
- Jira and Confluence templates under `template/docs/project-management/templates/`
- Contract fixtures and tests under `tests/`

A pre-documentation scan of source snapshot `6b18a69` found `AIPLATFORM` references in
83 tracked files. This is an inventory signal, not a replacement plan: each occurrence
must be classified as runtime authority, schema/validator logic, fixture, documentation,
or immutable historical evidence before editing.

## Baseline release evidence

The following commands were executed from the repository root at the source snapshot.

### Source contract

```text
./verify.sh --source-tree
Jiraman verification: PASS
```

### Release-equivalent CI

```text
npm run ci
Jiraman release gates: PASS
```

Observed CI results:

- TypeScript typecheck: PASS.
- Main suite: 19 test files, 82 tests passed.
- Goal policy: 9 tests passed.
- Goal contract schemas: 14 tests passed.
- Refinement goals: 11 tests passed.
- Goal action preflight: 10 tests passed.
- Goal/Confluence templates: 13 tests passed.
- Goal runway planning: 14 tests passed.
- Daily/sprint cadence: 9 tests passed.
- Full validation: `VALID all`.
- Secret scan: PASS.
- Clean installation: PASS.
- v4 upgrade: PASS.
- Reproducible package verification: PASS for both tar and zip packages.

## Structural inventory at baseline

| Area | Count |
|---|---:|
| Tracked files | 195 |
| TypeScript files under `src/` | 21 |
| Contract test files | 19 |
| JSON schemas | 14 |
| Installed workflow skill files | 11 |

## Required invariants for the first multi-project change

The first implementation may add project selection, but it must preserve these
baseline invariants:

1. An unspecified project never silently changes the existing `AIPLATFORM` behavior.
2. An unknown project fails closed; it never falls back to another project.
3. Ambiguous context is reported as ambiguous and requires explicit selection before
   any project-scoped operation.
4. Jira keys, JQL, Confluence spaces, page roots, action groups, and state all remain
   bound to one resolved project context.
5. A proposal created under one project cannot be applied under another project or
   profile revision.
6. Remote Jira/Confluence/repository content remains evidence-only and cannot select a
   project or authorize a write.
7. Exact `apply` authorization, MCP ownership, preflight, read-before-write,
   read-after-write, and destructive-operation denial remain unchanged.
8. Existing AIPLATFORM fixtures and workflows continue to pass without special-case
   test weakening.
9. Installation, upgrade, packaging, source verification, secret scanning, and CI
   remain release gates.
10. Project-specific policy cannot weaken the shared global safety policy.

## Known pre-existing review items

These are recorded as baseline risks and are not silently treated as fixed by the
multi-project work:

- `scripts/verify_package.sh` executes archive-controlled scripts before authenticating
  the archive.
- State/action privacy validation does not reject all nested secret or remote-body
  content.
- `verify.sh` accepts managed-file symlinks.
- Installation swaps multiple boundaries without crash-safe transaction recovery.
- Deadline exception approval is not fully bound to trusted approval evidence.
- Security classifier coverage is incomplete for Vietnamese injection text and HTTP URLs.
- TypeScript/schema validation diverges from some installed verifier invariants.
- Invalid timestamps can be classified as current.
- The development dependency chain reports a High `nanoid` advisory via
  `vitest -> vite -> postcss`.

These risks require separate remediation or explicit acceptance. Adding project
profiles must not make them broader or harder to verify.

## Baseline commands for future comparison

Run from the repository root after every multi-project slice:

```bash
git status --short --branch
git rev-parse HEAD
./verify.sh --source-tree
npm run ci
```

For a frozen candidate, additionally compare the candidate against the source snapshot
commit above and inspect the complete diff, package membership, installation/upgrade
behavior, and project-context contract fixtures.
