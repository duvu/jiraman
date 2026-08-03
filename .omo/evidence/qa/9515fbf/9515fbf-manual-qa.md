# Manual QA — exact-SHA release gate

Commit under test: `9515fbfb1741b89c50495d66d54a2ccdd3385197` in `/tmp/jiraman-review-9515-qa`.
The tracked worktree remained clean; no product files were edited. All scenarios ran to completion.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1 | release gate | npm/CI release surface | `npm ci --ignore-scripts --silent; ./scripts/ci.sh` | PASS — typecheck, 21 tests, validation, secret scan, template verification, clean install, v4 migration, package reproducibility, and TAR/ZIP verification passed | A1 |
| S2 | installer overwrite and preservation | installer + verifier | `install.sh TARGET`; `verify.sh TARGET`; `install.sh TARGET --check`; second no-force install; forced reinstall; MCP `cmp` | PASS — clean/check/verify/force succeeded; no-force refused; backup was created; MCP sentinel stayed byte-identical | A2 |
| S3 | migration and state integrity | migration harness | `bash tests/install/run-v4-upgrade.sh` | PASS — v4, spoofed-v5, malformed/schema-invalid, wrong-map/ID/hash, and lifecycle integrity cases passed | A3 |
| S4 | installer race boundary | synchronized installer race harness | `bash tests/install/run-clean-install.sh` | PASS — direct symlink and synchronized TOCTOU directory swap were rejected without outside-sentinel mutation | A4 |
| S5 | hostile umask permissions | OS umask install matrix | `(umask 000/0600/0700; install.sh TARGET)` plus `stat` on `.kilo`, state directory, and state file | PASS — all masks installed with `.kilo=700`, state directory `700`, state file `600` | A5 |
| S6 | action lifecycle/preflight/proposal routing | focused contract tests | `npx vitest run tests/contracts/action-contracts-action-preflight-approved-actions-security.test.ts tests/contracts/refinement-spec-reconciliation-epic-story-drafts-subtask-decomposition-refinement-action-proposals.test.ts tests/contracts/skills-command-router.test.ts tests/contracts/run-records.test.ts` | PASS — 4 files and 12 tests passed | A6 |
| S7 | proposal/checklist behavior | compiled rule direct invocation | `node --input-type=module` calling `parseRoute`, `proposalBlockers`, `evaluatePreflight`, lifecycle transitions, and `checklistViolations` | PASS — exact action selections mutate only when eligible; proposal blockers and unknown/missing/duplicate/malformed checklist diagnostics matched expectations | A7 |
| S8 | historical validator diagnostics | compiled contract validator | `node --input-type=module` calling `validateJson()` over config/state/Confluence/action/run-record invalid fixtures | PASS — all 10 invalid fixtures rejected with precise instance paths, keywords, schema paths, and messages | A8, A9 |
| S9 | credential detector/package scanner/sanitizer | direct 31-case detector/sanitizer matrix plus package scan | generated normal/provider/token/PEM/YAML/multiline cases; `scripts/scan_package_sensitive.sh`; `sanitizeSensitiveText` | FAIL — baseline 31 cases pass, but required cross-lane probes show scanner-positive records leaking after an unquoted blank boundary and after an even-backslash quote delimiter | A10, A14, A15 |
| S10 | sanitizer wrapper boundaries | CI-log sanitizer | `scripts/sanitize_ci_log.sh RAW OUTPUT` over escaped delimiters, inner escaped quotes, multiple unquoted lines, blank boundaries, EOF, CRLF/LF, adjacent safe records, and multiple credentials | FAIL — ordinary boundary matrix passes, but blank-then-later continuation and even-backslash quote cases leak opaque continuation markers while scanner rejects the same records | A11, A14, A15 |
| S11 | reproducible package outputs | packaging scripts | two absolute `scripts/package.sh --output` runs plus a relative-output run; `cmp`; `sha256sum`; `scripts/verify_package.sh` TAR and ZIP | PASS — absolute and relative TAR/ZIP archives were byte-identical and independently verified | A12 |
| S12 | exact SHA/source immutability | git surface | `git rev-parse HEAD; git status --short --branch` | PASS — exact requested SHA and clean tracked worktree | A13 |
| S13 | terminal PMA group/reproposal documentation | release docs | line-level audit of `docs/command-reference.md` and `docs/manual-smoke-tests.md` for terminalized PMA groups and sibling reproposal wording | FAIL — command reference documents partial approval but omits that named PMA rejection terminalizes its containing PMG and requires a new proposal; manual smoke only says reject a PMA and does not state terminal/reproposal behavior | A16 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-1 | installer boundary | no-force overwrite | Refuse existing managed files without mutation; require `--force` | PASS | A2 |
| ADV-2 | data-preservation | user-owned MCP sentinel | Preserve MCP bytes through clean, check, migration, and force installation | PASS | A2, A3 |
| ADV-3 | installer security | direct symlink and TOCTOU swap | Reject unsafe links and never write to the outside sentinel | PASS | A4 |
| ADV-4 | migration safety | spoofed-v5, malformed, schema-invalid, map/ID/hash/lifecycle tampering | Reject before backup/mutation and retain integrity guarantees | PASS | A3 |
| ADV-5 | permissions | umask `000`, `0600`, `0700` | Installation remains usable and owner-private | PASS | A5 |
| ADV-6 | action safety | partial high-risk approval, dependency/lifecycle/replay, rejected-group reapproval | Block before write; terminal rejected groups cannot reapprove | PASS | A6, A7 |
| ADV-7 | route/checklist safety | prose, extra focus, unknown/missing/duplicate/malformed gates | Only exact eligible IDs mutate; diagnostics identify each violation | PASS | A7 |
| ADV-8 | validator diagnostics | invalid constants, dates, approval IDs/statuses, required/additional fields | Reject with precise Ajv diagnostics | PASS | A8, A9 |
| ADV-9 | release artifact security | provider/generic assignments, GitHub/npm/Slack/JWT/Google/URL/PEM, YAML blocks, CRLF, then blank/even-backslash continuation | Detect and reject all families without leaking values | FAIL — scanner rejected all targeted records, but sanitizer leaked continuation values in blank-boundary and even-backslash cases | A10, A14, A15 |
| ADV-10 | log hygiene | normal/escaped delimiters, inner escaped quotes, multiple unquoted lines, blank boundaries, EOF, CRLF/LF, adjacent safe records, multiple credentials | Redact complete credential continuations while retaining safe boundary records | FAIL — 32/32 targeted even-backslash variants and the blank-then-later continuation leaked opaque markers | A14, A15 |
| ADV-11 | reproducibility | repeated absolute and relative TAR/ZIP builds | Archives and hashes are byte-identical and package manifests verify | PASS | A12 |
| ADV-12 | documentation contract | terminal PMA rejection and sibling continuation | Command reference and manual smoke explicitly state that PMA rejection terminalizes the PMG and requires a new proposal for siblings | FAIL — both audited documents omit the full behavior, despite README/policy/skill text documenting it elsewhere | A16 |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | command transcript | Full CI/release gate ending `Jiraman release gates: PASS`. | `9515fbf-full-ci.txt` |
| A2 | command transcript | Clean/check/no-force/force backup and MCP byte-preservation summary. | `9515fbf-install-summary.txt` |
| A3 | command transcript | v4/spoofed-v5/malformed/integrity migration harness. | `9515fbf-migration-invalid-integrity.txt` |
| A4 | command transcript | Clean-install direct symlink, synchronized race, and built-in checks. | `9515fbf-install-clean-race.txt` |
| A5 | command transcript | Explicit umask mode table for all three masks. | `9515fbf-umask-modes.txt` |
| A6 | test transcript | Action, preflight, lifecycle, refinement, router, and run-record contracts (12 passed). | `9515fbf-action-proposal-routes-tests.txt` |
| A7 | command transcript | Direct routes, proposal blockers, lifecycle outcomes, partial rejection, and checklist diagnostics. | `9515fbf-action-proposal-checklist-detail.txt` |
| A8 | validator transcript | Historical config/state/Confluence/action/run-record invalid fixture diagnostics. | `9515fbf-validator-diagnostics-expanded.txt` |
| A9 | validator transcript | Focused action approval and lifecycle Ajv diagnostics. | `9515fbf-validator-diagnostics.txt` |
| A10 | adversarial security transcript | 31-case detector/sanitizer/package-scan matrix; output contains metadata only, no secret values. | `9515fbf-sanitizer-boundary-matrix.txt` |
| A11 | command transcript | Wrapper sanitizer boundary run with marker-absence and safe-record assertions. | `9515fbf-sanitizer-wrapper.txt` |
| A12 | checksum/verification transcript | Repeated absolute/relative TAR/ZIP hashes, `cmp`, and package verifier passes. | `9515fbf-package-reproducibility.txt` |
| A13 | git-state | Requested SHA and clean tracked worktree. | `9515fbf-git-state.txt` |
| A14 | adversarial security transcript | Blank-line-then-later continuation and exact even-backslash quote probes; scanner-positive leaks recorded without secret values. | `9515fbf-cross-lane-sanitizer-blockers.txt` |
| A15 | adversarial fuzz transcript | 32 targeted even-backslash variants (generic/provider names × quote styles × suffix/no suffix × LF/CRLF): scanner-positive 32/32 and sanitizer leaks 32/32. | `9515fbf-even-backslash-32-matrix.txt` |
| A16 | documentation audit transcript | Exact-SHA line-level command-reference/manual-smoke audit; neither document explicitly states terminal PMA group/reproposal behavior. | `9515fbf-docs-terminal-reproposal-audit.txt` |

Decisive QA result: **FAIL**. Blockers: (1) sanitizer leaks opaque continuation values after an unquoted blank boundary and after even-backslash quote delimiters despite scanner rejection; (2) command-reference and manual-smoke docs omit terminal PMA group/reproposal behavior.
