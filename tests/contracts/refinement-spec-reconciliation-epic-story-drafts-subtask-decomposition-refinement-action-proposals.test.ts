import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson, requireValid } from "../../src/contracts.js";
describe("refinement-spec and reconciliation", () => {
  test("gaps block and partial overlaps preserve uncovered IDs", () => {
    const incomplete = asObject(asObject(readJson("tests/fixtures/specs/incomplete.json"), "spec").expected ?? null, "expected");
    expect(asArray(incomplete.blocking_gaps, "gaps")).toContain("duplicate REQ-1");
    const cases = asArray(asObject(readJson("tests/fixtures/reconciliation/cases.json"), "reconciliation").data, "cases").map((value) => asObject(value, "case"));
    expect(asArray(cases.find((item) => item.case === "partial")?.uncovered, "uncovered")).toEqual(["REQ-2"]);
    expect(cases.find((item) => item.case === "similar-title")?.disposition).toBe("review");
  });
});
describe("epic-story-drafts subtask-decomposition refinement-action-proposals", () => {
  test("drafts are traceable, bounded, and produce schema-valid proposals", () => {
    const backlog = asObject(asObject(readJson("tests/fixtures/drafts/backlog.json"), "backlog").data ?? null, "data");
    expect(asObject(backlog.epic ?? null, "epic").disposition).toBe("reuse");
    const subtasks = asArray(asObject(asObject(readJson("tests/fixtures/drafts/subtasks.json"), "subtasks").data ?? null, "data").subtasks, "subtasks").map((value) => asObject(value, "subtask"));
    expect(subtasks.every((item) => typeof item.estimate_hours === "number" && item.estimate_hours > 0 && item.estimate_hours <= 4)).toBe(true);
    requireValid("action-group.schema.json", "tests/fixtures/actions/valid.json");
  });
});
