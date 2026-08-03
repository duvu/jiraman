# Manual QA — commit `7b272b330d6232c627369d31ab6a66899e15184b`

Target: `/tmp/jiraman-review-7b272b330d62-v7`  
Tracked-worktree check: clean (see `git-state.txt`).  
Verdict: **PASS**. All requested scenarios ran against the exact SHA; no product files were changed.

## manualQa

### surfaceEvidence

| Scenario | Criterion | Surface and exact invocation | Verdict | Artifact refs |
|---|---|---|---|---|
| QA-01 | Verification contract | `cd /tmp/jiraman-review-7b272b330d62-v7 && ./verify.sh template` | PASS | A01 |
| QA-02 | Schema validation/contracts | `python scripts/validate_examples.py ...` for config/state/project-snapshot/action-group valid examples; `python scripts/validate_action_group.py examples/action-group.valid.json`; `uv run pytest -q tests/schemas tests/contracts` | PASS | A02 |
| QA-03 | Command router and write boundary | `python scripts/parse_command.py daily`; `refine DLV-20260801-01`; `apply PMA-20260801-01`; aliases `health focus`, `next-two-weeks platform reliability`; empty and imperative prose | PASS | A03 |
| QA-04 | Refinement pipeline | `parse_spec.py`, `reconcile_spec.py`, `draft_backlog.py --level story/subtask`, `propose_backlog_actions.py` + `validate_action_group.py`, and `uv run pytest -q tests/refinement tests/specs` | PASS | A04 |
| QA-05 | Action preflight | `python scripts/preflight_action_group.py ...approved-group.json ...current.json --expect passed`; stale fixture with `--expect blocked` | PASS | A05 |
| QA-06 | Envelope/schema contracts | `uv run pytest -q tests/schemas tests/contracts tests/observability` | PASS | A06 |
| QA-07 | Approval persistence and reapproval/reject | `uv run pytest -vv -q tests/actions/test_apply_workflow.py` | PASS | A07 |
| QA-08 | Coverage gate | `uv run pytest -q tests/analyzers tests/regression/analyzers --cov=analyzers --cov-report=term-missing` | PASS (94.55%, required 80%) | A08 |
| QA-09 | Security regression surface | `uv run pytest -q tests/security tests/regression/security tests/actions/test_apply_workflow.py tests/actions/test_verification.py tests/actions/test_preflight.py` | PASS (26 tests) | A09 |
| QA-10 | Clean installation | `./tests/install/run-clean-install.sh` | PASS | A10 |
| QA-11 | Schema 3 and 4 migration | `./tests/install/run-v4-upgrade.sh` (asserts v3 and v4 migration envelopes and legacy approved => reapproval_required) | PASS | A11 |
| QA-12 | Offline evaluations | `python evals/run.py --suite smoke --offline`; `--suite release --offline`; `--suite adversarial --offline` | PASS | A12 |
| QA-13 | Observability and redaction | `python scripts/summarize_run.py tests/fixtures/observability/run-events.json`; `uv run pytest -vv -q tests/observability` | PASS | A13 |
| QA-14 | Deterministic packages | Run `scripts/package.sh` twice; `cmp` tar/zip outputs; `scripts/verify_package.sh` for both archives | PASS | A14 |
| QA-15 | Full CI/release gate | `./scripts/ci.sh` | PASS (134 tests; release gates PASS; `ci_exit=0`) | A15 |

### adversarialCases

These 11 attack scenarios are exercised by the security/write-boundary suite; each is expected to be rejected or safely redacted before a write.

| Scenario | Criterion | Adversarial class | Expected behavior | Verdict | Artifact refs |
|---|---|---|---|---|---|
| SEC-01 | Security invariants | Cross-project Jira scope | Reject `OTHER-*` and keep executor uncalled | PASS | A09 |
| SEC-02 | Security invariants | Cross-space/page-root Confluence scope | Reject out-of-scope space, page, or parent | PASS | A09 |
| SEC-03 | Security invariants | Prompt injection / fake-tool instruction | Preserve requirements only; remove tool/policy override text | PASS | A09 |
| SEC-04 | Security invariants | Read-to-write escalation | Read-only or imperative prose cannot authorize MCP writes | PASS | A03, A09 |
| SEC-05 | Security invariants | Approval metadata/payload tampering | Immutable approval mismatch blocks before tool call | PASS | A07, A09 |
| SEC-06 | Security invariants | Stale before-state/version | All-or-nothing preflight blocks stale group | PASS | A05, A09 |
| SEC-07 | Security invariants | Replay/durable-claim reuse | Consumed approval is rejected and tool remains untouched | PASS | A07, A09 |
| SEC-08 | Security invariants | Field allowlist/credential write | Disallowed field (including token) is rejected and redacted | PASS | A09 |
| SEC-09 | Security invariants | Invalid hierarchy/untrusted ancestor | Invalid parent or claimed ancestor cannot reach executor | PASS | A09 |
| SEC-10 | Security invariants | Risk/expiry/identity bypass | Risk mismatch, expired action, or wrong approver blocks | PASS | A09 |
| SEC-11 | Security invariants | Verification mismatch / secret leakage | Read-after-write mismatch fails; audit/log output redacts secrets | PASS | A07, A09, A13 |

### artifactRefs

| ID | Kind | Description | Path |
|---|---|---|---|
| A01 | command-output | Template verification | `.omo/evidence/qa/7b272b3/verification-template.txt` |
| A02 | command-output | Schema and contract passes | `.omo/evidence/qa/7b272b3/schema-pass.txt` |
| A03 | command-output | Router parsing and authorization results | `.omo/evidence/qa/7b272b3/router.txt` |
| A04 | command-output | Successful refinement pipeline and 13 tests | `.omo/evidence/qa/7b272b3/refinement-pass.txt` |
| A05 | command-output | Passed and blocked preflight outcomes | `.omo/evidence/qa/7b272b3/preflight.txt` |
| A06 | test-output | Envelope/schema/observability contract tests | `.omo/evidence/qa/7b272b3/preflight-envelopes.txt` |
| A07 | test-output | Approval persistence, reapply rejection, reapproval/reject | `.omo/evidence/qa/7b272b3/approval-persistence-reapproval.txt` |
| A08 | test-output | Analyzer coverage report | `.omo/evidence/qa/7b272b3/coverage.txt` |
| A09 | test-output | Security attacks and write-boundary suite (26 passed) | `.omo/evidence/qa/7b272b3/security-11-attacks.txt` |
| A10 | command-output | Clean install and installed-tree verification | `.omo/evidence/qa/7b272b3/clean-install.txt` |
| A11 | command-output | v4 upgrade plus schema 3/4 migration assertions | `.omo/evidence/qa/7b272b3/migration-schema3-4.txt` |
| A12 | command-output | Smoke, release, and adversarial offline evals | `.omo/evidence/qa/7b272b3/evals.txt` |
| A13 | command-output | Observability summary and redaction tests | `.omo/evidence/qa/7b272b3/observability.txt` |
| A14 | command-output | Byte-identical tar/zip packages and verification | `.omo/evidence/qa/7b272b3/deterministic-packages.txt` |
| A15 | command-output | Full CI: 134 tests, release gates, package checks | `.omo/evidence/qa/7b272b3/full-ci.txt` |
| A16 | git-state | Exact SHA and no tracked edits | `.omo/evidence/qa/7b272b3/git-state.txt` |

