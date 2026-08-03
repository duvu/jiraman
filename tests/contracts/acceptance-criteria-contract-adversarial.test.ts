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
    const backlog = structuredClone(asObject(asObject(readJson("tests/fixtures/drafts/backlog.json"), "backlog fixture").data ?? null, "backlog"));
    const story = asObject(asArray(backlog.stories, "Goal Stories")[0] ?? null, "Goal Story");
    const item = asObject(asArray(story.acceptance_criteria, "Acceptance Criteria")[0] ?? null, "Acceptance Criterion");
    item.verification = "đạt yêu cầu hoàn toàn";

    // When
    const result = validateJson("backlog-draft.schema.json", backlog);

    // Then
    expect(result.errors.some((error) => error.keyword === "testableAcceptanceCriterion")).toBe(true);
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
});
