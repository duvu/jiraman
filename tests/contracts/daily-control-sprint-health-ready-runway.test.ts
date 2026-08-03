import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson } from "../../src/contracts.js";
import { dailyNextPriority, goalHealthState, goalReadinessViolations, runwayRecoveryViolations, sprintHealth } from "../../src/workflow-rules.js";
describe("daily-control", () => {
  test("WIP congestion precedes new work and unknown owner remains unknown", () => {
    const data = asObject(asObject(readJson("tests/fixtures/workflows/daily.json"), "daily").data ?? null, "data");
    expect(dailyNextPriority(data, 3)).toBe("clear review queue");
    const commitment = asObject(asArray(data.commitments, "commitments")[0] ?? null, "commitment");
    expect(commitment.owner).toBe("not verified");
    expect(commitment.goal_name).toBe("Restore v5 upgrades safely");
    expect(commitment.goal_deadline).toBe("2026-08-07");
    expect(dailyNextPriority({...data, incident_or_security: true}, 3)).toBe("incident or security response");
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
    expect(runwayRecoveryViolations({ readiness_gaps: [{ story: "OTHER-1", subtask: "", gap: "", recovery_action: "", expected_readiness_effect: "" }] })).toEqual(["missing-story", "missing-goal-name", "missing-goal-deadline", "missing-goal-dod-gap", "insufficient-subtasks", "missing-subtask", "missing-gap", "missing-action", "missing-effect"]);
    expect(goalHealthState(asObject(cases.find((item) => item.case === "goal-on-track") ?? null, "on track"))).toBe("on track");
    expect(goalHealthState(asObject(cases.find((item) => item.case === "goal-at-risk") ?? null, "at risk"))).toBe("at risk");
    expect(goalHealthState(asObject(cases.find((item) => item.case === "goal-overdue") ?? null, "overdue"))).toBe("overdue");
    expect(goalHealthState(asObject(cases.find((item) => item.case === "done-without-dod") ?? null, "DoD incomplete"))).toBe("DoD incomplete");
    expect(goalHealthState(asObject(cases.find((item) => item.case === "completed-with-evidence") ?? null, "completed"))).toBe("completed with evidence");
    expect(goalReadinessViolations({goal_name: "Incomplete", target_completion_date: "2026-08-07", deadline_evidence_verified: true, definition_of_done: ["Evidence"], epic_parent: "AIPLATFORM-100", subtasks: [{estimate_hours: 3}], traceability_complete: true, dependencies: []})).toContain("insufficient-subtasks");
    expect(goalReadinessViolations({goal_name: "Double counted", target_completion_date: "2026-08-07", deadline_evidence_verified: true, definition_of_done: ["Evidence"], epic_parent: "AIPLATFORM-100", estimate_hours: 5, subtasks: [{estimate_hours: 3}, {estimate_hours: 2}], traceability_complete: true, dependencies: []})).toContain("story-subtask-estimate-double-count");
  });
});
