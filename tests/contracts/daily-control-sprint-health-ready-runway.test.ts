import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson } from "../../src/contracts.js";
describe("daily-control", () => {
  test("WIP congestion precedes new work and unknown owner remains unknown", () => {
    const data = asObject(asObject(readJson("tests/fixtures/workflows/daily.json"), "daily").data ?? null, "data");
    expect(asArray(data.recommendation_order, "order")[0]).toBe("clear review queue");
    const commitment = asObject(asArray(data.commitments, "commitments")[0] ?? null, "commitment");
    expect(commitment.owner).toBe("not verified");
  });
});
describe("sprint-health and ready-runway", () => {
  test("goal block is red and N+1 cannot hide empty N+2", () => {
    const cases = asArray(asObject(readJson("tests/fixtures/workflows/health-runway.json"), "flow").data, "cases").map((value) => asObject(value, "case"));
    expect(cases.find((item) => item.case === "goal-blocked")?.health).toBe("Red");
    expect(cases.find((item) => item.case === "runway")?.n2).toBe(0);
    expect(cases.find((item) => item.case === "unknown-capacity")?.unit).toBe("not verified");
  });
});
