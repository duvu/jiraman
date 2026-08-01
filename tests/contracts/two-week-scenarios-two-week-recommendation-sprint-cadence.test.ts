import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson } from "../../src/contracts.js";
describe("two-week-scenarios and two-week-recommendation", () => {
  test("scenarios differ and hypotheses are never feasible commitments", () => {
    const data = asObject(asObject(readJson("tests/fixtures/deliverables/cases.json"), "deliverables").data ?? null, "data");
    const candidates = asArray(data.candidates, "candidates").map((value) => asObject(value, "candidate"));
    expect(candidates.find((item) => item.class === "New hypothesis")?.capacity_fit).toBe("not feasible");
    const names = asArray(data.scenarios, "scenarios").map((value) => asObject(value, "scenario").name);
    expect(new Set(names).size).toBe(3);
    expect(asObject(data.page_proposal ?? null, "proposal").current_version).toBe(2);
  });
});
describe("sprint-cadence", () => {
  test("Done differs from accepted and experiments are bounded", () => {
    const data = asObject(asObject(readJson("tests/fixtures/workflows/sprint-cadence.json"), "cadence").data ?? null, "data");
    expect(asObject(data.review ?? null, "review").accepted_outcome).toBe(false);
    expect(asArray(asObject(data.retrospective ?? null, "retrospective").experiments, "experiments").length).toBeLessThanOrEqual(3);
  });
});
