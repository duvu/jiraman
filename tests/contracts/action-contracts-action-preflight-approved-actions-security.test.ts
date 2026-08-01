import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson, requireInvalid, requireValid } from "../../src/contracts.js";
describe("action-contracts", () => {
  test("valid envelopes pass and high risk has per-action approval", () => {
    requireValid("action-group.schema.json", "tests/fixtures/actions/valid.json");
    requireInvalid("action-group.schema.json", "examples/action-group.invalid.json");
    const high = asObject(readJson("tests/fixtures/actions/high-risk-approved.json"), "high");
    const action = asObject(asArray(high.actions, "actions")[0] ?? null, "action");
    expect(action.approval_required).toBe("per-action");
    expect(asArray(asObject(high.approval ?? null, "approval").approved_action_ids, "ids")).toContain(action.id);
  });
});
describe("action-preflight approved-actions security", () => {
  test("all prohibited lifecycle cases block before write", () => {
    const cases = asArray(asObject(readJson("tests/fixtures/actions/lifecycle.json"), "lifecycle").data, "cases").map((value) => asObject(value, "case"));
    for (const item of cases.filter((entry) => entry.case !== "valid" && entry.case !== "write-failure" && entry.case !== "verification")) expect(item.writes).toBe(0);
    expect(cases.find((item) => item.case === "write-failure")?.dependent_writes).toBe(0);
    expect(cases.find((item) => item.case === "verification")?.to).toBe("verification-failed");
    expect(asObject(asObject(readJson("tests/fixtures/security/write-boundaries.json"), "security").expected ?? null, "expected").all_block_before_write).toBe(true);
  });
});
