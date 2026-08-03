import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson, validateJson, type JsonObject } from "../../src/contracts.js";
import { distinctScenarioSelections } from "../../src/security-rules.js";
import { candidateCanCommit, sprintReviewAccepted } from "../../src/workflow-rules.js";
describe("two-week-scenarios and two-week-recommendation", () => {
  test("scenarios differ and hypotheses are never feasible commitments", () => {
    const data = asObject(asObject(readJson("tests/fixtures/deliverables/cases.json"), "deliverables").data ?? null, "data");
    const candidates = asArray(data.candidates, "candidates").map((value) => asObject(value, "candidate"));
    expect(candidateCanCommit(asObject(candidates.find((item) => item.class === "Ready-backed") ?? null, "ready candidate"))).toBe(true);
    expect(candidateCanCommit(asObject(candidates.find((item) => item.class === "New hypothesis") ?? null, "hypothesis"))).toBe(false);
    expect(distinctScenarioSelections(data)).toBe(true);
  });

  test("Ready-backed candidates require verified deadline specification IDs and concrete traceability", () => {
    // Given
    const data = asObject(asObject(readJson("tests/fixtures/deliverables/cases.json"), "deliverables").data ?? null, "data");
    const candidates = asArray(data.candidates, "candidates").map((value) => asObject(value, "candidate"));
    const ready = asObject(candidates.find((item) => item.class === "Ready-backed") ?? null, "ready candidate");
    const mutations: ReadonlyArray<readonly [string, boolean, (goal: JsonObject) => void]> = [
      ["unverified deadline", true, (goal) => { asObject(goal.target_completion_date_evidence ?? null, "deadline evidence").verified = false; }],
      ["blank specification", true, (goal) => { goal.canonical_spec = ""; }],
      ["empty requirements", true, (goal) => { goal.requirements = []; }],
      ["empty acceptance criteria", true, (goal) => { goal.acceptance_criteria = []; }],
      ["missing requirement map", true, (goal) => { asObject(goal.traceability ?? null, "traceability").requirements = {}; }],
      ["surplus acceptance ID", false, (goal) => { asObject(goal.traceability ?? null, "traceability").acceptance_criteria = {"AC-1": ["AIPLATFORM-102"], "AC-9": ["AIPLATFORM-103"]}; }],
      ["unknown DoD Sub-task", false, (goal) => { asObject(goal.traceability ?? null, "traceability").goal_definition_of_done = {"DOD-1": ["AIPLATFORM-999"]}; }],
    ];

    // When
    const completeSchema = validateJson("deliverable-plan.schema.json", data);
    const results = mutations.map(([name, schemaMustReject, mutate]) => {
      const candidate: JsonObject = structuredClone(ready);
      const goal = asObject(asArray(candidate.goals, "candidate Goals")[0] ?? null, "candidate Goal");
      mutate(goal);
      const candidateData = {...data, candidates: candidates.map((value) => value.id === candidate.id ? candidate : value)};
      return {name, schemaMustReject, schema: validateJson("deliverable-plan.schema.json", candidateData), committable: candidateCanCommit(candidate)};
    });

    // Then
    expect(completeSchema.valid).toBe(true);
    expect(candidateCanCommit(ready)).toBe(true);
    for (const result of results) {
      expect(result.schema.valid, result.name).toBe(!result.schemaMustReject);
      expect(result.committable, result.name).toBe(false);
    }
  });
});
describe("sprint-cadence", () => {
  test("Done differs from accepted and experiments are bounded", () => {
    const data = asObject(asObject(readJson("tests/fixtures/workflows/sprint-cadence.json"), "cadence").data ?? null, "data");
    const review = asObject(data.review ?? null, "review");
    expect(sprintReviewAccepted(review)).toBe(false);
    expect(sprintReviewAccepted({
      jira_status: "Done",
      validation_evidence: "acceptance run passed",
      accepted_outcome: true,
      acceptance_criteria_satisfied: true,
      subtasks_satisfied: true,
      goal_definition_of_done_evidence: [{ condition: "DOD-1", satisfied: true, evidence: "rollback drill passed" }],
    })).toBe(true);
    expect(asArray(asObject(data.retrospective ?? null, "retrospective").experiments, "experiments").length).toBeLessThanOrEqual(3);
  });
});
