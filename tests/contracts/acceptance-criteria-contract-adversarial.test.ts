import { describe, expect, test } from "vitest";

import { acceptanceCriteriaReadBackMatches } from "../../src/action-rules.js";
import { asArray, asObject, readJson, validateJson, type JsonObject, type JsonValue } from "../../src/contracts.js";
import { goalActionSemanticErrors } from "../../src/goal-action-rules.js";
import { goalReadinessViolations } from "../../src/workflow-rules.js";
import { goalHierarchyGroup } from "./goal-hierarchy-fixture.js";

function criterion(): JsonObject {
  return {
    id: "AC-1",
    statement: "Bản sao lưu được khôi phục nguyên vẹn",
    verification: "Chạy restore drill và đối chiếu byte",
    requirement_refs: ["REQ-1"],
  };
}

function localCriterion(): JsonObject {
  return {
    id: "AC-1",
    statement: "Bằng chứng restore được lưu trong hồ sơ nghiệm thu",
    verification: "review restore evidence checklist",
    validation_ref: "VAL-1",
    definition_of_done_ref: "DOD-1",
  };
}

function readyGoal(): JsonObject {
  return {
    goal_name: "Restore backups",
    target_completion_date: "2026-08-07",
    deadline_evidence_verified: true,
    definition_of_done: ["Restore evidence accepted"],
    epic_parent: "AIPLATFORM-100",
    requirements: ["REQ-1"],
    acceptance_criteria: [criterion()],
    subtasks: [
      {ref: "AIPLATFORM-101", summary: "Run restore drill", outcome: "Restore is verified", in_scope: ["restore drill"], out_of_scope: ["production restore"], steps: ["run the drill"], affected_files: ["docs/rollback.md"], validation: "restore test", definition_of_done: "Evidence is attached", dependencies: [], estimate_hours: 2, requirements: ["REQ-1"], parent_acceptance_criteria_refs: ["AC-1"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", acceptance_criteria: [localCriterion()]},
      {ref: "AIPLATFORM-102", summary: "Review restore evidence", outcome: "Evidence is accepted", in_scope: ["restore evidence"], out_of_scope: ["production changes"], steps: ["review the evidence"], affected_files: ["docs/manual-smoke-tests.md"], validation: "review checklist", definition_of_done: "Review is recorded", dependencies: ["AIPLATFORM-101"], estimate_hours: 3, requirements: ["REQ-1"], parent_acceptance_criteria_refs: ["AC-1"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", acceptance_criteria: [localCriterion()]},
    ],
    traceability_complete: true,
    dependencies: [],
  };
}

describe("Acceptance Criteria adversarial contract", () => {
  test("rejects vague variants instead of only exact blacklist phrases", () => {
    // Given
    const source = asObject(asObject(readJson("tests/fixtures/drafts/backlog.json"), "backlog fixture").data ?? null, "backlog");
    const values = [
      "đạt yêu cầu hoàn toàn",
      "looks good",
      "acceptable",
      "tốt",
      "đúng",
      "all good",
      "good enough",
      "looks fine",
      "pass",
      "được",
      "test",
      "review",
      "run",
      "checklist",
      "test passes",
      "run test",
      "review it",
      "test all",
      "check everything",
      "kiểm tra nó",
      "run [COMMAND]",
      "test [TARGET]",
      "check [EVIDENCE]",
      "run [EXPECTED]",
      "test [FOO]",
      "review [ACCEPTANCE]",
      "test [foo]",
      "review [x]",
      "check [ticket]",
      "https://",
      "./",
      "/",
      "run https://",
      "run ./",
      "test:https://",
      "review(https://)",
      "https://?",
      "test [foo]()",
      "review [x]()",
      "test [foo](https://)",
      "test [foo",
      "review [x",
      "test foo]",
      "the test passes",
      "the review is complete",
      "check the results",
    ];

    // When
    const results = values.map((verification) => {
      const backlog = structuredClone(source);
      const story = asObject(asArray(backlog.stories, "Goal Stories")[0] ?? null, "Goal Story");
      const item = asObject(asArray(story.acceptance_criteria, "Acceptance Criteria")[0] ?? null, "Acceptance Criterion");
      item.verification = verification;
      return {verification, result: validateJson("backlog-draft.schema.json", backlog)};
    });
    const concise = structuredClone(source);
    const conciseStory = asObject(asArray(concise.stories, "concise Goal Stories")[0] ?? null, "concise Goal Story");
    const conciseCriterion = asObject(asArray(conciseStory.acceptance_criteria, "concise Acceptance Criteria")[0] ?? null, "concise Acceptance Criterion");
    conciseCriterion.statement = "GET /health 200";
    const concreteVerifications = ["./verify.sh --source-tree", "https://example.com/evidence", "review [restore evidence](https://example.com/evidence)", "test [restore evidence](https://example.com?run=1)", "review [restore evidence](https://example.com#result)", "review [local evidence](./evidence/report.md#result)", "test [restore evidence](https://example.com/foo(bar))", "test [local evidence](./docs/a(b).md#result)"].map((verification) => {
      const backlog = structuredClone(source);
      const story = asObject(asArray(backlog.stories, "concrete Goal Stories")[0] ?? null, "concrete Goal Story");
      const item = asObject(asArray(story.acceptance_criteria, "concrete Acceptance Criteria")[0] ?? null, "concrete Acceptance Criterion");
      item.verification = verification;
      return validateJson("backlog-draft.schema.json", backlog);
    });
    const placeholderStatements = ["[STATEMENT]", "[foo]", "Backup [foo]", "Backup [foo.bar]", "Backup [foo/bar]", "Backup []", "Backup [foo", "Backup foo]"].map((statement) => {
      const backlog = structuredClone(source);
      const story = asObject(asArray(backlog.stories, "placeholder Goal Stories")[0] ?? null, "placeholder Goal Story");
      const item = asObject(asArray(story.acceptance_criteria, "placeholder Acceptance Criteria")[0] ?? null, "placeholder Acceptance Criterion");
      item.statement = statement;
      return validateJson("backlog-draft.schema.json", backlog);
    });

    // Then
    for (const item of results) {
      expect(item.result.errors.some((error) => error.keyword === "testableAcceptanceCriterion"), item.verification).toBe(true);
    }
    expect(validateJson("backlog-draft.schema.json", concise).valid).toBe(true);
    expect(concreteVerifications.every((result) => result.valid)).toBe(true);
    expect(placeholderStatements.every((result) => result.errors.some((error) => error.keyword === "testableAcceptanceCriterion"))).toBe(true);
  });

  test("requires canonical Sub-task scope and execution lists to contain strings", () => {
    // Given
    const source = asObject(asObject(readJson("tests/fixtures/drafts/subtasks.json"), "Sub-task fixture").data ?? null, "Sub-task draft");
    const malformed: ReadonlyArray<readonly [string, JsonValue]> = [
      ["title", "   "],
      ["title", "\u200B"],
      ["title", "\u00AD"],
      ["title", "\u0000"],
      ["outcome", "\t"],
      ["in_scope", [null]],
      ["in_scope", ["   "]],
      ["in_scope", ["\u200B"]],
      ["out_of_scope", [false]],
      ["steps", [{}]],
      ["steps", ["\t"]],
      ["steps", ["\u200B"]],
      ["steps", ["\u200E"]],
      ["affected_files", [42]],
      ["dependencies", [null]],
      ["dependencies", ["   "]],
      ["dependencies", ["\u200B"]],
      ["validation", "   "],
      ["validation", "\u0007"],
      ["definition_of_done", "\t"],
    ];

    // When / Then
    for (const [field, value] of malformed) {
      const draft = structuredClone(source);
      asObject(asArray(draft.subtasks, "Sub-tasks")[0] ?? null, "Sub-task")[field] = value;
      expect(validateJson("subtask-draft.schema.json", draft).valid, field).toBe(false);
    }
  });

  test("requires Ready goals to contain requirements and structured criteria", () => {
    // Given
    const missingRequirements = readyGoal();
    delete missingRequirements.requirements;
    const missingCriteria = readyGoal();
    delete missingCriteria.acceptance_criteria;
    const emptyCriteria = readyGoal();
    emptyCriteria.acceptance_criteria = [];
    const invisibleName = readyGoal();
    invisibleName.goal_name = "\u200B";
    const controlOnlyName = readyGoal();
    controlOnlyName.goal_name = "\u0000";
    const invisibleDefinitionOfDone = readyGoal();
    invisibleDefinitionOfDone.definition_of_done = ["\u200B"];
    const malformedEpicParent = readyGoal();
    malformedEpicParent.epic_parent = "AIPLATFORM-X";

    // When / Then
    for (const goal of [missingRequirements, missingCriteria, emptyCriteria]) {
      expect(goalReadinessViolations(goal)).toContain("incomplete-acceptance-criteria");
    }
    expect(goalReadinessViolations(invisibleName)).toContain("missing-goal-name");
    expect(goalReadinessViolations(controlOnlyName)).toContain("missing-goal-name");
    expect(goalReadinessViolations(invisibleDefinitionOfDone)).toContain("missing-goal-dod");
    expect(goalReadinessViolations(malformedEpicParent)).toContain("unverified-epic-parent");
  });

  test("requires Ready goals to prove every Goal criterion through child references", () => {
    // Given
    const uncovered = readyGoal();
    uncovered.acceptance_criteria = [criterion(), {...criterion(), id: "AC-2", statement: "Bằng chứng restore được lưu trong hồ sơ nghiệm thu"}];
    const unresolved = readyGoal();
    delete asObject(asArray(unresolved.subtasks, "unresolved Sub-tasks")[0] ?? null, "unresolved Sub-task").parent_acceptance_criteria_refs;
    const incompleteChildren = ["summary", "outcome", "in_scope", "out_of_scope", "steps", "affected_files", "validation", "definition_of_done", "dependencies", "acceptance_criteria", "content_language", "acceptance_criteria_storage"].map((field) => {
      const goal = readyGoal();
      delete asObject(asArray(goal.subtasks, "incomplete Sub-tasks")[0] ?? null, "incomplete Sub-task")[field];
      return goal;
    });
    const invalidLocalTrace = readyGoal();
    asObject(asArray(asObject(asArray(invalidLocalTrace.subtasks, "invalid-trace Sub-tasks")[0] ?? null, "invalid-trace Sub-task").acceptance_criteria, "invalid local criteria")[0] ?? null, "invalid local criterion").validation_ref = "VAL-999";
    const duplicateDependencies = readyGoal();
    asObject(asArray(duplicateDependencies.subtasks, "duplicate-dependency Sub-tasks")[0] ?? null, "duplicate-dependency Sub-task").dependencies = ["AIPLATFORM-99", "AIPLATFORM-99"];
    const unresolvedDependency = readyGoal();
    asObject(asArray(unresolvedDependency.subtasks, "unresolved-dependency Sub-tasks")[0] ?? null, "unresolved-dependency Sub-task").dependencies = ["AIPLATFORM-999"];
    const cyclicDependencies = readyGoal();
    asObject(asArray(cyclicDependencies.subtasks, "cyclic-dependency Sub-tasks")[0] ?? null, "cyclic-dependency Sub-task").dependencies = ["AIPLATFORM-102"];
    const malformedListValues: ReadonlyArray<readonly [string, JsonValue]> = [
      ["in_scope", [null]],
      ["in_scope", ["   "]],
      ["in_scope", ["\u200B"]],
      ["in_scope", ["\u0007"]],
      ["out_of_scope", [false]],
      ["steps", [{}]],
      ["steps", ["\t"]],
      ["steps", ["\u200B"]],
      ["steps", ["\u200E"]],
      ["steps", ["\u001F"]],
      ["affected_files", [42]],
    ];
    const malformedChildLists = malformedListValues.map(([field, value]) => {
      const goal = readyGoal();
      asObject(asArray(goal.subtasks, "malformed-list Sub-tasks")[0] ?? null, "malformed-list Sub-task")[field] = value;
      return goal;
    });
    const whitespaceSummary = readyGoal();
    asObject(asArray(whitespaceSummary.subtasks, "whitespace-summary Sub-tasks")[0] ?? null, "whitespace-summary Sub-task").summary = "   ";
    const controlOnlySummary = readyGoal();
    asObject(asArray(controlOnlySummary.subtasks, "control-summary Sub-tasks")[0] ?? null, "control-summary Sub-task").summary = "\u0000";

    // When / Then
    expect(goalReadinessViolations(readyGoal())).not.toContain("incomplete-acceptance-criteria");
    for (const goal of [uncovered, unresolved, invalidLocalTrace, duplicateDependencies, unresolvedDependency, cyclicDependencies, whitespaceSummary, controlOnlySummary, ...incompleteChildren, ...malformedChildLists]) {
      expect(goalReadinessViolations(goal)).toContain("incomplete-acceptance-criteria");
      expect(goalReadinessViolations(goal)).toContain("incomplete-traceability");
    }
  });

  test("compares every approved role-specific criterion field on read-back", () => {
    // Given
    const approvedGoal = [criterion()];
    const changedRequirement = structuredClone(approvedGoal);
    asObject(changedRequirement[0] ?? null, "changed Goal criterion").requirement_refs = ["REQ-999"];
    const approvedReferences = [{...criterion(), requirement_refs: ["REQ-1", "REQ-2"]}];
    const reorderedReferences = structuredClone(approvedReferences);
    asObject(reorderedReferences[0] ?? null, "reordered references criterion").requirement_refs = ["REQ-2", "REQ-1"];
    const approvedSequence = [criterion(), {...criterion(), id: "AC-2", statement: "Bằng chứng restore được lưu trong hồ sơ nghiệm thu"}];
    const reorderedSequence = [approvedSequence[1] ?? {}, approvedSequence[0] ?? {}];
    const crlfCriterion = [{...criterion(), statement: "Dòng một\r\nDòng hai"}];
    const lfCriterion = [{...criterion(), statement: "Dòng một\nDòng hai"}];
    const reorderedFields = [{verification: "Chạy restore drill và đối chiếu byte", requirement_refs: ["REQ-1"], statement: "Bản sao lưu được khôi phục nguyên vẹn", id: "AC-1"}];
    const approvedLocal = [{
      id: "AC-1",
      statement: "Bằng chứng được lưu trong hồ sơ nghiệm thu",
      verification: "Đối chiếu hồ sơ với kết quả kiểm thử",
      validation_ref: "VAL-1",
      definition_of_done_ref: "DOD-1",
    }];
    const changedValidation = structuredClone(approvedLocal);
    asObject(changedValidation[0] ?? null, "changed local criterion").validation_ref = "VAL-999";

    // When / Then
    expect(acceptanceCriteriaReadBackMatches(approvedGoal, reorderedFields)).toBe(true);
    expect(acceptanceCriteriaReadBackMatches(approvedGoal, changedRequirement)).toBe(false);
    expect(acceptanceCriteriaReadBackMatches(approvedReferences, reorderedReferences)).toBe(false);
    expect(acceptanceCriteriaReadBackMatches(approvedSequence, reorderedSequence)).toBe(false);
    expect(acceptanceCriteriaReadBackMatches(crlfCriterion, lfCriterion)).toBe(true);
    expect(acceptanceCriteriaReadBackMatches(approvedLocal, changedValidation)).toBe(false);
  });

  test("blocks description replacement, updated Goal coverage gaps, and child REQ drift", () => {
    // Given
    const descriptionOnly = goalHierarchyGroup();
    const descriptionAction = asObject(asArray(descriptionOnly.actions, "description actions")[1] ?? null, "Story action");
    const descriptionBefore = structuredClone(asObject(descriptionAction.desired_state ?? null, "Story state"));
    descriptionAction.operation = "issue.update";
    descriptionAction.target_version = 7;
    descriptionAction.before_state = descriptionBefore;
    descriptionAction.desired_state = {description: "replace human-authored description"};

    const uncoveredUpdate = goalHierarchyGroup();
    const uncoveredAction = asObject(asArray(uncoveredUpdate.actions, "coverage actions")[1] ?? null, "Story action");
    const uncoveredBefore = structuredClone(asObject(uncoveredAction.desired_state ?? null, "Story state"));
    const secondCriterion = {...criterion(), id: "AC-2", statement: "Bằng chứng restore được lưu trong hồ sơ nghiệm thu"};
    uncoveredAction.operation = "issue.update";
    uncoveredAction.target_version = 7;
    uncoveredAction.before_state = uncoveredBefore;
    uncoveredAction.desired_state = {
      acceptance_criteria: [criterion(), secondCriterion],
      description_update_mode: "managed-section",
      managed_section: "acceptance-criteria",
    };

    const requirementDrift = goalHierarchyGroup();
    const driftActions = asArray(requirementDrift.actions, "drift actions").map((value) => asObject(value, "drift action"));
    for (const index of [2, 3]) asObject(driftActions[index]?.desired_state ?? null, "Sub-task state").requirements = ["REQ-999"];

    // When
    const descriptionErrors = goalActionSemanticErrors(descriptionOnly);
    const coverageErrors = goalActionSemanticErrors(uncoveredUpdate);
    const requirementErrors = goalActionSemanticErrors(requirementDrift);

    // Then
    expect(descriptionErrors.some((error) => error.keyword === "managedAcceptanceSection")).toBe(true);
    expect(coverageErrors.some((error) => error.keyword === "goalAcceptanceSubtaskCoverage")).toBe(true);
    expect(requirementErrors.some((error) => error.keyword === "resolvedParentRequirementReference")).toBe(true);
  });

  test("requires child proof for ordinary Story updates and authoritative external parent IDs", () => {
    // Given
    const ordinaryUpdate = goalHierarchyGroup();
    const ordinaryAction = structuredClone(asObject(asArray(ordinaryUpdate.actions, "ordinary actions")[1] ?? null, "Story action"));
    const ordinaryBefore = asObject(ordinaryAction.desired_state ?? null, "Story state");
    ordinaryAction.operation = "issue.update";
    ordinaryAction.target_ref = "AIPLATFORM-101";
    ordinaryAction.target_version = 7;
    ordinaryAction.dependencies = [];
    ordinaryAction.before_state = {
      ...Object.fromEntries(Object.entries(ordinaryBefore).filter(([key]) => key !== "draft_ref")),
      parent_ref: "AIPLATFORM-100",
      parent_state: {issue_key: "AIPLATFORM-100", issue_type: "Epic", project: "AIPLATFORM"},
    };
    ordinaryAction.desired_state = {summary: "Restore backups"};
    ordinaryUpdate.actions = [ordinaryAction];

    const externalSubtask = goalHierarchyGroup();
    const subtaskAction = structuredClone(asObject(asArray(externalSubtask.actions, "external actions")[2] ?? null, "Sub-task action"));
    const subtaskState = asObject(subtaskAction.desired_state ?? null, "Sub-task state");
    subtaskAction.target_ref = "external-task";
    subtaskAction.dependencies = [];
    subtaskAction.before_state = {
      parent_state: {
        issue_key: "AIPLATFORM-101",
        issue_type: "Story",
        project: "AIPLATFORM",
        requirements: ["REQ-1"],
        acceptance_criteria: [criterion()],
      },
    };
    subtaskAction.desired_state = {
      ...Object.fromEntries(Object.entries(subtaskState).filter(([key]) => key !== "draft_ref")),
      parent_ref: "AIPLATFORM-101",
      requirements: ["REQ-999"],
    };
    externalSubtask.actions = [subtaskAction];

    const validExternalSubtask = structuredClone(externalSubtask);
    const validExternalState = asObject(asObject(asArray(validExternalSubtask.actions, "valid external actions")[0] ?? null, "valid external action").desired_state ?? null, "valid external state");
    validExternalState.requirements = ["REQ-1"];
    const forgedAuthority = structuredClone(validExternalSubtask);
    const forgedState = asObject(asObject(asArray(forgedAuthority.actions, "forged actions")[0] ?? null, "forged action").desired_state ?? null, "forged state");
    forgedState.requirements = ["REQ-999"];
    forgedState.parent_acceptance_criteria_refs = ["AC-999"];
    forgedState.parent_requirement_ids = ["REQ-999"];
    forgedState.parent_acceptance_criteria_ids = ["AC-999"];
    const invalidParentKeys = ["OTHER-999", "not-a-jira-key"].map((parentRef) => {
      const invalid = structuredClone(validExternalSubtask);
      const invalidAction = asObject(asArray(invalid.actions, "invalid parent-key actions")[0] ?? null, "invalid parent-key action");
      asObject(invalidAction.desired_state ?? null, "invalid parent-key desired state").parent_ref = parentRef;
      asObject(asObject(invalidAction.before_state ?? null, "invalid parent-key before state").parent_state ?? null, "invalid parent snapshot").issue_key = parentRef;
      return invalid;
    });

    // When / Then
    expect(goalActionSemanticErrors(ordinaryUpdate).some((error) => error.keyword === "goalAcceptanceSubtaskCoverage")).toBe(true);
    expect(goalActionSemanticErrors(externalSubtask).some((error) => error.keyword === "resolvedParentRequirementReference")).toBe(true);
    expect(goalActionSemanticErrors(validExternalSubtask)).toEqual([]);
    expect(goalActionSemanticErrors(forgedAuthority).some((error) => error.keyword === "parentAuthorityPlacement")).toBe(true);
    expect(invalidParentKeys.every((group) => goalActionSemanticErrors(group).some((error) => error.keyword === "parentAuthority"))).toBe(true);
  });

  test("derives AC-gap comment safeguards from an authoritative missing-AC target", () => {
    // Given
    const desiredStates = [
      {body: "Acceptance criteria are okay", managed_content_only: false},
      {purpose: "ordinary-note", body: "Acceptance criteria are okay", managed_content_only: false},
      {purpose: "acceptance-criteria-gap", content_language: "en-US", managed_content_only: false, acceptance_criteria: [criterion()]},
      {purpose: "acceptance-criteria-gap", content_language: "vi-VN", managed_content_only: true, acceptance_criteria: [{id: "AC-1", statement: "Bản sao lưu được khôi phục nguyên vẹn", verification: "Chạy restore drill và đối chiếu byte"}]},
      {purpose: "acceptance-criteria-gap", content_language: "vi-VN", managed_content_only: true, acceptance_criteria: [{...criterion(), requirement_refs: ["REQ-999"]}]},
    ];

    // When
    const results = desiredStates.map((desiredState) => {
      const group = goalHierarchyGroup();
      const action = structuredClone(asObject(asArray(group.actions, "comment actions")[0] ?? null, "comment action"));
      action.operation = "issue.comment";
      action.target_ref = "AIPLATFORM-101";
      action.before_state = {issue_key: "AIPLATFORM-101", project: "AIPLATFORM", issue_type: "Story", requirements: ["REQ-1"], description: "human-authored text"};
      action.desired_state = desiredState;
      group.actions = [action];
      return goalActionSemanticErrors(group);
    });

    // Then
    expect(results.every((errors) => errors.some((error) => error.keyword === "acceptanceCriteriaComment"))).toBe(true);

    const validGroup = goalHierarchyGroup();
    const validAction = structuredClone(asObject(asArray(validGroup.actions, "valid comment actions")[0] ?? null, "valid comment action"));
    validAction.operation = "issue.comment";
    validAction.target_ref = "AIPLATFORM-101";
    validAction.before_state = {issue_key: "AIPLATFORM-101", project: "AIPLATFORM", issue_type: "Story", requirements: ["REQ-1"], description: "human-authored text"};
    validAction.desired_state = {purpose: "acceptance-criteria-gap", content_language: "vi-VN", managed_content_only: true, acceptance_criteria: [criterion()]};
    const uncoveredComment = {...validGroup, actions: [validAction]};
    const validChildren = asArray(validGroup.actions, "valid comment children").slice(2, 4).map((value) => structuredClone(asObject(value, "valid comment child")));
    for (const child of validChildren) asObject(child.desired_state ?? null, "valid comment child state").parent_ref = "AIPLATFORM-101";
    validGroup.actions = [validAction, ...validChildren];
    expect(goalActionSemanticErrors(uncoveredComment).some((error) => error.keyword === "goalAcceptanceSubtaskCoverage")).toBe(true);
    expect(goalActionSemanticErrors(validGroup)).toEqual([]);

    const mismatchedSnapshot = structuredClone(validGroup);
    asObject(asObject(asArray(mismatchedSnapshot.actions, "mismatched comment actions")[0] ?? null, "mismatched comment action").before_state ?? null, "mismatched comment before state").issue_key = "AIPLATFORM-999";
    expect(goalActionSemanticErrors(mismatchedSnapshot).some((error) => error.keyword === "acceptanceCriteriaComment")).toBe(true);

    const targetAlreadyHasCriteria = structuredClone(validGroup);
    asObject(asObject(asArray(targetAlreadyHasCriteria.actions, "existing-criteria comment actions")[0] ?? null, "existing-criteria comment action").before_state ?? null, "existing-criteria comment before state").acceptance_criteria = [criterion()];
    expect(goalActionSemanticErrors(targetAlreadyHasCriteria).some((error) => error.keyword === "acceptanceCriteriaComment")).toBe(true);

    const crossProject = structuredClone(validGroup);
    const crossProjectAction = asObject(asArray(crossProject.actions, "cross-project comment actions")[0] ?? null, "cross-project comment action");
    crossProjectAction.target_ref = "OTHER-101";
    crossProjectAction.before_state = {issue_key: "OTHER-101", project: "OTHER", issue_type: "Story", requirements: ["REQ-1"]};
    expect(goalActionSemanticErrors(crossProject).some((error) => error.keyword === "acceptanceCriteriaComment")).toBe(true);

    for (const issueType of ["Epic", "Sub-task"] as const) {
      const wrongRole = structuredClone(validGroup);
      const wrongRoleAction = asObject(asArray(wrongRole.actions, "wrong-role actions")[0] ?? null, "wrong-role action");
      wrongRoleAction.before_state = {issue_key: "AIPLATFORM-101", project: "AIPLATFORM", issue_type: issueType, description: "human-authored text"};
      expect(goalActionSemanticErrors(wrongRole).some((error) => error.keyword === "acceptanceCriteriaComment")).toBe(true);
    }
  });
});
