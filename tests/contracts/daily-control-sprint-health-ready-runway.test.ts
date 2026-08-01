import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson } from "../../src/contracts.js";
import { dailyNextPriority, runwayRecoveryViolations, sprintHealth } from "../../src/workflow-rules.js";
describe("daily-control", () => {
  test("WIP congestion precedes new work and unknown owner remains unknown", () => {
    const data = asObject(asObject(readJson("tests/fixtures/workflows/daily.json"), "daily").data ?? null, "data");
    expect(dailyNextPriority(data, 3)).toBe("clear review queue");
    const commitment = asObject(asArray(data.commitments, "commitments")[0] ?? null, "commitment");
    expect(commitment.owner).toBe("not verified");
  });
});
describe("sprint-health and ready-runway", () => {
  test("goal block is red and N+1 cannot hide empty N+2", () => {
    const cases = asArray(asObject(readJson("tests/fixtures/workflows/health-runway.json"), "flow").data, "cases").map((value) => asObject(value, "case"));
    expect(sprintHealth(asObject(cases.find((item) => item.case === "goal-blocked") ?? null, "goal blocked"))).toBe("Red");
    expect(sprintHealth(asObject(cases.find((item) => item.case === "no-active") ?? null, "no active sprint"))).toBe("Not verified");
    expect(sprintHealth({ active_sprint: "Sprint 7", evidence_complete: true })).toBe("Green");
    const runway = asObject(cases.find((item) => item.case === "runway") ?? null, "runway");
    expect(runwayRecoveryViolations(runway)).toEqual([]);
    expect(runwayRecoveryViolations({ readiness_gaps: [{ story: "OTHER-1", subtask: "", gap: "", recovery_action: "", expected_readiness_effect: "" }] })).toEqual(["missing-story", "missing-subtask", "missing-gap", "missing-action", "missing-effect"]);
  });
});
