import { expect, test } from "vitest";
import { requireInvalid, requireValid, readText } from "../../src/contracts.js";
test("run-records retain only privacy-safe correlation fields", () => {
  requireValid("run-record.schema.json", "tests/fixtures/run-records/valid.json");
  requireInvalid("run-record.schema.json", "tests/fixtures/run-records/invalid.json");
  expect(readText("tests/fixtures/run-records/valid.json")).not.toMatch(/remote_body|authorization|cookie|productivity/i);
});
