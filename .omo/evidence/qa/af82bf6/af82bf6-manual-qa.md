# Manual QA — af82bf6 exact-SHA release gate

Commit under test: `af82bf6271ac28c8adb172aea8ed9f9b1ffb52ab` in `/tmp/jiraman-review-af82-qa`.
The first decisive adversarial result was a hostile-umask installer failure; per instruction, execution stopped at that point. No source files were edited.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| AF82-S1 | release gate / full CI | shell release gate | `./scripts/ci.sh` | PASS | A1 |
| AF82-S2 | migration: clean-install, MCP preservation, symlink safety | installer test harness | `bash tests/install/run-clean-install.sh` | PASS | A2 |
| AF82-S3 | migration: v4 migration, invalid-state rejection, state integrity | installer test harness | `bash tests/install/run-v4-upgrade.sh` | PASS | A3 |
| AF82-S4 | installer clean/no-force/force/MCP preservation | `install.sh TARGET`; `verify.sh TARGET`; reinstall without `--force`; reinstall with `--force`; byte comparisons of pre-existing MCP files | PASS | A4, A5, A6 |
| AF82-S5 | hostile umask 0700/0600 | `(umask 0700; install.sh TARGET)` and `(umask 0600; install.sh TARGET)` | FAIL — both exit 1 before installation (`mkdir .../new: Permission denied`) | A7, A8, A9 |
| AF82-S6 | exact SHA / source immutability | `git rev-parse HEAD; git status --short` in `/tmp/jiraman-review-af82-qa` | PASS — requested SHA; no source edits | A10 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| AF82-A1 | migration / overwrite safety | no-force overwrite | Existing managed files are refused without mutation and request `--force`. | PASS | A4, A5 |
| AF82-A2 | migration / MCP preservation | user-owned MCP sentinel | Existing MCP files remain byte-identical through clean and forced install. | PASS | A4, A6 |
| AF82-A3 | security / symlink | deterministic snapshot/symlink swap race | Installer rejects unsafe links and does not write outside target. | PASS | A2 |
| AF82-A4 | migration / invalid state | malformed or schema-invalid v5 state | Installer rejects before backup/mutation; migration fixtures retain integrity. | PASS | A3 |
| AF82-A5 | security / permissions | hostile umask 0700 and 0600 | Installation succeeds and enforces usable owner permissions (state dir 700, state file 600). | FAIL — installer cannot create staged tree under either umask. | A7, A8, A9 |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | command transcript | Full `scripts/ci.sh` release gate; RC=0, 18 tests pass, package verification pass, reproducibility pass. | `af82bf6-full-ci.txt` |
| A2 | command transcript | Clean-install harness including no-force conflict, MCP preservation, symlink swap race, and permission baseline. | `af82bf6-install-clean.txt` |
| A3 | command transcript | v4 upgrade, spoofed-v5 migration, invalid/malformed state rejection, and integrity checks. | `af82bf6-migration-invalid.txt` |
| A4 | command transcript | Custom clean/no-force/force/MCP scenario summary (first=0, verify=0, no-force=1 expected, force=0, MCP comparisons=0, backup present). | `af82bf6-install-custom-summary.txt` |
| A5 | command transcript | Non-force refusal output. | `af82bf6-install-nonforce.txt` |
| A6 | command transcript | Forced-install output and backup creation. | `af82bf6-install-force.txt` |
| A7 | command transcript | `umask 0700` installer error. | `af82bf6-umask-0700.txt` |
| A8 | command transcript | `umask 0600` installer error. | `af82bf6-umask-0600.txt` |
| A9 | analysis note | Consolidated hostile-umask failure and blocker. | `af82bf6-umask-hostile-summary.txt` |
| A10 | git-state | Exact requested SHA and clean source worktree status. | `af82bf6-git-state.txt` |

## Halt condition

Requested proposal/checklist adversaries, expanded secret-family + multiline PEM sanitizer/package scans, and independent TAR/ZIP verification were not run after AF82-S5 became a decisive FAIL. They must be rerun after the installer permission defect is fixed.
