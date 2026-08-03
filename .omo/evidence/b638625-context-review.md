# Context / release review — b638625cfd79feb5c88efb55cbb539b214f3fa55

Verdict: **FAIL / STOP**. Remote publish remains pending and must not proceed.

## Scope inspected

- Exact checkout: `/tmp/jiraman-review-b638625cfd79-v8`
- `HEAD`: `b638625cfd79feb5c88efb55cbb539b214f3fa55`
- Commit subject: `Enforce full approval snapshot contract`
- Full commit diff and all eight changed files were reviewed.
- Docs, schemas, migration, package manifest/archive, CI, fixtures, installation tests, and the action validator/CLI/ledger/workflow chain were independently inspected.
- `AGENTS.md` has no diff in this commit (`git diff b638625^ b638625 -- AGENTS.md` was empty).

## Findings

### HIGH — an approved group can persist and execute with zero approved actions

`jiraman/actions/contracts.py:110-118` only rejects IDs in `approval.approved_action_ids` that do not occur in the group. It never requires the approved-ID set to equal the set of action IDs when `group.status == "approved"`. The schema also explicitly permits an empty list at `schemas/action-group.schema.json:21`.

This violates both the commit's stated “full approval snapshot” contract and the documented security invariant that “partially approved actions are blocked” (`docs/security-model.md:5`). The CLI calls this shared validator, `ActionLedger.record_approval()` calls it before writing the snapshot, and `apply_group()` only checks snapshot equality. Consequently all three layers accept the same malformed approval snapshot.

Reproduction against the exact checkout used `tests/fixtures/actions/approved-group.json`, replaced `approved_action_ids` with `[]`, recomputed both payload hashes, and used the real ledger and apply APIs:

```
PARTIAL_APPROVAL_PERSISTED True
PARTIAL_APPROVAL_APPLIED applied 4
```

Four actions were executed despite no action being approved. This is a write-boundary/security regression, not merely a schema-format issue. Require exact membership (and matching schema/CLI behavior) and add an observable regression that proves partial/empty approval cannot be persisted or applied.

### CRITICAL

None.

### MEDIUM

None.

### LOW

None.

## Verified areas

- Blank, malformed, and duplicate snapshots are rejected by the ledger without creating approval files:

  ```
  BLANK LedgerError persisted=False
  MALFORMED LedgerError persisted=False
  DUPLICATE LedgerError persisted=False
  ```

- Migration/reapproval lifecycle remains aligned: `scripts/migrate_state.py:33-42` converts legacy approved `PMG-*` items to `reapproval_required`; `tests/install/run-v4-upgrade.sh` passed, as did the existing approve-from-reapproval workflow coverage.
- New blank-approver checks in workflow and contract validation are correctly scoped.
- The production validator is now genuinely shared by the CLI and ledger; packaging includes `jiraman/actions/contracts.py`, schema, docs, and CI workflow. The built archive contained those files.
- Configuration/state schemas, fixtures, release docs, clean install, v4 upgrade, package verification, and CI all pass, but they do not cover the failing partial-approval contract.

## Skill-perspective check

Ran: **yes** — consulted `omo:remove-ai-slops` and `omo:programming` before reviewing test relevance and maintainability (and `omo:git-master` for the exact-commit audit).

- `remove-ai-slops`: no deletion-only, tautological, implementation-constant-mirroring, or requested-removal-only test was added. The new blank/malformed persistence tests are behaviorally meaningful, but they omit the most security-relevant partial-approval case.
- `programming`: no brittle prose/prompt tests, untyped escape hatches, needless abstraction, or unnecessary parsing/normalization was introduced by this commit. The new shared validator is a reasonable seam. The missing exact-set invariant is a correctness gap, not a skill-style violation.

## Commands and evidence

All run in `/tmp/jiraman-review-b638625cfd79-v8` unless noted:

```bash
git rev-parse HEAD
git show --no-ext-diff --format=fuller --stat b638625cfd79feb5c88efb55cbb539b214f3fa55
git show --no-ext-diff --format= --find-renames b638625cfd79feb5c88efb55cbb539b214f3fa55
uv run pytest tests/actions/test_action_schema.py tests/actions/test_apply_workflow.py tests/refinement/test_action_group_mapping.py tests/security/test_write_boundary.py -q
# 19 passed
uv run python scripts/validate_action_group.py tests/fixtures/actions/approved-group.json
# VALID ...
./tests/install/run-v4-upgrade.sh
./tests/install/run-clean-install.sh
./scripts/check_release_docs.sh
./scripts/ci.sh
# 136 passed; package verification PASS for tar.gz and zip
./scripts/package.sh --output /tmp/jiraman-review-package-b638625
tar -tzf /tmp/jiraman-review-package-b638625/jiraman-5.0.0.tar.gz
```

The partial-approval reproduction used the project API rather than a mock: it recomputed `payload_hash`, called `ActionLedger.record_approval`, then `apply_group` with `MockSemanticTool` solely as the normal executor boundary. Its exact results are recorded above.

## Recommendation

`BLOCK` — fix the HIGH finding and add a regression that fails if `approved_action_ids` is empty or otherwise differs from the action-ID set for an approved snapshot; then rerun the action, migration/install, and release gates.
