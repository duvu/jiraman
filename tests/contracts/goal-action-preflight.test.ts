import { describe, expect, test } from "vitest";

import { goalPreflightBlockers, type GoalPreflightInput } from "../../src/action-rules.js";
import { asArray, asObject, asString, invariant, readJson } from "../../src/contracts.js";

function asResolution(value: unknown, label: string): "resolved" | "missing" | "ambiguous" {
  invariant(value === "resolved" || value === "missing" || value === "ambiguous", `${label} must be a capability resolution`);
  return value;
}

describe("Goal action preflight", () => {
  test("capability, hierarchy, estimate, payload, and read-back gaps block before write", () => {
    // Given
    const fixture = asObject(asObject(readJson("tests/fixtures/actions/goal-action-preflight.json"), "Goal preflight fixture").data ?? null, "data");
    const cases = asArray(fixture.cases, "cases").map((value) => asObject(value, "case"));

    for (const item of cases) {
      const value = asObject(item.input ?? null, "input");
      const input: GoalPreflightInput = {
        goalFieldsPresent: value.goalFieldsPresent === true,
        parentageVerified: value.parentageVerified === true,
        minimumChildrenPresent: value.minimumChildrenPresent === true,
        dueDateWrite: asResolution(value.dueDateWrite, "due-date write"),
        dueDateRead: asResolution(value.dueDateRead, "due-date read"),
        estimatesValid: value.estimatesValid === true,
        duplicatesAbsent: value.duplicatesAbsent === true,
        payloadUnchanged: value.payloadUnchanged === true,
        readBackMatches: value.readBackMatches === true,
      };

      // When
      const blockers = goalPreflightBlockers(input);

      // Then
      expect(blockers, asString(item.case, "case name")).toEqual(asArray(item.expected_blockers, "expected blockers"));
    }
  });
});
