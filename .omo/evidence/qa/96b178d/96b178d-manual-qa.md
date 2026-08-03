# Manual QA — commit `96b178d1d009ecc61c2cae343554905d215cad6c`

Target: `/tmp/jiraman-review-96b178d1d009`  
No product source files were edited. The release gate is **FAIL**: the TOCTOU race scenario mutated the outside sentinel, and one full-gate run accepted the direct symlink case.

## manualQa

### surfaceEvidence

| Scenario | Criterion | Surface and exact invocation | Verdict | Artifact refs |
|---|---|---|---|---|
| QA-01 | Full release gate | `cd /tmp/jiraman-review-96b178d1d009 && ./scripts/ci.sh` | FAIL — exit 1 at clean-install security check (`expected symlink rejection`; `CI_EXIT=1`) | A01 |
| QA-02 | No-force overwrite rejection | `./install.sh <fresh-temp-target>` then `./install.sh <same-target>` | PASS — exit 1 and managed-file conflict message | A02 |
| QA-03 | Force backup | `./install.sh <target>`; alter managed file; `./install.sh <target> --force` | PASS — backup directory and byte-identical managed backup observed | A02 |
| QA-04 | v4 and spoofed-v5 migration | `./tests/install/run-v4-upgrade.sh` | PASS — v4 preserved as `jiraman.v4.json`; reapproval IDs present; spoofed schema-v5 treated as legacy | A03, A04 |
| QA-05 | Malformed/nested/tampered-v5 rejection before mutation | `./tests/install/run-v4-upgrade.sh`; `./verify.sh --validate-state-file tests/install/output/state-integrity/{wrong-map-key,wrong-approved-id,wrong-approval-hash,wrong-payload-hash}.json` | PASS — malformed/invalid states stopped before backup; integrity variants exit 5 | A03, A05 |
| QA-06 | MCP byte preservation | `cmp` before/after install and v4 upgrade | PASS — MCP sentinels byte-identical | A02, A04 |
| QA-07 | Symlink boundary rejection | `./install.sh <symlink-target> --force` (direct rerun) | FAIL overall — direct rerun rejected, but full-gate invocation accepted once and returned success | A01, A02 |
| QA-08 | TOCTOU race protection | `./tests/install/run-clean-install.sh` | FAIL — installer completed while outside race sentinel differed; script exit 1 | A06 |
| QA-09 | Sanitizer canaries | `./scripts/sanitize_ci_log.sh <temp-input> <temp-output>` | PASS — all sensitive canary lines redacted and values absent from output | A07 |
| QA-10 | Reproducible TAR/ZIP and package verification | `./scripts/package.sh --output <tmp/a>` twice; `cmp`; `./scripts/verify_package.sh` for both archives | PASS — TAR/ZIP byte-identical; both package verifications PASS | A08 |
| QA-11 | Exact SHA and worktree | `git -C /tmp/jiraman-review-96b178d1d009 rev-parse HEAD; git ... status --short` | PASS — exact requested SHA; no product-file edits (only pre-existing/untracked evidence metadata) | A09 |

### adversarialCases

| Scenario | Criterion | Adversarial class | Expected behavior | Verdict | Artifact refs |
|---|---|---|---|---|---|
| ADV-01 | Installer boundary safety | Direct managed-path symlink | Reject before backup/mutation and preserve outside sentinel | FAIL — one full-gate invocation accepted; later rerun rejected | A01, A02 |
| ADV-02 | Installer boundary safety | Symlink TOCTOU race | Never write through outside symlink; preserve outside sentinel | FAIL — outside race sentinel changed | A06 |
| ADV-03 | State migration safety | Spoofed schema-v5 legacy state | Treat as v4 migration, require reapproval, do not preserve legacy pending map | PASS | A03, A04 |
| ADV-04 | State migration safety | Malformed/nested/tampered v5 state | Reject before backup or mutation | PASS | A03, A05 |
| ADV-05 | Data-preservation boundary | MCP configuration overwrite | Preserve user MCP bytes exactly | PASS | A02, A04 |
| ADV-06 | Log hygiene | Secret/URL/test canaries in CI log | Redact complete sensitive lines without emitting canary values | PASS | A07 |
| ADV-07 | Packaging integrity | Reproducibility and archive tamper surface | Deterministic archives; manifest/package verification passes | PASS | A08 |

### artifactRefs

| ID | Kind | Description | Path |
|---|---|---|---|
| A01 | command-output | Full release gate and initial symlink failure | `.omo/evidence/qa/96b178d/96b178d-full-ci.txt` |
| A02 | command-output | No-force, force-backup, MCP, and direct symlink rerun | `.omo/evidence/qa/96b178d/96b178d-cli-scenarios.txt` |
| A03 | command-output | v4 upgrade script result | `.omo/evidence/qa/96b178d/96b178d-migration.txt` |
| A04 | command-output | Migration file-preservation and spoofed-v5 assertions | `.omo/evidence/qa/96b178d/96b178d-migration-checks.txt` |
| A05 | command-output | State integrity rejection exit codes | `.omo/evidence/qa/96b178d/96b178d-integrity.txt` |
| A06 | command-output | Clean-install rerun showing TOCTOU sentinel mismatch | `.omo/evidence/qa/96b178d/96b178d-clean-install-second.txt` |
| A07 | command-output | Sanitizer output with canaries absent | `.omo/evidence/qa/96b178d/96b178d-sanitizer.txt` |
| A08 | command-output | Reproducible TAR/ZIP and package verification | `.omo/evidence/qa/96b178d/96b178d-packages.txt` |
| A09 | git-state | Exact SHA and status check | `.omo/evidence/qa/96b178d/96b178d-git-state.txt` |
