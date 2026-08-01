import { expect, test } from "vitest";
import { readJson, requireInvalid, requireValid } from "../../src/contracts.js";
import { sensitiveKeyViolations } from "../../src/security-rules.js";
test("run-records retain only privacy-safe correlation fields", () => {
  requireValid("run-record.schema.json", "tests/fixtures/run-records/valid.json");
  requireInvalid("run-record.schema.json", "tests/fixtures/run-records/invalid.json");
  expect(sensitiveKeyViolations(readJson("tests/fixtures/run-records/valid.json"))).toEqual([]);
});
