import { describe, expect, test } from "vitest";

import { acceptanceCriteriaReadBackMatches } from "../../src/action-rules.js";
import { asArray, asObject, readJson, validateJson, type JsonObject } from "../../src/contracts.js";
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

function readyGoal(): JsonObject {
  return {
    goal_name: "Restore backups",
    target_completion_date: "2026-08-07",
    deadline_evidence_verified: true,
    definition_of_done: ["Restore evidence accepted"],
    epic_parent: "AIPLATFORM-100",
    requirements: ["REQ-1"],
    acceptance_criteria: [criterion()],
    subtasks: [{estimate_hours: 2}, {estimate_hours: 3}],
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
    ];

    // When
    const results = values.map((verification) => {
      const backlog = structuredClone(source);
      const story = asObject(asArray(backlog.stories, "Goal Stories")[0] ?? null, "Goal Story");
      const item = asObject(asArray(story.acceptance_criteria, "Acceptance Criteria")[0] ?? null, "Acceptance Criterion");
      item.verification = verification;
      return validateJson("backlog-draft.schema.json", backlog);
    });

    // Then
    expect(results.every((result) => result.errors.some((error) => error.keyword === "testableAcceptanceCriterion"))).toBe(true);
  });

  test("requires Ready goals to contain requirements and structured criteria", () => {
    // Given
    const missingRequirements = readyGoal();
    delete missingRequirements.requirements;
    const missingCriteria = readyGoal();
    delete missingCriteria.acceptance_criteria;
    const emptyCriteria = readyGoal();
    emptyCriteria.acceptance_criteria = [];

    // When / Then
    for (const goal of [missingRequirements, missingCriteria, emptyCriteria]) {
      expect(goalReadinessViolations(goal)).toContain("incomplete-acceptance-criteria");
    }
  });

  test("compares every approved role-specific criterion field on read-back", () => {
    // Given
    const approvedGoal = [criterion()];
    const changedRequirement = structuredClone(approvedGoal);
    asObject(changedRequirement[0] ?? null, "changed Goal criterion").requirement_refs = ["REQ-999"];
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

    // When / Then
    expect(goalActionSemanticErrors(ordinaryUpdate).some((error) => error.keyword === "goalAcceptanceSubtaskCoverage")).toBe(true);
    expect(goalActionSemanticErrors(externalSubtask).some((error) => error.keyword === "resolvedParentRequirementReference")).toBe(true);
    expect(goalActionSemanticErrors(validExternalSubtask)).toEqual([]);
    expect(goalActionSemanticErrors(forgedAuthority).some((error) => error.keyword === "parentAuthorityPlacement")).toBe(true);
  });

  test("derives AC-gap comment safeguards from an authoritative missing-AC target", () => {
    // Given
    const desiredStates = [
      {body: "Acceptance criteria are okay", managed_content_only: false},
      {purpose: "ordinary-note", body: "Acceptance criteria are okay", managed_content_only: false},
      {purpose: "acceptance-criteria-gap", content_language: "en-US", managed_content_only: false, acceptance_criteria: [criterion()]},
    ];

    // When
    const results = desiredStates.map((desiredState) => {
      const group = goalHierarchyGroup();
      const action = structuredClone(asObject(asArray(group.actions, "comment actions")[0] ?? null, "comment action"));
      action.operation = "issue.comment";
      action.target_ref = "AIPLATFORM-101";
      action.before_state = {project: "AIPLATFORM", issue_type: "Story", description: "human-authored text"};
      action.desired_state = desiredState;
      group.actions = [action];
      return goalActionSemanticErrors(group);
    });

    // Then
    expect(results.every((errors) => errors.some((error) => error.keyword === "acceptanceCriteriaComment"))).toBe(true);
  });
});
