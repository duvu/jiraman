import { expect, test } from "vitest";
import { readJson, readText, requireInvalid, requireValid } from "../../src/contracts.js";
import { checklistViolations, REQUIRED_RELEASE_GATES } from "../../src/release-rules.js";
import { sensitiveKeyViolations } from "../../src/security-rules.js";
test("run-records retain only privacy-safe correlation fields", () => {
  requireValid("run-record.schema.json", "tests/fixtures/run-records/valid.json");
  requireInvalid("run-record.schema.json", "tests/fixtures/run-records/invalid.json");
  expect(sensitiveKeyViolations(readJson("tests/fixtures/run-records/valid.json"))).toEqual([]);
});

test("release checklist requires structural gate and smoke coverage", () => {
  const valid = readText("docs/release-checklist.md");
  expect(checklistViolations(valid)).toEqual([]);
  const markerOnly = REQUIRED_RELEASE_GATES.map((gate) => "- [ ] <!-- gate:" + gate + " -->").join("\n");
  expect(checklistViolations(markerOnly).length).toBeGreaterThan(0);
  const duplicate = valid + "\n" + (valid.split("\n").find((line) => line.includes("gate:security")) ?? "");
  expect(checklistViolations(duplicate)).toContain("duplicate:security");
  const blank = valid.replace(/(<!--\s*gate:architecture[^>]*-->).*/, "$1");
  expect(checklistViolations(blank)).toContain("malformed:architecture");
  const missingSmoke = valid.replace("failure,read-after-write", "failure");
  expect(checklistViolations(missingSmoke)).toContain("missing-check:manual-smoke:read-after-write");
  const hardenedChecks = [
    ["schemas", "exact-traceability"],
    ["skills", "installed-goal-metadata"],
    ["fixtures", "ready-evidence"],
    ["security", "hostile-paraphrases"],
    ["manual-smoke", "jira-authority"],
  ] as const;
  for (const [gate, check] of hardenedChecks) {
    const omitted = valid.replace(`,${check}`, "");
    expect(checklistViolations(omitted)).toContain(`missing-check:${gate}:${check}`);
  }
});
