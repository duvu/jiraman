import { describe, expect, test } from "vitest";

import { asArray, asObject, asString, invariant, readJson, validateJson, type JsonObject } from "../../src/contracts.js";
import { confluenceGoalContractViolations, goalPackageSetViolations } from "../../src/goal-rules.js";
import { goalPackageFixtureViolations } from "../../src/goal-release-rules.js";

describe("Goal contract boundaries", () => {
  test("every adversarial fixture fails at its named structural boundary", () => {
    // Given
    const fixture = asObject(asObject(readJson("tests/fixtures/drafts/goal-invalid-cases.json"), "Goal invalid cases").data ?? null, "case data");
    const cases = asArray(fixture.cases, "cases").map((value) => asObject(value, "case"));
    const validBacklog = asObject(asObject(readJson("tests/fixtures/drafts/backlog.json"), "backlog fixture").data ?? null, "backlog");
    const validSubtasks = asObject(asObject(readJson("tests/fixtures/drafts/subtasks.json"), "subtask fixture").data ?? null, "subtasks");

    for (const item of cases) {
      const caseName = asString(item.case, "case name");
      const schema = asString(item.schema, "schema");
      const value: JsonObject = structuredClone(schema === "backlog-draft.schema.json" ? validBacklog : validSubtasks);
      const stories = schema === "backlog-draft.schema.json" ? asArray(value.stories, "stories") : [];
      const story = stories.length > 0 ? asObject(stories[0] ?? null, "Goal Story") : null;
      const subtasks = schema === "subtask-draft.schema.json" ? asArray(value.subtasks, "Sub-tasks") : [];
      const subtask = subtasks.length > 0 ? asObject(subtasks[0] ?? null, "Sub-task") : null;

      // When
      switch (caseName) {
        case "one-goal":
          value.stories = [stories[0] ?? null];
          asObject(value.epic ?? null, "Epic").story_map = ["story-1"];
          break;
        case "missing-goal-name":
          if (story !== null) delete story.goal_name;
          break;
        case "missing-deadline":
          if (story !== null) delete story.target_completion_date;
          break;
        case "malformed-deadline":
          if (story !== null) story.target_completion_date = "2026-02-30";
          break;
        case "empty-goal-dod":
          if (story !== null) story.definition_of_done = [];
          break;
        case "missing-epic-acceptance":
          delete asObject(value.epic ?? null, "Epic").acceptance_criteria;
          break;
        case "duplicate-goal-acceptance":
          if (story !== null) {
            const criteria = asArray(story.acceptance_criteria, "Goal Acceptance Criteria");
            criteria.push(structuredClone(criteria[0] ?? null));
          }
          break;
        case "vague-goal-acceptance":
          if (story !== null) {
            const criterion = asObject(asArray(story.acceptance_criteria, "Goal Acceptance Criteria")[0] ?? null, "Goal Acceptance Criterion");
            criterion.verification = "đã kiểm tra";
          }
          break;
        case "uncovered-requirement":
          if (story !== null) {
            const criterion = asObject(asArray(story.acceptance_criteria, "Goal Acceptance Criteria")[0] ?? null, "Goal Acceptance Criterion");
            criterion.requirement_refs = ["REQ-999"];
          }
          break;
        case "duplicate-goal-ref":
          asObject(stories[1] ?? null, "second Goal").draft_ref = "story-1";
          break;
        case "one-subtask":
          value.subtasks = [subtasks[0] ?? null];
          break;
        case "invalid-story-ref":
          value.story_ref = "OTHER-101";
          break;
        case "invisible-parent-goal-name":
          asObject(value.goal ?? null, "parent Goal").goal_name = "\u00AD";
          break;
        case "invisible-parent-goal-dod":
          asObject(value.goal ?? null, "parent Goal").definition_of_done = ["\u200E"];
          break;
        case "duplicate-subtask-ref":
          asObject(subtasks[1] ?? null, "second Sub-task").draft_ref = "subtask-1";
          break;
        case "self-subtask-dependency":
          if (subtask !== null) subtask.dependencies = ["subtask-1"];
          break;
        case "missing-subtask-dependency":
          if (subtask !== null) subtask.dependencies = ["subtask-missing"];
          break;
        case "cyclic-subtask-dependency":
          if (subtask !== null) subtask.dependencies = ["subtask-2"];
          asObject(subtasks[1] ?? null, "second Sub-task").dependencies = ["subtask-1"];
          break;
        case "zero-estimate":
          if (subtask !== null) subtask.estimate_hours = 0;
          break;
        case "oversized-estimate":
          if (subtask !== null) subtask.estimate_hours = 5;
          break;
        case "invalid-parent-acceptance":
          if (subtask !== null) subtask.parent_acceptance_criteria_refs = ["AC-999"];
          break;
        case "invalid-parent-requirement":
          for (const value of subtasks) asObject(value, "Sub-task").requirements = ["REQ-999"];
          asObject(value.traceability ?? null, "traceability").requirements = {"REQ-999": subtasks.map((value) => asString(asObject(value, "Sub-task").draft_ref, "Sub-task ref"))};
          break;
        case "unimplemented-goal-acceptance": {
          const goal = asObject(value.goal ?? null, "Goal");
          const criteria = asArray(goal.acceptance_criteria, "Goal Acceptance Criteria");
          const unimplemented = structuredClone(asObject(criteria[0] ?? null, "Goal Acceptance Criterion"));
          unimplemented.id = "AC-2";
          unimplemented.statement = "Bằng chứng khôi phục được lưu trong hồ sơ nghiệm thu";
          criteria.push(unimplemented);
          break;
        }
        case "missing-local-verification":
          if (subtask !== null) {
            const criterion = asObject(asArray(subtask.acceptance_criteria, "local Acceptance Criteria")[0] ?? null, "local Acceptance Criterion");
            delete criterion.verification;
          }
          break;
        case "duplicate-local-acceptance":
          if (subtask !== null) {
            const criteria = asArray(subtask.acceptance_criteria, "local Acceptance Criteria");
            criteria.push(structuredClone(criteria[0] ?? null));
          }
          break;
        case "uncovered-acceptance":
          asObject(asObject(value.traceability ?? null, "traceability").parent_acceptance_criteria ?? null, "acceptance traceability");
          asObject(value.traceability ?? null, "traceability").parent_acceptance_criteria = {"AC-9": ["subtask-1"]};
          break;
        default:
          invariant(false, `unknown Goal boundary case: ${caseName}`);
      }
      const result = validateJson(schema, value);

      // Then
      expect(result.valid, caseName).toBe(false);
      expect(result.errors.some((error) => error.keyword === item.expected_keyword), caseName).toBe(true);
    }
  });

  test("rendered Confluence Goal fixtures expose complete and invalid hierarchies", () => {
    // Given
    const data = asObject(asObject(readJson("tests/fixtures/confluence/goal-contract-rendering.json"), "Goal rendering fixture").data ?? null, "data");
    const valid = asObject(data.valid ?? null, "valid rendering");
    const invalid = asArray(data.invalid, "invalid renderings").map((value) => asObject(value, "invalid rendering"));

    // When
    const validViolations = confluenceGoalContractViolations(valid);
    const invalidViolations = invalid.map(confluenceGoalContractViolations);

    // Then
    expect(validViolations).toEqual([]);
    expect(invalidViolations.every((violations) => violations.length > 0)).toBe(true);
  });

  test("every Goal Story has exactly one matching valid Sub-task package", () => {
    // Given / When
    const violations = goalPackageFixtureViolations();

    // Then
    expect(violations).toEqual([]);
  });

  test("rejects omitted and surplus Sub-task traceability relations", () => {
    // Given
    const valid = asObject(asObject(readJson("tests/fixtures/drafts/subtasks.json"), "subtask fixture").data ?? null, "subtask package");
    const omitted: JsonObject = structuredClone(valid);
    const omittedTraceability = asObject(omitted.traceability ?? null, "omitted traceability");
    omittedTraceability.requirements = {"REQ-1": ["subtask-1"]};
    const surplus: JsonObject = structuredClone(valid);
    const surplusSubtasks = asArray(surplus.subtasks, "surplus Sub-tasks").map((value) => asObject(value, "surplus Sub-task"));
    const surplusSecond = surplusSubtasks[1];
    invariant(surplusSecond !== undefined, "second Sub-task is required");
    surplusSecond.requirements = ["REQ-2"];
    asObject(surplus.traceability ?? null, "surplus traceability").requirements = {
      "REQ-1": ["subtask-1", "subtask-2"],
      "REQ-2": ["subtask-2"],
    };

    // When
    const omittedResult = validateJson("subtask-draft.schema.json", omitted);
    const surplusResult = validateJson("subtask-draft.schema.json", surplus);

    // Then
    expect(omittedResult.valid).toBe(false);
    expect(omittedResult.errors.some((error) => error.keyword === "exactTraceability")).toBe(true);
    expect(surplusResult.valid).toBe(false);
    expect(surplusResult.errors.some((error) => error.keyword === "exactTraceability")).toBe(true);
  });

  test("rejects backlog and package REQ or AC identifier drift", () => {
    // Given
    const backlog = asObject(asObject(readJson("tests/fixtures/drafts/backlog.json"), "backlog fixture").data ?? null, "backlog");
    const first = asObject(asObject(readJson("tests/fixtures/drafts/subtasks.json"), "first package").data ?? null, "first package data");
    const second = asObject(asObject(readJson("tests/fixtures/drafts/subtasks.story-2.json"), "second package").data ?? null, "second package data");
    const requirementDrift: JsonObject = structuredClone(first);
    const requirementSubtasks = asArray(requirementDrift.subtasks, "requirement Sub-tasks").map((value) => asObject(value, "requirement Sub-task"));
    for (const subtask of requirementSubtasks) subtask.requirements = ["REQ-999"];
    asObject(requirementDrift.traceability ?? null, "requirement traceability").requirements = {"REQ-999": requirementSubtasks.map((subtask) => asString(subtask.draft_ref, "Sub-task ref"))};
    const acceptanceDrift: JsonObject = structuredClone(first);
    const acceptanceSubtasks = asArray(acceptanceDrift.subtasks, "acceptance Sub-tasks").map((value) => asObject(value, "acceptance Sub-task"));
    for (const subtask of acceptanceSubtasks) subtask.parent_acceptance_criteria_refs = ["AC-999"];
    asObject(acceptanceDrift.traceability ?? null, "acceptance traceability").parent_acceptance_criteria = {"AC-999": acceptanceSubtasks.map((subtask) => asString(subtask.draft_ref, "Sub-task ref"))};

    // When
    const requirementViolations = goalPackageSetViolations(backlog, [requirementDrift, second]);
    const acceptanceViolations = goalPackageSetViolations(backlog, [acceptanceDrift, second]);

    // Then
    expect(requirementViolations).toContain("story-1:requirements-traceability-mismatch");
    expect(acceptanceViolations).toContain("story-1:acceptance-criteria-traceability-mismatch");
  });
});
