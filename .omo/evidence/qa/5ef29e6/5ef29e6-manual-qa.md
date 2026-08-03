# Manual QA — 5ef29e6 exact-SHA release gate

Commit under test: `5ef29e63cc18be10b1f353584df66281978a0d5a` in `/tmp/jiraman-review-5ef2-qa`. The clone remained clean; no tracked files were edited.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1 | release gate | shell CI/release gate | `./scripts/ci.sh` | PASS — typecheck, 19 tests, validation, secret scan, source verification, clean install, v4 migration, reproducible packages, and TAR/ZIP verification all passed | A1 |
| S2 | clean/no-force/force/MCP | installer + verifier | `install.sh TARGET`; `verify.sh TARGET`; `install.sh TARGET --check`; reinstall; forced reinstall; byte comparison of user MCP sentinel | PASS — clean/check/force/verifier succeeded; no-force refused; one backup created; MCP sentinel unchanged | A2 |
| S3 | migration/invalid lifecycle state | installer upgrade harness | `bash tests/install/run-v4-upgrade.sh` | PASS — v4 migration, spoofed-v5 migration, malformed/schema-invalid rejection, and state integrity/lifecycle rejection passed | A3 |
| S4 | deterministic symlink swap | installer race harness | `bash tests/install/run-clean-install.sh` (synchronized `cp` snapshot, directory swap to outside symlink, then installer continuation) | PASS — unsafe link rejected and outside sentinel unchanged | A4 |
| S5 | hostile umask and state permissions | installer under OS umask | `(umask 000/0600/0700; ./install.sh TARGET)`; `stat` on `.kilo`, `state`, `jiraman.json` | PASS — all masks exit 0; `.kilo` and state directory 700, state file 600 | A5 |
| S6 | exact Ajv diagnostics | compiled contract validator | `node --input-type=module` calling `validateJson()` for both invalid action fixtures | PASS — exact const/format instance and schema paths observed | A6 |
| S7 | create/dependency/complete-selection/lifecycle | contract tests | `npx vitest run tests/contracts/action-contracts-action-preflight-approved-actions-security.test.ts ...` | PASS — 3 files/8 tests; all preflight, dependency ordering, complete-selection, lifecycle, and expanded secret-family checks passed | A7 |
| S8 | proposal routes and checklist adversaries | route/checklist tests + direct detail invocation | `npx vitest run tests/contracts/skills-command-router.test.ts tests/contracts/run-records.test.ts`; direct `parseRoute()`/`checklistViolations()` | PASS — proposal/reject/apply route guards and duplicate/malformed/missing-smoke checklist adversaries matched expected results | A8, A9 |
| S9 | provider token, expanded families, PEM sanitizer/scanner | scanner/sanitizer + sensitive detector | direct Node detector matrix; `scan_package_sensitive.sh`; `sanitize_ci_log.sh`; adversarial multiline/provider assignments | FAIL — baseline 13/13 family matrix passed, but adversarial `AWS_SECRET_ACCESS_KEY=<opaque>` and quoted/newline provider assignments were not detected/redacted; multiline provider value remained in sanitizer output | A10, A15 |
| S10 | reproducible TAR/ZIP | packaging scripts | two `scripts/package.sh --output` runs; `cmp`; `verify_package.sh` for each archive | PASS — byte-identical TAR and ZIP; both package verifiers passed | A11, A12, A13 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| A-S1 | migration overwrite safety | no-force overwrite | Refuse existing managed files without mutation and request `--force` | PASS | A2 |
| A-S2 | MCP preservation | user-owned MCP sentinel | MCP file remains byte-identical through clean and forced installation | PASS | A2 |
| A-S3 | installer security | deterministic symlink swap race | Reject unsafe link and do not write outside target | PASS | A4 |
| A-S4 | state migration | malformed/schema-invalid v5 and wrong lifecycle/integrity fields | Reject before backup/mutation; verifier returns integrity failure | PASS | A3 |
| A-S5 | permissions | umask 000, 0600, 0700 | Install succeeds with usable owner permissions (state dir 700/file 600) | PASS | A5 |
| A-S6 | Ajv contract diagnostics | invalid project/approval/date | Return precise `instancePath`, `keyword`, and `schemaPath` errors | PASS | A6 |
| A-S7 | action safety | unresolved dependency, incomplete approval selection, prohibited lifecycle/replay | Block writes and preserve deterministic dependency order | PASS | A7 |
| A-S8 | route safety | proposal prose, apply extra focus, reject arbitrary prose | Only exact eligible IDs mutate/write; arbitrary prose remains read-only | PASS | A8, A9 |
| A-S9 | release artifact security | provider token, GitHub/npm/Slack/JWT/Google/credential URL, PEM and multiline/provider assignment secrets | Detect all families; scanner rejects; sanitizer removes secret material without leaking canaries | FAIL — `AWS_SECRET_ACCESS_KEY` and quoted multiline provider assignment bypassed detection; unquoted multiline provider value was scanner-rejected but sanitizer left the value visible | A10, A15 |
| A-S10 | reproducibility | repeated TAR/ZIP packaging | Archives are byte-identical and independently verifiable | PASS | A11, A12, A13 |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | command transcript | Full release gate ending `Jiraman release gates: PASS`. | `5ef29e6-full-ci.txt` |
| A2 | command transcript | Custom clean/check/no-force/force/MCP summary with statuses and backup count. | `5ef29e6-install-summary.txt` |
| A3 | command transcript | v4 migration, invalid/malformed state and lifecycle integrity harness. | `5ef29e6-migration-invalid.txt` |
| A4 | command transcript | Clean-install harness including synchronized symlink swap race. | `5ef29e6-install-clean.txt` |
| A5 | command transcript | Umask 000/0600/0700 mode table. | `5ef29e6-umask.txt` |
| A6 | command transcript | Exact Ajv errors for invalid action and invalid-date fixtures. | `5ef29e6-ajv-errors.txt` |
| A7 | test transcript | Action/preflight/refinement contract tests (3 files, 8 tests passed). | `5ef29e6-focused-contracts.txt` |
| A8 | test transcript | Router and release-checklist tests (2 files, 4 tests passed). | `5ef29e6-routes-checklist-tests.txt` |
| A9 | command transcript | Direct route outputs and checklist adversarial violation names. | `5ef29e6-routes-checklist-detail.txt` |
| A10 | command transcript | Secret detector/scanner/sanitizer summary (13 families, no secret values printed). | `5ef29e6-sensitive-summary.txt` |
| A11 | command transcript | TAR package verifier pass. | `5ef29e6-package-tar-verify.txt` |
| A12 | command transcript | ZIP package verifier pass. | `5ef29e6-package-zip-verify.txt` |
| A13 | checksum transcript | SHA-256 equality for both repeated TAR and ZIP outputs. | `5ef29e6-package-hashes.txt` |
| A14 | git-state | Requested SHA and clean worktree status. | `5ef29e6-git-state.txt` |
| A15 | adversarial security transcript | Additional provider/multiline probes; no secret values printed. | `5ef29e6-sensitive-adversarial.txt` |

Decisive QA result: FAIL due to the reproduced provider/multiline credential sanitizer and package-scanner bypass in A15. Other requested scenarios passed.
