import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";
import { canonicalPayloadHash, canTransition, dependentWritesAllowed, evaluatePreflight, semanticallyEqual, verificationOutcome, type PreflightInput } from "../../src/action-rules.js";
import { asArray, asObject, asString, readJson, requireInvalid, requireValid, validDateTime, type JsonObject, type JsonValue } from "../../src/contracts.js";
import { findSensitiveValues } from "../../src/scan-secrets.js";

function asBoolean(value: JsonValue | undefined, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(label + " must be a boolean");
  return value;
}

function asPreflightStatus(value: JsonValue | undefined): PreflightInput["status"] {
  if (value === "proposed" || value === "approved" || value === "rejected" || value === "stale" || value === "applied") return value;
  throw new Error("invalid preflight status");
}

function preflightInput(value: JsonObject): PreflightInput {
  const hours = value.subtaskHours;
  if (hours !== null && typeof hours !== "number") throw new Error("subtaskHours must be a number or null");
  return {
    status: asPreflightStatus(value.status),
    expired: asBoolean(value.expired, "expired"),
    payloadHashMatches: asBoolean(value.payloadHashMatches, "payloadHashMatches"),
    scopeAllowed: asBoolean(value.scopeAllowed, "scopeAllowed"),
    approvalComplete: asBoolean(value.approvalComplete, "approvalComplete"),
    targetFresh: asBoolean(value.targetFresh, "targetFresh"),
    hierarchyValid: asBoolean(value.hierarchyValid, "hierarchyValid"),
    subtaskHours: hours,
    ownershipAllowed: asBoolean(value.ownershipAllowed, "ownershipAllowed"),
    fieldsExact: asBoolean(value.fieldsExact, "fieldsExact"),
    dependenciesResolved: asBoolean(value.dependenciesResolved, "dependenciesResolved"),
  };
}

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
    expect(high.payload_hash).toBe(canonicalPayloadHash(asArray(high.actions, "actions")));
    expect(asObject(high.approval ?? null, "approval").payload_hash).toBe(high.payload_hash);
  });
});
describe("action-preflight approved-actions security", () => {
  test("all prohibited lifecycle cases block before write", () => {
    const fixture = asObject(readJson("tests/fixtures/actions/lifecycle.json"), "lifecycle");
    const data = asObject(fixture.data ?? null, "lifecycle data");
    const base = asObject(data.base ?? null, "lifecycle base");
    for (const value of asArray(data.cases, "lifecycle cases")) {
      const item = asObject(value, "lifecycle case");
      const input = preflightInput({ ...base, ...asObject(item.override ?? null, "lifecycle override") });
      const expected = asObject(item.expected ?? null, "lifecycle expected");
      expect(evaluatePreflight(input), asString(item.case, "case")).toEqual({
        allowed: asBoolean(expected.allowed, "allowed"),
        violations: asArray(expected.violations, "violations").map((violation) => asString(violation, "violation")),
      });
    }
    const operational = asObject(fixture.expected ?? null, "lifecycle operational expectations");
    expect(canTransition("applied", "applying")).toBe(asBoolean(operational.replay_transition_allowed, "replay transition"));
    expect(dependentWritesAllowed(true, "failure")).toBe(asBoolean(operational.dependent_write_after_failure, "dependent write"));
    expect(verificationOutcome("success", false)).toBe(asString(operational.mismatch_outcome, "mismatch outcome"));
    const ordering = asObject(asObject(readJson("tests/fixtures/actions/response-ordering.json"), "ordering").data ?? null, "ordering data");
    expect(semanticallyEqual(ordering.left ?? null, ordering.right ?? null)).toBe(true);
  });

  test("sensitive canaries are rejected from every package surface and sanitized before output", () => {
    const marker = ["TEST", "ONLY"].join("_");
    const secret = marker + "_" + "x".repeat(24);
    const canaries: ReadonlyArray<readonly [string, string]> = [
      ["fixture.json", ["Author", "ization: Bearer ", secret, "-fixture"].join("")],
      ["action-state.json", ["client_", "secret=", secret, "-action"].join("")],
      ["report.md", ["Cook", "ie: sid=", secret, "-report"].join("")],
      ["package-output.log", ["pass", "word=", secret, "-package"].join("")],
    ];
    for (const [surface, canary] of canaries) expect(findSensitiveValues(canary), surface).not.toEqual([]);
    expect(findSensitiveValues("authorization=redacted; cookie=redacted")).toEqual([]);
    const directory = mkdtempSync(join(tmpdir(), "jiraman-security-"));
    try {
      const packageRoot = join(directory, "package");
      mkdirSync(packageRoot);
      for (const [path, canary] of canaries) writeFileSync(join(packageRoot, path), canary + "\n");
      const scan = spawnSync("./scripts/scan_package_sensitive.sh", [packageRoot], { encoding: "utf8" });
      expect(scan.status).toBe(1);
      for (const [path] of canaries) expect(scan.stderr).toContain(path);
      expect(scan.stderr).not.toContain(secret);

      const raw = join(directory, "raw.log");
      const sanitized = join(directory, "sanitized.log");
      writeFileSync(raw, canaries.map(([, canary]) => canary).join("\n") + "\nsafe diagnostic\n");
      const sanitize = spawnSync("./scripts/sanitize_ci_log.sh", [raw, sanitized], { encoding: "utf8" });
      expect(sanitize.status).toBe(0);
      const output = readFileSync(sanitized, "utf8");
      expect(output).not.toContain(secret);
      expect(output.match(/\[REDACTED SENSITIVE LINE\]/g)).toHaveLength(canaries.length);
      expect(output).toContain("safe diagnostic");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
