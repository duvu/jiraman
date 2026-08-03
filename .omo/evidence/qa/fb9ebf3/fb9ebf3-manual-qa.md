# Manual QA — fb9ebf3 exact-SHA release gate

Commit under test: `fb9ebf3e1624bf213ccc41a9fd40d3c507fac57d` in `/tmp/jiraman-review-fb9e-qa`. Tracked worktree remained clean; no product files were edited.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1 | release gate | shell CI/release gate | `npm ci --ignore-scripts --silent`; `./scripts/ci.sh` | PASS — typecheck, 21 tests, validation, secret scan, source verification, clean install, v4 migration, reproducible packaging, and TAR/ZIP verification passed | A1 |
| S2 | package reproducibility and package contract | package scripts | `scripts/package.sh --output <absolute-a>` twice; `scripts/package.sh --output relative` from a separate cwd; `cmp`; `sha256sum`; `scripts/verify_package.sh` for TAR and ZIP | PASS — absolute and relative outputs are byte-identical; both archives verify | A2, A3, A4, A5 |
| S3 | install overwrite/MCP preservation | installer + verifier | `install.sh TARGET`; `verify.sh TARGET`; `install.sh TARGET --check`; second no-force install; forced reinstall; `cmp` MCP/backup | PASS — no-force refused, force created byte-identical backup, MCP sentinel remained unchanged | A6 |
| S4 | migration and state integrity | migration harness | `bash tests/install/run-v4-upgrade.sh` | PASS — v4, spoofed-v5, malformed/schema-invalid, and wrong-map/ID/hash/lifecycle states handled safely | A7 |
| S5 | symlink race and permissions | installer OS-level harness | `bash tests/install/run-clean-install.sh`; installs under umask 000, 0600, 0700 with `stat` | PASS — direct symlink and synchronized TOCTOU race protected; `.kilo`/state modes are safe | A8, A9 |
| S6 | action/preflight/proposal/routing | contract tests + direct compiled rule invocations | `npx vitest run` on action/refinement/router/run-record contracts; direct `parseRoute`, `evaluatePreflight`, `proposalBlockers`, partial-rejection fixture | PASS — 12 focused tests pass; partial PMA rejection terminalizes group, preserves sibling history, blocks reapproval, and gives new-proposal guidance; prose remains read-only | A10, A11 |
| S7 | validator diagnostics and checklist | compiled validator + checklist rules | direct `validateJson()` invalid fixtures; `./verify.sh template`; direct checklist adversarial matrix | PASS — exact Ajv paths/keywords and checklist unknown/missing/duplicate/malformed diagnostics observed | A12, A11 |
| S8 | credential detector/package scanner/sanitizer | direct Node detector, package scanner, CI-log sanitizer | 19-case matrix covering quoted keys, assignment variants, blank/whitespace YAML lines, CRLF, indicators, comments, nesting, multiline values; `scan_package_sensitive.sh`; `sanitize_ci_log.sh` | PASS — all 18 sensitive cases detected/rejected, scanner emitted no secret values, sanitizer removed opaque/canary material while retaining safe diagnostic | A13 |
| S9 | sanitizer continuation safety | CI-log sanitizer targeted edge cases | `sanitize_ci_log.sh` with quoted multiline credential containing an escaped quote before later continuation, and unquoted credential with multiple continuation lines | FAIL — both later continuation markers remained visible after sanitizer returned exit 0 | A15 |
| S10 | terminal PMG rejection policy | action schema/verifier + policy text | direct whole-PMG rejection transform; `validateJson()` and `verify.sh --validate-state-file`; policy line inspection | PASS — policy requires group and every action `rejected`; schema/verifier accept that terminal mutation and payload hash remains stable | A16 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-1 | installer boundary safety | no-force overwrite | Refuse existing managed files without mutation | PASS | A6 |
| ADV-2 | installer boundary safety | direct symlink and TOCTOU directory swap | Reject unsafe link and preserve outside sentinel | PASS | A8 |
| ADV-3 | state migration safety | spoofed-v5, malformed, schema-invalid, wrong map key/approved ID/hash/lifecycle | Reject before mutation; require reapproval for legacy pending actions | PASS | A7 |
| ADV-4 | data-preservation boundary | user-owned MCP sentinel | Preserve bytes through clean, migration, and force install | PASS | A6, A7 |
| ADV-5 | permissions | umask 000/0600/0700 | State remains usable and private (`700` directory, `600` file) | PASS | A9 |
| ADV-6 | action safety | partial high-risk PMA selection; rejected-group reapproval; unresolved/rejected preflight | Block before writes; terminal group cannot reapprove; sibling continuation requires new proposal | PASS | A10, A11 |
| ADV-7 | route/checklist safety | prose/extra focus; unknown, missing, duplicate, malformed checklist gates | Only exact IDs mutate; diagnostics identify the precise checklist violation | PASS | A11 |
| ADV-8 | release artifact security | quoted/provider/generic assignments, block scalar indicators and comments, nesting, CRLF, multiline values | Detector finds every sensitive case; package scan fails without leaking values; sanitizer redacts values | PASS | A13 |
| ADV-9 | reproducibility | repeated absolute and relative TAR/ZIP packaging | Archives and hashes are identical and independently verifiable | PASS | A2, A3, A4, A5 |
| ADV-10 | log hygiene | escaped quote followed by later multiline continuation; unquoted assignment followed by multiple continuation lines | Redact the entire credential continuation, including all later lines, without leaking markers | FAIL — escaped-quote and multi-continuation markers leaked | A15 |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | command transcript | Full CI/release gate ending `Jiraman release gates: PASS`. | `fb9ebf3-full-ci.txt` |
| A2 | checksum transcript | SHA-256 equality for repeated absolute and relative TAR/ZIP outputs. | `fb9ebf3-package-hashes.txt` |
| A3 | command transcript | Absolute/relative package comparison result. | `fb9ebf3-package-relative-absolute.txt` |
| A4 | command transcript | TAR package verification pass. | `fb9ebf3-package-tar-verify.txt` |
| A5 | command transcript | ZIP package verification pass. | `fb9ebf3-package-zip-verify.txt` |
| A6 | command transcript | Clean/check/no-force/force backup and MCP byte-preservation summary. | `fb9ebf3-install-summary.txt` |
| A7 | command transcript | v4/spoofed-v5/malformed/integrity migration harness. | `fb9ebf3-migration-invalid-integrity.txt` |
| A8 | command transcript | Clean-install symlink, synchronized race, and built-in permission harness. | `fb9ebf3-install-clean-race.txt` |
| A9 | command transcript | Explicit umask 000/0600/0700 mode table. | `fb9ebf3-umask-modes.txt` |
| A10 | test transcript | Action, preflight, refinement, router, and run-record contract tests (12 tests). | `fb9ebf3-action-proposal-routes-tests.txt` |
| A11 | command transcript | Direct partial-rejection/reapproval/proposal guidance, route, checklist, and blocker outputs. | `fb9ebf3-action-proposal-checklist-detail.txt` |
| A12 | validator transcript | Exact Ajv diagnostics for all prior invalid action fixtures and template verification. | `fb9ebf3-validator-diagnostics.txt` |
| A13 | adversarial security transcript | 19-case direct detector/package scanner/sanitizer fuzz; no secret values emitted. | `fb9ebf3-credential-fuzz.txt` |
| A14 | git-state | Exact requested SHA and clean tracked worktree. | `fb9ebf3-git-state.txt` |
| A15 | adversarial security transcript | Targeted sanitizer continuation probes; marker-only output shows both leaks. | `fb9ebf3-sanitizer-edge-failures.txt` |
| A16 | command transcript | Terminal PMG rejection policy alignment, schema validity, stable hash, and state verifier pass. | `fb9ebf3-pmg-reject-policy.txt` |

Decisive QA result: **FAIL** due to sanitizer continuation leaks in A15. The release gate and all other requested scenarios passed; this security blocker requires a product fix.
