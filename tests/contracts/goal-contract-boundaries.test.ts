import { describe, expect, test } from "vitest";

import { asArray, asObject, asString, invariant, readJson, validateJson, type JsonObject } from "../../src/contracts.js";
import { confluenceGoalContractViolations } from "../../src/goal-rules.js";
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
        case "duplicate-goal-ref":
          asObject(stories[1] ?? null, "second Goal").draft_ref = "story-1";
          break;
        case "one-subtask":
          value.subtasks = [subtasks[0] ?? null];
          break;
        case "duplicate-subtask-ref":
          asObject(subtasks[1] ?? null, "second Sub-task").draft_ref = "subtask-1";
          break;
        case "zero-estimate":
          if (subtask !== null) subtask.estimate_hours = 0;
          break;
        case "oversized-estimate":
          if (subtask !== null) subtask.estimate_hours = 5;
          break;
        case "uncovered-acceptance":
          asObject(asObject(value.traceability ?? null, "traceability").acceptance_criteria ?? null, "acceptance traceability");
          asObject(value.traceability ?? null, "traceability").acceptance_criteria = {"AC-9": ["subtask-1"]};
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
});
