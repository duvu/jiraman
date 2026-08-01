import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson } from "../../src/contracts.js";
import { distinctScenarioSelections } from "../../src/security-rules.js";
import { candidateCanCommit, sprintReviewAccepted } from "../../src/workflow-rules.js";
describe("two-week-scenarios and two-week-recommendation", () => {
  test("scenarios differ and hypotheses are never feasible commitments", () => {
    const data = asObject(asObject(readJson("tests/fixtures/deliverables/cases.json"), "deliverables").data ?? null, "data");
    const candidates = asArray(data.candidates, "candidates").map((value) => asObject(value, "candidate"));
    expect(candidateCanCommit(asObject(candidates.find((item) => item.class === "Ready-backed") ?? null, "ready candidate"))).toBe(true);
    expect(candidateCanCommit(asObject(candidates.find((item) => item.class === "New hypothesis") ?? null, "hypothesis"))).toBe(false);
    expect(distinctScenarioSelections(data)).toBe(true);
    expect(asObject(data.page_proposal ?? null, "proposal").current_version).toBe(2);
  });
});
describe("sprint-cadence", () => {
  test("Done differs from accepted and experiments are bounded", () => {
    const data = asObject(asObject(readJson("tests/fixtures/workflows/sprint-cadence.json"), "cadence").data ?? null, "data");
    const review = asObject(data.review ?? null, "review");
    expect(sprintReviewAccepted(review)).toBe(false);
    expect(sprintReviewAccepted({ jira_status: "Done", validation_evidence: "acceptance run passed", accepted_outcome: true })).toBe(true);
    expect(asArray(asObject(data.retrospective ?? null, "retrospective").experiments, "experiments").length).toBeLessThanOrEqual(3);
  });
});
