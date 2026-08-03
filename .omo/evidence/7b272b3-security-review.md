# Security Review — 7b272b330d6232c627369d31ab6a66899e15184b

## Verdict

**PASS — no exploitable blocker found.** The change closes the missing persistence
boundary for duplicate action IDs, while preserving the existing immutable approval,
preflight, scope, identity, expiry, risk, replay, and no-tool-call barriers. This
review uses the documented trusted-ledger threat model; direct filesystem modification
of an approval record is out of scope for that model.

`codeQualityStatus: CLEAR`  
`recommendation: APPROVE`  
`blockers: none`

## Scope inspected

- Commit SHA: `7b272b330d6232c627369d31ab6a66899e15184b`
- Changed: `jiraman/actions/ledger.py`, `jiraman/actions/workflow.py`,
  `tests/actions/test_apply_workflow.py`, `tests/security/test_write_boundary.py`
- The new persistence check extracts each action ID and rejects a duplicate before an
  approval snapshot is written (`jiraman/actions/ledger.py:48-70`).
- Approval is still compared byte-for-byte at the canonical-JSON level before
  preflight/tool dispatch (`jiraman/actions/workflow.py:112-140`).

## Attack results

| Attack | Result |
| --- | --- |
| Duplicate high-risk ID at contract validator | Blocked: `ActionContractError` |
| Duplicate high-risk ID at preflight | Blocked: `DUPLICATE_ACTION_ID` |
| Duplicate high-risk ID at approval persistence | Blocked: `LedgerError`; no approval snapshot/directory created |
| Recomputed/malformed approval hashes | Blocked at validator and persistence; no approval snapshot created |
| Unrecorded group | Blocked before preflight/tool dispatch |
| Forged Confluence ancestor/root evidence | Blocked with `CONFLUENCE_SCOPE`; no tool calls |
| Reapproval transition | Rejection from `reapproval_required` works; a fresh approval is persisted only through the normal hash-checked path |
| Expiry, risk class, identity mismatch, out-of-scope payload | Blocked before tool calls (security suite) |
| Replay | Durable claim blocks a second apply before tool calls (security suite) |
| Traversal ID | Regex rejects the ID; no file is created outside the ledger |
| Secret-bearing/instruction-like field | Field allowlist blocks dispatch; conflict/audit sanitization redacts the secret |

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None affecting approval or write-boundary security. A malformed traversal group can
create the empty in-ledger `approvals/` directory before ID validation because
`group_path()` is called after `directory.mkdir()` (`jiraman/actions/ledger.py:64-66`).
It cannot create a file outside the ledger or reach a semantic tool, so this is not an
exploitable traversal and is not a release blocker under the stated model.

## Skill-perspective check

Ran `omo:remove-ai-slops` and `omo:programming` review criteria before assessing test
relevance and maintainability. No violation found: the added list extraction is direct
boundary validation required to reject malformed approval snapshots, not needless
production parsing/normalization or abstraction. The added tests exercise observable
validator/preflight/persistence behavior; they are not deletion-only, tautological,
prompt-based, or implementation-mirroring tests.

## Commands and evidence

All run in `/tmp/jiraman-review-7b272b330d62-v7` at the reviewed SHA.

```text
git show --format=fuller --no-ext-diff --find-renames=0 7b272b330d6232c627369d31ab6a66899e15184b
git diff 7b272b3^ 7b272b3 --check
uv run pytest tests/security tests/actions -q                         # 29 passed
uv run python - <<'PY' ... adversarial attack matrix ... PY           # SECURITY_ATTACK_MATRIX_PASS
uv run pytest -q                                                       # 134 passed
uv run ruff check .                                                    # All checks passed
uv run basedpyright                                                     # 0 errors, 0 warnings, 0 notes
./verify.sh template                                                    # passed
./tests/install/run-clean-install.sh                                   # passed
```

The dedicated matrix asserted all rows above, including no semantic-tool calls on
every rejected apply path and no persisted approval snapshot for duplicate/malformed
hash cases.
