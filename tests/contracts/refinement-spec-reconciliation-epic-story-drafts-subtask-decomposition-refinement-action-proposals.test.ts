import { describe, expect, test } from "vitest";
import { proposalBlockers, type ProposalReadiness } from "../../src/action-rules.js";
import { asArray, asObject, readJson, requireValid, validateJson } from "../../src/contracts.js";
import { extractStableIds, inspectUntrustedContent } from "../../src/security-rules.js";
describe("refinement-spec and reconciliation", () => {
  test("gaps block and partial overlaps preserve uncovered IDs", () => {
    const complete = asObject(asObject(readJson("tests/fixtures/specs/complete.json"), "complete").data ?? null, "complete data");
    const incomplete = asObject(asObject(readJson("tests/fixtures/specs/incomplete.json"), "incomplete").data ?? null, "incomplete data");
    expect(validateJson("specification.schema.json", complete).valid).toBe(true);
    expect(validateJson("specification.schema.json", incomplete).valid).toBe(false);
    const adversarial = asObject(asObject(readJson("tests/fixtures/specs/adversarial.json"), "adversarial").data ?? null, "adversarial data");
    expect(extractStableIds(String(adversarial.content))).toEqual(extractStableIds(String(adversarial.baseline_content)));
    expect(inspectUntrustedContent(String(adversarial.source), String(adversarial.content))?.blockedEffect.length).toBeGreaterThan(0);
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
    for (const path of ["tests/fixtures/drafts/subtasks.oversized.json", "tests/fixtures/drafts/subtasks.untraced.json", "tests/fixtures/drafts/subtasks.unverifiable.json"]) {
      const invalid = asObject(asObject(readJson(path), path).data ?? null, "invalid subtask data");
      expect(validateJson("subtask-draft.schema.json", invalid).valid).toBe(false);
    }
    const blocked = asArray(asObject(asObject(readJson("tests/fixtures/drafts/proposal-blocked.json"), "blocked").data ?? null, "data").cases, "cases");
    for (const value of blocked) {
      const item = asObject(value, "blocked case");
      const readiness: ProposalReadiness = {
        hierarchyValid: item.hierarchy_valid === true,
        uncoveredIds: asArray(item.uncovered_ids, "uncovered IDs").map(String),
        oversizedSubtasks: item.oversized_subtasks === true,
        ambiguousDuplicates: item.ambiguous_duplicates === true,
        unresolvedDecisions: item.unresolved_decisions === true,
        hypothesisReady: item.hypothesis_ready === true,
      };
      expect(proposalBlockers(readiness).length).toBeGreaterThan(0);
    }
    requireValid("action-group.schema.json", "tests/fixtures/actions/valid.json");
  });
});
