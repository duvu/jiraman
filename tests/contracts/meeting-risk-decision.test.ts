import { expect, test } from "vitest";
import { asObject, readJson, validateJson } from "../../src/contracts.js";
import { governanceDisposition } from "../../src/workflow-rules.js";
test("meeting-risk-decision records preserve ambiguity and duplicate disposition", () => {
  const data = asObject(asObject(readJson("tests/fixtures/governance/meeting-risk-decision.json"), "fixture").data ?? null, "data");
  expect(validateJson("governance.schema.json", data).valid).toBe(true);
  expect(governanceDisposition(data)).toBe("update-link");
  expect(governanceDisposition({ duplicate_search: { result: "none", disposition: "create-proposal" } })).toBe("create-proposal");
  expect(governanceDisposition({ duplicate_search: { result: "ambiguous", disposition: "review" } })).toBe("review");
  expect(asObject(data.decision ?? null, "decision").decision).toBeNull();
});
