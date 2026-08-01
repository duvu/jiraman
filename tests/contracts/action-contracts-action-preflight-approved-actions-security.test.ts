import { describe, expect, test } from "vitest";
import { canTransition, dependentWritesAllowed, evaluatePreflight, semanticallyEqual, verificationOutcome, type PreflightInput } from "../../src/action-rules.js";
import { asArray, asObject, readJson, requireInvalid, requireValid, validDateTime } from "../../src/contracts.js";
import { findSensitiveValues } from "../../src/scan-secrets.js";
describe("action-contracts", () => {
  test("valid envelopes pass and high risk has per-action approval", () => {
    requireValid("action-group.schema.json", "tests/fixtures/actions/valid.json");
    requireInvalid("action-group.schema.json", "examples/action-group.invalid.json");
    requireInvalid("action-group.schema.json", "examples/action-group.invalid-date.json");
    requireValid("audit-record.schema.json", "tests/fixtures/actions/audit-record.valid.json");
    expect(validDateTime("2026-08-02T07:00:00+07:00")).toBe(true);
    const high = asObject(readJson("tests/fixtures/actions/high-risk-approved.json"), "high");
    const action = asObject(asArray(high.actions, "actions")[0] ?? null, "action");
    expect(action.approval_required).toBe("per-action");
    expect(asArray(asObject(high.approval ?? null, "approval").approved_action_ids, "ids")).toContain(action.id);
  });
});
describe("action-preflight approved-actions security", () => {
  test("all prohibited lifecycle cases block before write", () => {
    const valid = {
      status: "approved", expired: false, payloadHashMatches: true, scopeAllowed: true, approvalComplete: true,
      targetFresh: true, hierarchyValid: true, subtaskHours: 3, ownershipAllowed: true, fieldsExact: true, dependenciesResolved: true,
    } satisfies PreflightInput;
    expect(evaluatePreflight(valid)).toEqual({ allowed: true, violations: [] });
    const blocked: readonly PreflightInput[] = [
      { ...valid, status: "rejected" }, { ...valid, status: "stale" }, { ...valid, status: "applied" },
      { ...valid, expired: true }, { ...valid, payloadHashMatches: false }, { ...valid, scopeAllowed: false },
      { ...valid, approvalComplete: false }, { ...valid, targetFresh: false }, { ...valid, hierarchyValid: false },
      { ...valid, subtaskHours: 5 }, { ...valid, ownershipAllowed: false }, { ...valid, fieldsExact: false },
      { ...valid, dependenciesResolved: false },
    ];
    for (const input of blocked) expect(evaluatePreflight(input).allowed).toBe(false);
    expect(canTransition("applied", "applying")).toBe(false);
    expect(dependentWritesAllowed(true, "failure")).toBe(false);
    expect(verificationOutcome("success", false)).toBe("verification-failed");
    const ordering = asObject(asObject(readJson("tests/fixtures/actions/response-ordering.json"), "ordering").data ?? null, "ordering data");
    expect(semanticallyEqual(ordering.left ?? null, ordering.right ?? null)).toBe(true);
    const canaries = [
      ["fixture", ["Author", "ization: Bearer TEST_ONLY_TOKEN_123456"].join("")],
      ["action-state", ["client_", "secret=TEST_ONLY_ACTION_123456"].join("")],
      ["report", ["Cook", "ie: sid=TEST_ONLY_REPORT_123456"].join("")],
      ["package-output", ["pass", "word=TEST_ONLY_PACKAGE_123456"].join("")],
    ] as const;
    for (const [surface, canary] of canaries) expect(findSensitiveValues(canary), surface).not.toEqual([]);
    expect(findSensitiveValues("authorization=redacted; cookie=redacted")).toEqual([]);
  });
});
