import { describe, expect, test } from "vitest";

import { jiraReadBackMatches } from "../../src/action-rules.js";
import { asArray, asObject, asString, readJson, type JsonObject } from "../../src/contracts.js";
import { validateFixtures } from "../../src/fixture-validation.js";
import { jiraLanguageSemanticErrors } from "../../src/jira-language-rules.js";
import { missingChecklistGates, REQUIRED_RELEASE_GATE_CHECKS } from "../../src/release-rules.js";

function fixtureData(): JsonObject {
  return asObject(asObject(readJson("tests/fixtures/language/cases.json"), "language fixture").data ?? null, "language fixture data");
}

function actionGroupFromCase(value: JsonObject): JsonObject {
  return {
    actions: [{
      id: "PMA-20260801-01",
      system: "jira",
      operation: value.operation ?? "",
      target_ref: "AIPLATFORM-101",
      before_state: value.before_state ?? {},
      desired_state: value.desired_state ?? {},
      risk: value.risk ?? "medium",
      approval_required: value.approval_required ?? "group",
    }],
  };
}

describe("release-blocking Vietnamese Jira content", () => {
  test("executes every valid and adversarial language fixture", () => {
    validateFixtures("jira-language-fixtures");
    const data = fixtureData();
    for (const value of asArray(data.valid_action_cases, "valid action cases")) {
      const item = asObject(value, "valid action case");
      expect(jiraLanguageSemanticErrors("action-group.schema.json", actionGroupFromCase(item)), asString(item.name, "case name")).toEqual([]);
    }
    for (const value of asArray(data.invalid_action_cases, "invalid action cases")) {
      const item = asObject(value, "invalid action case");
      expect(jiraLanguageSemanticErrors("action-group.schema.json", actionGroupFromCase(item)).length, asString(item.name, "case name")).toBeGreaterThan(0);
    }
  });

  test("preserves Vietnamese Unicode and technical literals on exact read-back", () => {
    const data = fixtureData();
    for (const value of asArray(data.read_back_matches, "matching read-backs")) {
      const item = asObject(value, "matching read-back");
      expect(jiraReadBackMatches(item.approved ?? null, item.observed ?? null)).toBe(true);
    }
    for (const value of asArray(data.read_back_mismatches, "mismatching read-backs")) {
      const item = asObject(value, "mismatching read-back");
      expect(jiraReadBackMatches(item.approved ?? null, item.observed ?? null)).toBe(false);
    }
  });

  test("keeps language, Unicode, injection, and live acceptance release-blocking", () => {
    expect(REQUIRED_RELEASE_GATE_CHECKS.schemas).toContain("jira-language");
    expect(REQUIRED_RELEASE_GATE_CHECKS.fixtures).toEqual(expect.arrayContaining(["vietnamese-jira-content", "unicode-literals"]));
    expect(REQUIRED_RELEASE_GATE_CHECKS.security).toContain("language-injection");
    expect(REQUIRED_RELEASE_GATE_CHECKS["manual-smoke"]).toEqual(expect.arrayContaining(["vietnamese-jira", "language-override", "existing-english", "unicode-read-back"]));
    expect(missingChecklistGates()).toEqual([]);
  });
});
