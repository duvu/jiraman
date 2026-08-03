import { describe, expect, test } from "vitest";
import { proposalBlockers, semanticallyEqual, type ProposalReadiness } from "../../src/action-rules.js";
import { asArray, asObject, readJson, requireValid, validateJson } from "../../src/contracts.js";
import { extractStableIds, inspectUntrustedContent } from "../../src/security-rules.js";
import { reconciliationDisposition } from "../../src/workflow-rules.js";
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
    expect(reconciliationDisposition(asObject(cases.find((item) => item.case === "exact") ?? null, "exact"))).toBe("reuse");
    expect(reconciliationDisposition(asObject(cases.find((item) => item.case === "partial") ?? null, "partial"))).toBe("split");
    expect(reconciliationDisposition(asObject(cases.find((item) => item.case === "similar-title") ?? null, "similar"))).toBe("review");
    expect(reconciliationDisposition(asObject(cases.find((item) => item.case === "completed") ?? null, "completed"))).toBe("link");
  });
});
describe("epic-story-drafts subtask-decomposition refinement-action-proposals", () => {
  test("drafts are traceable, bounded, and produce schema-valid proposals", () => {
    const matrix = asArray(asObject(asObject(readJson("tests/fixtures/drafts/backlog-matrix.json"), "matrix").data ?? null, "data").cases, "cases").map((value) => asObject(value, "case"));
    expect(matrix.map((item) => item.case)).toEqual(["one-story", "multi-story", "existing-epic", "update-existing-story", "unresolved-decision", "determinism-a", "determinism-b"]);
    for (const item of matrix) expect(validateJson("backlog-draft.schema.json", item.draft ?? null).valid, String(item.case)).toBe(item.expected_valid === true);
    const deterministic = matrix.filter((item) => item.evidence_id === "evidence-deterministic");
    expect(deterministic).toHaveLength(2);
    expect(semanticallyEqual(deterministic[0]?.draft ?? null, deterministic[1]?.draft ?? null)).toBe(true);
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
