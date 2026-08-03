# Fix Goal Contract Review Blockers

## TL;DR
> Summary:      Refactor the saturated validator first, then close all first-wave Goal-contract gaps with red-first structural tests and deterministic validators. Finish by synchronizing the installed prompt surface and release gates, without adding runtime clients or changing Jira/Confluence ownership.
> Deliverables:
> - Exact bidirectional REQ/AC-to-Sub-task traceability and backlog-to-package ID matching.
> - Fail-closed Jira Goal create/update semantics using authoritative update state and valid hierarchy-write counting.
> - Release-blocking, index-driven Goal metadata validation for installed skills and Confluence templates.
> - Ready-backed schema/runtime evidence requirements and paraphrase-resistant hostile-content checks.
> - A smaller `src/validate.ts`, shared date validation, synchronized fixtures/docs/policy/skills, and clean release evidence.
> Effort:       Large
> Risk:         High - the changes harden shared schema composition and the pre-write boundary, where a false positive can block valid planning and a false negative can authorize invalid Goal work.

## Scope
### Must have
- Extract `FIXTURE_DOMAINS` and `validateFixtures` from `src/validate.ts` before any task adds validator logic; keep `src/validate.ts` below 250 pure LOC throughout.
- Make every Sub-task package traceability map exactly match both directions of every declared REQ/AC relation: map keys equal declared IDs, and each map value equals the exact set of Sub-task refs declaring that ID.
- Make `goalPackageSetViolations` compare each backlog Goal Story's REQ/AC ID sets with the matching package traceability keys, in addition to the existing one-package and Goal-field checks.
- Make Jira `issue.create`/`issue.update` Goal validation fail closed on missing, unsupported, or falsified issue types; use `before_state` as the authoritative type/project source for updates and validate the effective post-update state.
- Reject due-date-only and cross-project Goal-write evasions, and count only schema-valid Jira hierarchy create actions toward Epic/Goal child cardinality.
- Replace the hard-coded, non-consumed Goal marker test with index-driven structural validation that is called by `validateSkills` and `validateConfluenceTemplates`, and therefore by `npm run ci` and packaged-source validation.
- Require Ready-backed Goal candidates to carry verified deadline source/reference, canonical specification, nonempty REQ/AC, concrete traceability maps, and all existing readiness/capacity/dependency/parent/DoD/Sub-task fields in both JSON Schema and `candidateCanCommit`.
- Detect paraphrased attempts to weaken child cardinality, the four-hour limit, Goal DoD, deadline provenance, tool selection, project scope, or write approval while preserving legitimate REQ/AC IDs.
- Reuse the canonical `validDate` implementation from `src/contracts.ts`; do not keep private date validators in Goal modules.
- Add or mutate tests first for every behavior change, run them to prove red, then implement until green. Preserve Given/When/Then test structure.
- Synchronize installed policy/skill language, release checklist tokens, fixtures, README/architecture/security/manual QA documentation, and `CHANGELOG.md` only where the hardened behavior changes the public contract.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not add a custom Jira/Confluence client, change MCP configuration, call live Atlassian tools, or perform any remote write.
- Do not weaken `AIPLATFORM`, `Story`-as-Goal, two-Goal/two-Sub-task, `(0h, 4h]`, verified-deadline, approval, or read-after-write invariants.
- Do not accept a boolean such as `traceability_complete` as a substitute for concrete traceability maps; retain the existing field for compatibility but require both for Ready-backed commitment.
- Do not validate update issue type or project from mutable `desired_state`; `before_state` is authoritative and desired type/project may only agree or be absent.
- Do not count Confluence actions, Jira comments/links/transitions, invalid-project actions, unsupported issue types, or field-invalid Story/Sub-task creates toward hierarchy cardinality.
- Do not test natural-language prompt sentences. Tests may assert structured frontmatter/index tokens only because the release validator consumes them, and may exercise hostile natural language only as input to `inspectUntrustedContent`.
- Do not introduce `any`, type assertions, non-null assertions, ignored diagnostics, mutable exports, enums, or one-use abstraction wrappers.
- Do not modify unrelated untracked paths (`.coverage`, `.serena/`, `evals/`, `jiraman/`, Python caches, or legacy Python test trees). Execute in a task-owned worktree and stage only files named by the current task.
- Do not expand configuration semantics merely to mirror prose; the existing delivery hierarchy, deadline-source, cardinality, and maximum-hour fields remain canonical unless a failing executable contract proves otherwise.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD with Vitest/Ajv contract tests, Bash install/package checks, and `tsc --noEmit` diagnostics fallback because no LSP is installed.
- QA policy: every task has agent-executed scenarios. For Tasks 3-8, add the named regression first, run the exact targeted command, require a nonzero/red result for the intended assertion, capture it, then change production/schema/template code and rerun green. Tasks 1-2 are behavior-preserving refactors: capture the green baseline before the edit and require byte-for-byte equivalent command outcomes after it.
- Evidence: `<attemptDir>/task-<N>-<slug>.<ext>` — under ulw-loop, `<attemptDir>` is the `currentAttemptDir` from `omo ulw-loop status --json` (`.omo/evidence/ulw/<session>/<goalId>/a<attempt>`); outside ulw-loop use `.omo/evidence/`
- Evidence bootstrap: `attemptDir="$(omo ulw-loop status --json 2>/dev/null | jq -r '.currentAttemptDir // empty')"; if [[ -z "$attemptDir" ]]; then attemptDir=.omo/evidence; fi; mkdir -p "$attemptDir"`.
- Red-test rule: if a new regression test passes before its implementation change, stop; the test does not prove the blocker and must be corrected before continuing.
- Type/quality gate after each TypeScript task: `npm run typecheck` plus `bun run /home/beou/.codex/plugins/cache/sisyphuslabs/omo/4.19.3/skills/programming/scripts/typescript/check-no-excuse-rules.ts <changed-ts-files>`.
- Size gate after each TypeScript task: `for path in <changed-ts-files>; do count=$(awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|#|--)/' "$path" | wc -l); test "$count" -le 250 || { echo "$path:$count"; exit 1; }; done`.
- Checkpoint/rollback policy: begin each task from a clean tracked checkpoint (`git diff --exit-code && git diff --cached --exit-code`; unrelated untracked files stay untouched), commit only after targeted green checks, and record the commit SHA with `git rev-parse HEAD`. Before commit, roll back only the task's listed tracked files with `git restore --source=<checkpoint-sha> -- <listed-paths>` after confirming they had no pre-existing edits; remove a task-created file only after `git status --short -- <exact-file>` proves it is untracked and task-owned. After commit, use `git revert --no-edit <task-commit-sha>` for a recoverable rollback. Never continue from a red checkpoint.

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies; separate file ownership):
- Task 1: extract fixture-domain validation (`src/validate.ts`, new `src/fixture-validation.ts`).
- Task 2: reuse canonical date validation (`src/goal-rules.ts`, `src/goal-action-rules.ts`).
- Task 6: harden Ready-backed candidate schema/runtime (`schemas/deliverable-plan.schema.json`, `src/workflow-rules.ts`, its fixture/test).
- Task 7: harden hostile-content paraphrase detection (`src/security-rules.ts`, its fixture/test).

Wave 2 (after Wave 1; three disjoint ownership lanes):
- Task 3: depends [2] - exact draft/package traceability (`src/goal-rules.ts` lane).
- Task 4: depends [2] - authoritative Jira Goal writes (`src/goal-action-rules.ts` lane).
- Task 5: depends [1] - installed structural Goal metadata validation (`src/validate.ts` plus new metadata module/indexes).

Wave 3 (final implementation wave):
- Task 8: depends [3, 4, 5, 6, 7] - synchronize installed contracts, release gates, docs, and changelog after behavior is stable.

Critical path: Task 2 -> Task 4 -> Task 8 -> F1/F2/F3/F4

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1 | none | 5 | 2, 6, 7 |
| 2 | none | 3, 4 | 1, 6, 7 |
| 3 | 2 | 8 | 4, 5 |
| 4 | 2 | 8 | 3, 5 |
| 5 | 1 | 8 | 3, 4 |
| 6 | none | 8 | 1, 2, 7 |
| 7 | none | 8 | 1, 2, 6 |
| 8 | 3, 4, 5, 6, 7 | F1-F4 | none |

### Team Staffing Recommendation
```json
{
  "total_atomic_steps": 8,
  "file_independent_steps": 4,
  "cross_file_dependent_steps": 4,
  "per_step_assignment": [
    {"step_id": 1, "assigned_to": "quick", "blockedBy": [], "rationale": "Mechanical responsibility extraction with unchanged CLI behavior and exact file ownership."},
    {"step_id": 2, "assigned_to": "quick", "blockedBy": [], "rationale": "Mechanical removal of duplicate validators and import reuse, guarded by existing invalid-date tests."},
    {"step_id": 3, "assigned_to": "unspecified-low", "blockedBy": [2], "rationale": "Set-equality traceability logic and deterministic cross-document violations require reasoning."},
    {"step_id": 4, "assigned_to": "unspecified-low", "blockedBy": [2], "rationale": "Security-sensitive update authority, effective-state construction, and hierarchy counting require reasoning."},
    {"step_id": 5, "assigned_to": "unspecified-low", "blockedBy": [1], "rationale": "Index-driven structural metadata validation spans installed indexes, Markdown frontmatter, and release CLI routing."},
    {"step_id": 6, "assigned_to": "unspecified-low", "blockedBy": [], "rationale": "Conditional JSON Schema and runtime traceability must remain semantically equivalent."},
    {"step_id": 7, "assigned_to": "unspecified-low", "blockedBy": [], "rationale": "Deterministic paraphrase categories must improve recall without turning benign evidence into false positives."},
    {"step_id": 8, "assigned_to": "unspecified-low", "blockedBy": [3, 4, 5, 6, 7], "rationale": "Cross-surface synchronization and release-token changes must reflect the final implemented contracts exactly."}
  ],
  "dispatch_path_recommendation": "team",
  "rationale": "Four first-wave steps have disjoint owned files and no blockers, meeting the team threshold. Dispatch Wave 1 in parallel, then dispatch the three Wave-2 lanes only after their prerequisite commits; keep Task 8 single-owner to avoid conflicting prompt/doc/release edits. Every worker must use the task-owned worktree, must not revert another worker's changes, and must rebase or adapt to completed prerequisite commits before editing shared files."
}
```

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Extract fixture-domain validation before validator growth

  What to do: Record baseline results for `validate:subtask-drafts`, `validate:deliverable-fixtures`, and unknown-domain rejection. Create `src/fixture-validation.ts` owning and exporting `FIXTURE_DOMAINS` and `validateFixtures`, preserving the current insertion order, nested-schema checks, negative fixture checks, deterministic error messages, and `goalPackageFixtureViolations` call. Replace the definitions in `src/validate.ts` with imports and keep both `run()` and the `all` loop behavior unchanged. Measure pure LOC immediately after extraction.
  Must NOT do: Do not add new validation behavior, rename CLI domains, reorder fixture traversal, or touch feature rules/tests in this checkpoint.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [5] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/validate.ts:27` - current `FIXTURE_DOMAINS` declaration to move verbatim.
  - Pattern:  `src/validate.ts:155` - current `validateFixtures` implementation and nested/negative checks to move verbatim.
  - API/Type: `src/contracts.ts:71` - typed JSON/invariant helpers used by fixture validation.
  - Test:     `package.json:14` - private validator CLI scripts route through `dist/src/validate.js` and must remain unchanged.
  - Test:     `src/validate.ts:240` - CLI dispatch and `all` traversal that must import the extracted API.
  - External: none - this is an internal responsibility split.

  Acceptance criteria (agent-executable only):
  - [ ] Before editing, `npm run validate:subtask-drafts && npm run validate:deliverable-fixtures` exits 0 and the output is captured; after editing, the same command exits 0 with the same `VALID <domain>` lines.
  - [ ] `npm run typecheck` exits 0 and `npm test -- --run tests/contracts/goal-contract-boundaries.test.ts tests/contracts/two-week-scenarios-two-week-recommendation-sprint-cadence.test.ts` passes.
  - [ ] `test "$(awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|#|--)/' src/validate.ts | wc -l)" -le 200` succeeds, leaving headroom for Task 5 and never exceeding 250.
  - [ ] The no-excuse audit passes for `src/validate.ts src/fixture-validation.ts`.
  - [ ] Checkpoint/rollback: commit only the two owned files; if parity fails, restore `src/validate.ts` to the pre-task SHA and delete only the untracked `src/fixture-validation.ts` after ownership confirmation.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: extracted validators preserve valid-domain CLI behavior
    Tool:     bash
    Steps:    Run `npm run validate:subtask-drafts && npm run validate:deliverable-fixtures | tee "$attemptDir/task-1-fixture-extraction.txt"`.
    Expected: Both commands exit 0 and emit `VALID subtask-drafts` / `VALID deliverable-fixtures`.
    Evidence: <attemptDir>/task-1-fixture-extraction.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: unknown fixture domains still fail closed
    Tool:     bash
    Steps:    Run `npm run build --silent; if node dist/src/validate.js unknown-domain >"$attemptDir/task-1-fixture-extraction-error.txt" 2>&1; then exit 1; fi; rg -n 'unknown fixture domain: unknown-domain' "$attemptDir/task-1-fixture-extraction-error.txt"`.
    Expected: The CLI exits nonzero and the captured error contains exactly `unknown fixture domain: unknown-domain`.
    Evidence: <attemptDir>/task-1-fixture-extraction-error.txt
  ```

  Commit: YES | Message: `refactor(validation): extract fixture domain validation` | Files: [src/fixture-validation.ts, src/validate.ts]

- [ ] 2. Reuse the canonical strict date validator

  What to do: Capture the existing malformed-date test baseline. Import `validDate` from `src/contracts.ts` into `src/goal-rules.ts` and `src/goal-action-rules.ts`; remove both private implementations and narrow strings before calling the shared function. Preserve all current error keywords/messages. Add a Goal-action malformed calendar-date assertion only if existing coverage does not exercise that call site.
  Must NOT do: Do not move `validDate`, duplicate its regex/calendar logic elsewhere, relax TypeScript narrowing, or change schemas in this checkpoint.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [3, 4] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - API/Type: `src/contracts.ts:29` - canonical calendar-valid `YYYY-MM-DD` implementation.
  - Pattern:  `src/goal-rules.ts:19` - duplicate private date validator to remove.
  - Pattern:  `src/goal-action-rules.ts:23` - second duplicate private date validator to remove.
  - Test:     `tests/contracts/goal-contract-boundaries.test.ts:33` - missing and impossible-date schema boundary cases.
  - Test:     `tests/contracts/goal-hierarchy-contracts.test.ts:123` - Jira Goal action-group contract fixture to extend only if needed.
  - External: none - canonical behavior already exists in repository source.

  Acceptance criteria (agent-executable only):
  - [ ] `rg -n '^function validDate' src/goal-rules.ts src/goal-action-rules.ts` returns no matches, while `rg -n 'validDate' src/contracts.ts src/goal-rules.ts src/goal-action-rules.ts` shows both Goal modules consuming the shared export.
  - [ ] `npm test -- --run tests/contracts/goal-contract-boundaries.test.ts tests/contracts/goal-hierarchy-contracts.test.ts` passes, including rejection of `2026-02-30`.
  - [ ] `npm run typecheck` and the no-excuse audit pass for both changed modules; each remains at or below 250 pure LOC.
  - [ ] Checkpoint/rollback: one behavior-preserving commit; revert that commit if either Goal module's prior date cases change result.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: valid Goal dates remain accepted through the shared validator
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/goal-hierarchy-contracts.test.ts -t 'Jira Goal action groups reject missing fields and incomplete decomposition' | tee "$attemptDir/task-2-shared-date.txt"`.
    Expected: The complete action group remains valid and the targeted test passes.
    Evidence: <attemptDir>/task-2-shared-date.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: impossible calendar dates remain rejected
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/goal-contract-boundaries.test.ts -t 'every adversarial fixture fails at its named structural boundary' | tee "$attemptDir/task-2-shared-date-error.txt"`.
    Expected: The `malformed-deadline` case rejects `2026-02-30` and the test exits 0.
    Evidence: <attemptDir>/task-2-shared-date-error.txt
  ```

  Commit: YES | Message: `refactor(contracts): reuse canonical date validation` | Files: [src/goal-rules.ts, src/goal-action-rules.ts, tests/contracts/goal-hierarchy-contracts.test.ts]

- [ ] 3. Enforce exact bidirectional draft and package traceability

  What to do: First add red cases to `goal-contract-boundaries.test.ts`: (a) a Sub-task declares an ID but is omitted from that ID's map value, (b) a map value includes a valid Sub-task ref that does not declare that ID, (c) a backlog Story REQ ID is absent/extra in the matching package map, and (d) the equivalent AC mismatch. Require deterministic keywords/violation strings. Then refactor `subtaskErrors` to build the exact `ID -> declaring Sub-task ref set` relation per field and compare keys and ref sets in both directions. Extend `goalPackageSetViolations` to compare each matched Story's REQ/AC sets to the package traceability keys, emitting stable `<story-ref>:requirements-traceability-mismatch` and `<story-ref>:acceptance-criteria-traceability-mismatch` violations. Keep Goal DoD mapping behavior intact.
  Must NOT do: Do not accept key-only coverage, “at least one Sub-task” coverage, `traceability_complete`, array order, or JSON string equality as proof of relation equality. Do not change the valid fixture's intended relations unless it is internally inconsistent.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [8] | Blocked by: [2]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/goal-rules.ts:43` - current declared-ID collection loses the declaring Sub-task relation.
  - Pattern:  `src/goal-rules.ts:68` - current key coverage and resolved-ref checks that allow relation omissions/surplus refs.
  - API/Type: `src/goal-rules.ts:130` - package-set validator currently compares package counts and three Goal fields only.
  - API/Type: `src/contracts.ts:215` - `validateJson` composes Goal semantic errors after Ajv.
  - Test:     `tests/contracts/goal-contract-boundaries.test.ts:8` - mutation-based Given/When/Then boundary test pattern.
  - Test:     `tests/contracts/goal-contract-boundaries.test.ts:87` - valid package-set release invariant.
  - Test:     `tests/fixtures/drafts/backlog.json` - authoritative backlog Goal REQ/AC IDs.
  - Test:     `tests/fixtures/drafts/subtasks.json` and `tests/fixtures/drafts/subtasks.story-2.json` - valid package relations.
  - External: none - contract is repository-defined.

  Acceptance criteria (agent-executable only):
  - [ ] Before production edits, the new four mismatch assertions fail under `npm test -- --run tests/contracts/goal-contract-boundaries.test.ts`; after implementation the file passes.
  - [ ] A map with correct keys but an omitted declaring Sub-task produces semantic keyword `exactTraceability`; a map with a surplus non-declaring Sub-task ref produces the same keyword at the affected ID path.
  - [ ] `goalPackageSetViolations` returns the exact stable Story-prefixed REQ/AC mismatch strings for the two backlog/package mutation cases and returns `[]` for repository fixtures.
  - [ ] `npm run validate:backlog-drafts && npm run validate:subtask-drafts` exits 0, proving schema and fixture-set integration.
  - [ ] `npm run typecheck`, no-excuse audit, and pure-LOC checks pass for `src/goal-rules.ts`; if it would exceed 250 pure LOC, extract a two-caller traceability relation module rather than adding a size waiver.
  - [ ] Checkpoint/rollback: stage only `src/goal-rules.ts` and the boundary test; revert the task commit if either valid package fixture gains a violation.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: complete backlog and two package fixtures match exactly
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/goal-contract-boundaries.test.ts -t 'every Goal Story has exactly one matching valid Sub-task package' | tee "$attemptDir/task-3-exact-traceability.txt"` followed by `npm run validate:subtask-drafts`.
    Expected: Both commands exit 0 and the package-set violation list is empty.
    Evidence: <attemptDir>/task-3-exact-traceability.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: correct keys with wrong Sub-task relations are rejected
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/goal-contract-boundaries.test.ts -t 'rejects omitted and surplus Sub-task traceability relations' | tee "$attemptDir/task-3-exact-traceability-error.txt"`.
    Expected: Both in-memory adversarial mutations are invalid and expose `exactTraceability`; the test exits 0.
    Evidence: <attemptDir>/task-3-exact-traceability-error.txt
  ```

  Commit: YES | Message: `fix(traceability): enforce exact goal package coverage` | Files: [src/goal-rules.ts, tests/contracts/goal-contract-boundaries.test.ts]

- [ ] 4. Fail closed on Jira Goal create/update authority and counting

  What to do: Add a red table-driven test in `goal-hierarchy-contracts.test.ts` covering missing create issue type, unsupported/falsified type, update type drift, update with missing/incomplete authoritative `before_state`, due-date-only update evasion, cross-project create/update, and fake child-count contributors (Confluence, Jira comment, invalid project, invalid Story/Sub-task fields). Refactor `goalActionSemanticErrors` around one parsed Jira hierarchy-write result per `issue.create`/`issue.update`: creates take type/project from `desired_state`; updates require type/project from `before_state`, reject conflicting desired values, merge allowed desired fields over before state, and validate the effective post-update Goal contract. Remove the early return. Count only valid Jira `issue.create` parsed results for minimum Goal/Sub-task checks.
  Must NOT do: Do not trust update `desired_state.issue_type` or project, do not infer Story from `due_date`, do not let an unknown type bypass validation, do not require a read of a nonexistent create target, and do not count non-create/non-Jira/field-invalid actions.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [8] | Blocked by: [2]

  References (executor has NO interview context - be exhaustive):
  - API/Type: `src/goal-action-rules.ts:29` - Jira issue-write operation boundary.
  - Pattern:  `src/goal-action-rules.ts:38` - recognized-desired-type filter and early return that permit evasions.
  - Pattern:  `src/goal-action-rules.ts:41` - current loop trusts desired state for both creates and updates.
  - Pattern:  `src/goal-action-rules.ts:68` - current child counts inspect any desired state regardless of system, operation, project, or field validity.
  - API/Type: `schemas/action-group.schema.json:61` - `before_state` is present for every action; update schema already requires version or nonempty before state.
  - API/Type: `src/contracts.ts:215` - action approval and Goal semantic errors are both composed into one result.
  - Test:     `tests/contracts/goal-hierarchy-contracts.test.ts:123` - complete seven-action hierarchy fixture and mutation pattern.
  - Pattern:  `template/.kilo/skills/jiraman-apply-actions/SKILL.md:38` - installed preflight contract requiring existing-target rereads and exact hierarchy fields.
  - External: none - no live Jira schema call is authorized in this plan.

  Acceptance criteria (agent-executable only):
  - [ ] The new adversarial table fails before production changes and passes afterward; each row asserts the named semantic keyword rather than only `valid === false`.
  - [ ] Every Jira `issue.create`/`issue.update` returns an `issueType` error when authoritative type is missing/unsupported, and an update returns `issueTypeDrift`/`projectDrift` when desired values contradict `before_state`.
  - [ ] A due-date-only update with incomplete authoritative Story state is invalid; a complete authoritative Story update is validated against the merged effective state and cannot change project/type.
  - [ ] Cross-project create and update cases are invalid even if desired issue type is absent or falsified.
  - [ ] Minimum child checks count only valid AIPLATFORM Jira hierarchy creates; each fake contributor leaves the parent with `minimumGoals` or `minimumSubtasks`.
  - [ ] The existing complete seven-action group remains valid and `npm run validate:actions` exits 0.
  - [ ] `npm run typecheck`, no-excuse audit, and pure-LOC check pass for `src/goal-action-rules.ts`; extract typed parsing helpers if needed rather than exceeding 250 pure LOC.
  - [ ] Checkpoint/rollback: stage only the action rule and its test; any regression in the valid group or generic non-write operations requires reverting this task commit before continuing.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: complete create hierarchy remains executable at the contract boundary
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/goal-hierarchy-contracts.test.ts -t 'Jira Goal action groups reject missing fields and incomplete decomposition' | tee "$attemptDir/task-4-jira-authority.txt"` and `npm run validate:actions`.
    Expected: The complete AIPLATFORM Epic/two-Story/four-Sub-task group is valid; all existing action fixtures validate.
    Evidence: <attemptDir>/task-4-jira-authority.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: missing/falsified update authority and fake child writes fail closed
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/goal-hierarchy-contracts.test.ts -t 'fails closed on authoritative Jira Goal write state and valid child counts' | tee "$attemptDir/task-4-jira-authority-error.txt"`.
    Expected: Every adversarial row is invalid with its exact issue-type/project/field/cardinality keyword, and no fake action satisfies a count.
    Evidence: <attemptDir>/task-4-jira-authority-error.txt
  ```

  Commit: YES | Message: `fix(actions): fail closed on jira goal hierarchy writes` | Files: [src/goal-action-rules.ts, tests/contracts/goal-hierarchy-contracts.test.ts]

- [ ] 5. Make installed Goal metadata structurally release-blocking

  What to do: Add `src/goal-contract-metadata-rules.ts` with deterministic validation of the canonical Confluence `goal_contract` object and a marker derived from its structured fields (Story type, required Goal name/date/DoD, Epic parent required, two Goals, two Sub-tasks, max four hours, traceability required). Add explicit boolean `goal_contract_required` to every skill-index and Confluence page-index entry, marking the existing seven Goal-aware skills and six Goal-aware templates true and all others false. Extend the canonical object with structural `epic_parent_required` and `traceability_required` booleans so the marker is derivable rather than hard-coded. Make `validateSkills` and `validateConfluenceTemplates` call the shared structural rules and validate each index-declared path's frontmatter marker or required absence. Rewrite the old hard-coded path/token test to derive paths from the indexes and exercise the same consumed validator, including tampered index/contract cases red-first.
  Must NOT do: Do not keep a standalone `GOAL_CONTRACT` test constant, hard-code the seven/six path arrays in tests, assert body prose, or allow an index to omit a file/flag. Do not move installed source out of `template/`.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [8] | Blocked by: [1]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/validate.ts:59` - skill validator already resolves indexed names/paths and is the release CLI seam.
  - Pattern:  `src/validate.ts:140` - Confluence validator already iterates every indexed page and checks structural ownership metadata.
  - API/Type: `template/docs/project-management/templates/confluence/index.json:10` - canonical structured Goal contract.
  - API/Type: `template/.kilo/skills/index.json:3` - installed skill path registry from which coverage must be derived.
  - Pattern:  `tests/contracts/goal-hierarchy-contracts.test.ts:38` - brittle hard-coded marker test to replace.
  - Pattern:  `src/contracts.ts:104` - frontmatter parser used by release validation.
  - Test:     `package.json:13` and `package.json:20` - `validate:skills` and `validate:confluence-templates` release entry points.
  - Test:     `packaging/managed-files.txt:7` and `packaging/managed-files.txt:20` - indexes/templates/skills are installed artifacts.
  - External: none - the structural contract is repository-owned.

  Acceptance criteria (agent-executable only):
  - [ ] The rewritten metadata test fails against a tampered canonical object, a missing/false required flag, an unresolved index path, and a required document with a missing/mismatched marker before production integration; it passes afterward.
  - [ ] `npm run validate:skills && npm run validate:confluence-templates` exits 0 and both commands traverse index-derived paths.
  - [ ] Changing any canonical cardinality/required boolean in an in-memory clone yields a deterministic structural violation; no test compares prompt body prose.
  - [ ] Every skill/page index entry has a boolean `goal_contract_required`; every `true` entry has the derived marker and every `false` entry has no marker.
  - [ ] `npm run typecheck`, no-excuse audit, and pure-LOC checks pass for `src/validate.ts src/goal-contract-metadata-rules.ts`, with `src/validate.ts` still below 250 pure LOC.
  - [ ] Checkpoint/rollback: commit the new rule module, validator integration, both indexes, and the rewritten test together; reverting the commit restores the previous installed metadata atomically.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: installed source indexes and Goal-aware documents agree structurally
    Tool:     bash
    Steps:    Run `npm run validate:skills && npm run validate:confluence-templates | tee "$attemptDir/task-5-installed-goal-contract.txt"`.
    Expected: Both release validators exit 0 after resolving every index path and consumed Goal marker.
    Evidence: <attemptDir>/task-5-installed-goal-contract.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: canonical/index/marker drift is rejected without prose assertions
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/goal-hierarchy-contracts.test.ts -t 'installed indexes enforce the structural Goal contract' | tee "$attemptDir/task-5-installed-goal-contract-error.txt"`.
    Expected: In-memory tampered contract/index/marker cases return their exact deterministic violations and the test exits 0.
    Evidence: <attemptDir>/task-5-installed-goal-contract-error.txt
  ```

  Commit: YES | Message: `fix(templates): validate installed goal contract metadata` | Files: [src/goal-contract-metadata-rules.ts, src/validate.ts, template/.kilo/skills/index.json, template/docs/project-management/templates/confluence/index.json, tests/contracts/goal-hierarchy-contracts.test.ts]

- [ ] 6. Require concrete Ready-backed Goal evidence in schema and runtime

  What to do: Add red schema/runtime mutation cases for each missing or falsified evidence dimension. In `deliverable-plan.schema.json`, define verified deadline evidence and traceability-map shapes, expose `canonical_spec`, `requirements`, `acceptance_criteria`, and concrete `traceability` on Goal entries, and use a Ready-backed conditional so those new fields are mandatory/nonempty only for Ready-backed candidates while existing non-ready fixtures may omit them. Retain all existing required fields including `traceability_complete`. Update the valid Ready-backed fixture with deadline source/reference/verified, canonical spec, REQ/AC IDs, and REQ/AC/Goal-DoD maps to existing Sub-task refs. Update `candidateCanCommit` to independently check the same conditions: allowed verified source, nonempty reference/spec/REQ/AC, exact traceability keys for Goal IDs and `DOD-1..N`, nonempty unique map values containing only declared candidate Sub-task refs, plus every current readiness/deadline-fit/parent/DoD/cardinality/hour/dependency condition.
  Must NOT do: Do not make non-ready candidates pretend to have verified evidence, remove existing fields, trust `traceability_complete` alone, or let a map point to an unknown/duplicate/empty Sub-task ref.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [8] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - API/Type: `schemas/deliverable-plan.schema.json:13` - candidate schema and existing required properties.
  - API/Type: `schemas/deliverable-plan.schema.json:66` - Goal schema currently stops at date/DoD/parent/Sub-tasks/boolean traceability.
  - Pattern:  `src/workflow-rules.ts:39` - runtime `candidateCanCommit` current gate.
  - Test:     `tests/fixtures/deliverables/cases.json:15` - valid Ready-backed candidate and non-ready controls.
  - Test:     `tests/contracts/two-week-scenarios-two-week-recommendation-sprint-cadence.test.ts:6` - schema-backed candidate selection test.
  - Test:     `tests/contracts/goal-hierarchy-contracts.test.ts:95` - incomplete Ready classification boundary.
  - Pattern:  `schemas/backlog-draft.schema.json:101` - canonical verified deadline source/reference/verified shape.
  - Pattern:  `schemas/subtask-draft.schema.json:118` - concrete traceability map shape and nonempty unique refs.
  - External: none - reuse repository contract shapes.

  Acceptance criteria (agent-executable only):
  - [ ] Before implementation, mutation tests for missing/unverified deadline evidence, blank canonical spec, empty/missing REQ/AC, missing map, missing ID key, surplus ID key, unknown Sub-task ref, and boolean-only traceability fail; after implementation all pass.
  - [ ] `validateJson("deliverable-plan.schema.json", data)` rejects every incomplete Ready-backed mutation but continues to accept the full fixture including its non-ready candidates.
  - [ ] `candidateCanCommit` returns true only for the complete Ready-backed fixture and false for each schema-invalid/semantic mutation even if `traceability_complete === true`.
  - [ ] `npm run validate:deliverable-fixtures` and the two targeted contract test files pass.
  - [ ] `npm run typecheck`, no-excuse audit, and pure-LOC check pass for `src/workflow-rules.ts`.
  - [ ] Checkpoint/rollback: schema, fixture, runtime, and tests commit together so reverting cannot leave a fixture/schema split.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: fully evidenced Ready-backed candidate can commit
    Tool:     bash
    Steps:    Run `npm run validate:deliverable-fixtures && npm test -- --run tests/contracts/two-week-scenarios-two-week-recommendation-sprint-cadence.test.ts -t 'scenarios differ and hypotheses are never feasible commitments' | tee "$attemptDir/task-6-ready-evidence.txt"`.
    Expected: Ajv accepts the fixture, `candidateCanCommit` returns true for the Ready-backed candidate and false for the hypothesis.
    Evidence: <attemptDir>/task-6-ready-evidence.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: boolean-only or forged Ready evidence cannot commit
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/goal-hierarchy-contracts.test.ts -t 'Ready-backed candidates require verified deadline specification IDs and concrete traceability' | tee "$attemptDir/task-6-ready-evidence-error.txt"`.
    Expected: Every missing/forged evidence mutation is schema-invalid and returns false from `candidateCanCommit`.
    Evidence: <attemptDir>/task-6-ready-evidence-error.txt
  ```

  Commit: YES | Message: `fix(planning): require complete ready-backed goal evidence` | Files: [schemas/deliverable-plan.schema.json, src/workflow-rules.ts, tests/fixtures/deliverables/cases.json, tests/contracts/two-week-scenarios-two-week-recommendation-sprint-cadence.test.ts, tests/contracts/goal-hierarchy-contracts.test.ts]

- [ ] 7. Detect paraphrased hostile contract overrides

  What to do: Expand the security fixture to a table of one-purpose hostile paraphrases and benign controls. Cover cardinality (single/fewer/optional child), hours (allow estimates over four), Goal DoD (skip/drop/make optional), deadline (guess/assume/fabricate due date), tool selection (switch/call another connector), scope (another/outside project), and approval (bypass/skip/self-approve/without ask). Add red Given/When/Then assertions that each hostile case returns the expected existing blocked-effect category and stable IDs, while benign controls return null. Refactor `inspectUntrustedContent` into small, ordered detector tables or named positive predicates so every category contributes to `suspicious` and output order remains `scope change`, `tool selection`, `write approval`, `secret disclosure`, `goal policy override`.
  Must NOT do: Do not use an LLM/NLP dependency, broad `.*` patterns, single exact sentences, or a catch-all that flags ordinary discussions of the contract. Do not reproduce hostile content in production output or lose REQ/AC evidence IDs.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [8] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - API/Type: `src/security-rules.ts:22` - stable `SecurityFinding` output contract.
  - Pattern:  `src/security-rules.ts:29` - current literal regex misses paraphrases and separates effect classification.
  - API/Type: `src/security-rules.ts:42` - stable REQ/AC preservation.
  - Test:     `tests/fixtures/security/untrusted-content.json:16` - current single literal hostile sentence/baseline.
  - Test:     `tests/contracts/mcp-contract-mcp-profiles-scope-guards-untrusted-content.test.ts:34` - observable security-boundary assertions.
  - Pattern:  `template/.kilo/policies/jiraman-safety.md:43` - trust-order and evidence-only policy to preserve.
  - External: none - deterministic local classification only.

  Acceptance criteria (agent-executable only):
  - [ ] The new hostile paraphrase matrix fails before production edits and passes afterward for every named category.
  - [ ] Cardinality/hours/Goal-DoD/deadline paraphrases include `goal policy override`; tool/scope/approval paraphrases include their existing exact blocked effects.
  - [ ] A mixed hostile case retains sorted unique `REQ-*`/`AC-*` IDs and stable effect ordering.
  - [ ] At least one benign statement per category returns null, preventing keyword-only false positives.
  - [ ] `npm run validate:security-fixtures` and the targeted security contract test pass.
  - [ ] `npm run typecheck`, no-excuse audit, and pure-LOC check pass for `src/security-rules.ts`.
  - [ ] Checkpoint/rollback: detector, fixture, and test commit together; revert if any benign control becomes suspicious.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: benign contract evidence is preserved without a finding
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/mcp-contract-mcp-profiles-scope-guards-untrusted-content.test.ts -t 'cross-scope and embedded instructions remain blocked' | tee "$attemptDir/task-7-hostile-paraphrases.txt"`.
    Expected: Every benign control returns null and legitimate stable IDs remain available.
    Evidence: <attemptDir>/task-7-hostile-paraphrases.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: each paraphrased policy/tool/scope/approval attack is blocked
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/mcp-contract-mcp-profiles-scope-guards-untrusted-content.test.ts -t 'blocks paraphrased cardinality hours Goal DoD deadline tool scope and approval overrides' | tee "$attemptDir/task-7-hostile-paraphrases-error.txt"` and `npm run validate:security-fixtures`.
    Expected: All hostile rows return their exact existing blocked-effect category; both commands exit 0.
    Evidence: <attemptDir>/task-7-hostile-paraphrases-error.txt
  ```

  Commit: YES | Message: `fix(security): detect paraphrased contract overrides` | Files: [src/security-rules.ts, tests/fixtures/security/untrusted-content.json, tests/contracts/mcp-contract-mcp-profiles-scope-guards-untrusted-content.test.ts]

- [ ] 8. Synchronize installed contracts and make the hardened boundaries explicit release gates

  What to do: After Tasks 3-7 are green, add red release-checklist assertions for new consumed check tokens, then update `REQUIRED_RELEASE_GATE_CHECKS` and `docs/release-checklist.md` together so schema/skills/fixtures/security/manual-smoke gates explicitly cover exact traceability, Ready evidence, installed Goal metadata, hostile paraphrases, and authoritative Jira state. Update the shared safety policy and only the directly affected installed skills: refinement (exact bidirectional REQ/AC relations), apply-actions (authoritative `before_state`, effective update state, valid-write counts), next-two-weeks (verified deadline reference/spec/REQ/AC/concrete maps), and the shared trust policy (paraphrased overrides). Update README, architecture, command reference, security model, manual smoke tests, and changelog to describe observable behavior and exact agent-executable smoke cases. Do not add assertions over these prose bodies; release validation checks links, structural checklist tokens, indexes, and installed frontmatter.
  Must NOT do: Do not duplicate the full shared policy into skills, update unaffected skill bodies, add new runtime/config fields without an executable need, or turn documentation prose into pinned test strings.

  Parallelization: Can parallel: NO | Wave 3 | Blocks: [F1, F2, F3, F4] | Blocked by: [3, 4, 5, 6, 7]

  References (executor has NO interview context - be exhaustive):
  - API/Type: `src/release-rules.ts:3` - machine-consumed release gate/check registry.
  - Test:     `tests/contracts/run-records.test.ts:11` - structural checklist mutation tests; extend with each new check token.
  - Pattern:  `docs/release-checklist.md:3` - release gate comments consumed by `checklistViolations`.
  - Pattern:  `template/.kilo/policies/jiraman-safety.md:27` - canonical installed Goal contract.
  - Pattern:  `template/.kilo/policies/jiraman-safety.md:43` - canonical untrusted-content boundary.
  - Pattern:  `template/.kilo/skills/jiraman-apply-actions/SKILL.md:38` - Jira preflight/update contract.
  - Pattern:  `template/.kilo/skills/jiraman-refinement/SKILL.md:40` - Sub-task traceability/decomposition contract.
  - Pattern:  `template/.kilo/skills/jiraman-next-two-weeks/SKILL.md:22` - Ready-backed evidence contract.
  - Pattern:  `README.md:33` - public Goal delivery summary.
  - Pattern:  `docs/architecture/jiraman-v5.md:34` - validator ownership boundary.
  - Pattern:  `docs/manual-smoke-tests.md:20` - Goal hierarchy/install smoke procedure.
  - Pattern:  `docs/security-model.md:3` - scope/trust/write safety summary.
  - Pattern:  `CHANGELOG.md:3` - user-visible v5 behavior entry.
  - External: none - documentation describes the implemented local contract only.

  Acceptance criteria (agent-executable only):
  - [ ] Before registry/checklist edits, the new `run-records.test.ts` mutations fail; afterward removing any new check token yields the exact `missing-check:<gate>:<token>` violation.
  - [ ] `npm test -- --run tests/contracts/run-records.test.ts tests/contracts/skills-command-router.test.ts tests/contracts/goal-hierarchy-contracts.test.ts` passes without asserting installed prompt body sentences.
  - [ ] `npm run validate:docs && npm run validate:skills && npm run validate:confluence-templates` exits 0.
  - [ ] `npm run validate:config` remains green without configuration expansion, proving existing hierarchy/deadline-source/cardinality/hour settings remain canonical.
  - [ ] `git diff --check` exits 0 and `CHANGELOG.md` records the hardened user-visible behavior.
  - [ ] Checkpoint/rollback: commit release registry/test/checklist and synchronized installed/docs surfaces together; reverting the commit removes both the new gate requirements and their documentation without affecting feature commits.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: all installed and documented hardened contracts pass release validation
    Tool:     bash
    Steps:    Run `npm run validate:docs && npm run validate:skills && npm run validate:confluence-templates && npm run validate:config | tee "$attemptDir/task-8-release-sync.txt"`.
    Expected: Every command exits 0; structural metadata/checklist/config contracts agree.
    Evidence: <attemptDir>/task-8-release-sync.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: omitting a new release boundary token fails structurally
    Tool:     bash
    Steps:    Run `npm test -- --run tests/contracts/run-records.test.ts -t 'release checklist requires structural gate and smoke coverage' | tee "$attemptDir/task-8-release-sync-error.txt"`.
    Expected: The test's in-memory token-removal cases produce exact `missing-check` violations for traceability, Ready evidence, installed Goal metadata, hostile paraphrases, and Jira authority.
    Evidence: <attemptDir>/task-8-release-sync-error.txt
  ```

  Commit: YES | Message: `fix(release): synchronize hardened goal contracts` | Files: [src/release-rules.ts, tests/contracts/run-records.test.ts, docs/release-checklist.md, template/.kilo/policies/jiraman-safety.md, template/.kilo/skills/jiraman-apply-actions/SKILL.md, template/.kilo/skills/jiraman-refinement/SKILL.md, template/.kilo/skills/jiraman-next-two-weeks/SKILL.md, README.md, docs/architecture/jiraman-v5.md, docs/command-reference.md, docs/security-model.md, docs/manual-smoke-tests.md, CHANGELOG.md]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met
  - Verify exactly eight implementation commits (or an explicitly documented, still-atomic equivalent), inspect `git diff <base>...HEAD`, map every Must-Have to code/test evidence, confirm every Must-NOT-Have with `rg`/diff review, and reject any missing red-test transcript.
  - Run `npm run typecheck`, then `npm test`, then every domain command named in Tasks 1-8; save `<attemptDir>/final-plan-compliance.txt`.

- [ ] F2. Code quality review - diagnostics clean, idioms match, no dead code
  - Run `bun run /home/beou/.codex/plugins/cache/sisyphuslabs/omo/4.19.3/skills/programming/scripts/typescript/check-no-excuse-rules.ts src tests/contracts` and the pure-LOC loop over every changed `.ts` file; reject `src/validate.ts > 250`, unused exports, duplicated date logic, untyped escape hatches, or one-use wrappers.
  - Run `git diff --check` and `npm run typecheck`; save `<attemptDir>/final-code-quality.txt`.

- [ ] F3. Real manual QA - every QA scenario executed with evidence captured
  - In a task-owned worktree with no tracked diff (`git diff --exit-code && git diff --cached --exit-code`), run `npm ci`, then `npm run ci` exactly once and capture the complete log at `<attemptDir>/final-clean-ci.txt`; any failure blocks release.
  - Perform library QA with a built `dist`: run a Node ESM probe importing `validateJson`, `goalPackageSetViolations`, `candidateCanCommit`, and `inspectUntrustedContent` from `dist/src/*.js`; feed one valid object and each blocker mutation, require valid/invalid booleans and exact violation/effect strings, save `<attemptDir>/final-library-qa.txt`.
  - Perform install/package QA in OS temp only: `qaRoot="$(mktemp -d)"; ./scripts/package.sh --output "$qaRoot/release"; ./scripts/verify_package.sh "$qaRoot/release/jiraman-5.0.0.tar.gz"; ./scripts/verify_package.sh "$qaRoot/release/jiraman-5.0.0.zip"; ./install.sh "$qaRoot/project"; ./verify.sh "$qaRoot/project"; cmp template/.kilo/skills/index.json "$qaRoot/project/.kilo/skills/index.json"; cmp template/docs/project-management/templates/confluence/index.json "$qaRoot/project/docs/project-management/templates/confluence/index.json"`; save `<attemptDir>/final-install-package-qa.txt`, then remove only the recorded `qaRoot`.
  - Re-run every Task 1-8 happy and failure scenario command and confirm every referenced evidence file exists and is nonempty.

- [ ] F4. Scope fidelity - nothing extra shipped beyond Must-Have, nothing Must-NOT-Have introduced
  - Inspect `git status --short`, `git diff --name-only <base>...HEAD`, `packaging/managed-files.txt`, and package archive listings. Reject changes outside task file lists, committed operational state/evidence/secrets, custom Atlassian/runtime client code, MCP configuration changes, unrelated untracked-file deletion, or natural-language prompt assertions.
  - Confirm `git diff <base>...HEAD -- template/.kilo/config/mcp-atlassian.json install.sh verify.sh` is empty unless an explicit blocker-backed amendment was approved; save `<attemptDir>/final-scope-fidelity.txt`.

## Commit strategy
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- Use a task-owned worktree for this PR; preserve all unrelated user-owned untracked files in the original checkout.
- Before each commit, stage only the task's explicit file list and inspect `git diff --cached --check` plus `git diff --cached --name-only`.
- A failed task never advances dependency waves. Restore its task-owned paths to the recorded pre-task SHA or revert its atomic commit; do not reset the branch or another worker's work.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/fix-goal-contract-review-blockers.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
- `src/validate.ts` remains under 250 pure LOC, all changed TypeScript files pass the no-excuse audit, and `npm run typecheck` is clean.
- Targeted red transcripts prove every prior blocker was observable before its fix; valid fixtures remain green afterward.
- `npm run ci` passes from a clean tracked worktree, followed by independent library probes and clean install/package verification.
- No custom Atlassian client, live Jira/Confluence write, MCP configuration mutation, prompt-prose assertion, unrelated file change, or user-owned untracked-file deletion appears in the final diff.
