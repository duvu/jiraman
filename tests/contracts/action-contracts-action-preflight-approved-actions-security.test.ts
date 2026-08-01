import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";
import { approvalSelectionAllowed, canonicalPayloadHash, canTransition, dependencyOrder, dependentWritesAllowed, evaluatePreflight, semanticallyEqual, targetPreflightBlockers, verificationOutcome, type PreflightInput, type TargetPreflightInput } from "../../src/action-rules.js";
import { asArray, asObject, asString, readJson, requireValid, validDateTime, validateJson, type JsonObject, type JsonValue } from "../../src/contracts.js";
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

function targetPreflightInput(value: JsonObject): TargetPreflightInput {
  const kind = value.kind;
  if (kind !== "existing" && kind !== "create") throw new Error("invalid target kind");
  return {
    kind,
    targetReadable: asBoolean(value.targetReadable, "targetReadable"),
    containerReadable: asBoolean(value.containerReadable, "containerReadable"),
    duplicateAbsent: asBoolean(value.duplicateAbsent, "duplicateAbsent"),
    draftReferenceUnique: asBoolean(value.draftReferenceUnique, "draftReferenceUnique"),
    dependenciesResolvable: asBoolean(value.dependenciesResolvable, "dependenciesResolvable"),
  };
}

describe("action-contracts", () => {
  test("valid envelopes pass and high risk has per-action approval", () => {
    requireValid("action-group.schema.json", "tests/fixtures/actions/valid.json");
    const invalid = validateJson("action-group.schema.json", readJson("examples/action-group.invalid.json"));
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: "/project", keyword: "const", schemaPath: "#/properties/project/const" }),
      expect.objectContaining({ instancePath: "/actions/0/approval_required", keyword: "const", schemaPath: "#/definitions/action/allOf/0/then/properties/approval_required/const" }),
    ]));
    const invalidDate = validateJson("action-group.schema.json", readJson("examples/action-group.invalid-date.json"));
    expect(invalidDate.valid).toBe(false);
    expect(invalidDate.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: "/created_at", keyword: "format", schemaPath: "#/properties/created_at/format" }),
    ]));
    requireValid("audit-record.schema.json", "tests/fixtures/actions/audit-record.valid.json");
    expect(validDateTime("2026-08-02T07:00:00+07:00")).toBe(true);
    const high = asObject(readJson("tests/fixtures/actions/high-risk-approved.json"), "high");
    const proposed = asObject(readJson("tests/fixtures/actions/valid.json"), "proposed");
    const action = asObject(asArray(high.actions, "actions")[0] ?? null, "action");
    expect(action.approval_required).toBe("per-action");
    expect(asArray(asObject(high.approval ?? null, "approval").approved_action_ids, "ids")).toContain(action.id);
    expect(high.payload_hash).toBe(canonicalPayloadHash(asArray(high.actions, "actions")));
    expect(asObject(high.approval ?? null, "approval").payload_hash).toBe(high.payload_hash);
    expect(proposed.status).toBe("proposed");
    expect(asArray(asObject(proposed.approval ?? null, "approval").approved_action_ids, "proposed ids")).toEqual([]);
    expect(proposed.payload_hash).toBe(canonicalPayloadHash(asArray(proposed.actions, "proposed actions")));

    const incompleteApproval = validateJson("action-group.schema.json", readJson("tests/fixtures/actions/high-risk-approved-invalid.json"));
    expect(incompleteApproval.valid).toBe(false);
    expect(incompleteApproval.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: "/approval/group_approved_by", keyword: "type", schemaPath: "#/allOf/0/then/properties/approval/properties/group_approved_by/type" }),
      expect.objectContaining({ instancePath: "/approval/approved_at", keyword: "type", schemaPath: "#/allOf/0/then/properties/approval/properties/approved_at/type" }),
      expect.objectContaining({ instancePath: "/approval/payload_hash", keyword: "type", schemaPath: "#/allOf/0/then/properties/approval/properties/payload_hash/type" }),
      expect.objectContaining({ instancePath: "/approval/approved_action_ids", keyword: "approvalActionIds", schemaPath: "#/x-action-group-approval/approved-action-ids" }),
    ]));
  });

  test("create preflight and complete PMA selection are executable contracts", () => {
    const fixture = asObject(readJson("tests/fixtures/actions/create-preflight.json"), "create preflight");
    const data = asObject(fixture.data ?? null, "create data");
    for (const value of asArray(data.target_cases, "target cases")) {
      const item = asObject(value, "target case");
      expect(targetPreflightBlockers(targetPreflightInput(asObject(item.input ?? null, "target input"))), asString(item.case, "case")).toEqual(
        asArray(item.expected_violations, "target violations").map((violation) => asString(violation, "violation")),
      );
    }
    const dependencyActions = asArray(data.dependency_actions, "dependency actions").map((value) => {
      const action = asObject(value, "dependency action");
      return { id: asString(action.id, "dependency ID"), dependencies: asArray(action.dependencies, "dependencies").map((dependency) => asString(dependency, "dependency")) };
    });
    const expected = asObject(fixture.expected ?? null, "create expected");
    expect(dependencyOrder(dependencyActions)).toEqual(asArray(expected.dependency_order, "dependency order").map((id) => asString(id, "dependency ID")));
    const approval = asObject(data.approval_selection ?? null, "approval selection");
    const groupIds = asArray(approval.group_action_ids, "group IDs").map((id) => asString(id, "group ID"));
    const complete = asArray(approval.complete_pma_ids, "complete IDs").map((id) => asString(id, "complete ID"));
    const partial = asArray(approval.partial_pma_ids, "partial IDs").map((id) => asString(id, "partial ID"));
    expect(approvalSelectionAllowed(groupIds, complete, false, true)).toBe(asBoolean(expected.complete_pma_allowed, "complete PMA"));
    expect(approvalSelectionAllowed(groupIds, partial, false, true)).toBe(asBoolean(expected.partial_pma_allowed, "partial PMA"));
    expect(approvalSelectionAllowed(groupIds, [], true, true)).toBe(asBoolean(expected.high_risk_group_allowed, "high-risk group"));
    expect(approvalSelectionAllowed(groupIds, [], true, false)).toBe(asBoolean(expected.low_risk_group_allowed, "low-risk group"));
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
    expect(canTransition("proposed", "approved")).toBe(asBoolean(operational.proposal_transition_allowed, "proposal transition"));
    expect(canTransition("applied", "applying")).toBe(asBoolean(operational.replay_transition_allowed, "replay transition"));
    expect(dependentWritesAllowed(true, "failure")).toBe(asBoolean(operational.dependent_write_after_failure, "dependent write"));
    expect(dependentWritesAllowed(true, "not-started")).toBe(false);
    expect(dependentWritesAllowed(true, "success")).toBe(true);
    expect(verificationOutcome("success", false)).toBe(asString(operational.mismatch_outcome, "mismatch outcome"));
    const ordering = asObject(asObject(readJson("tests/fixtures/actions/response-ordering.json"), "ordering").data ?? null, "ordering data");
    expect(semanticallyEqual(ordering.left ?? null, ordering.right ?? null)).toBe(true);
  });

  test("sensitive canaries are rejected from every package surface and sanitized before output", () => {
    const marker = ["TEST", "ONLY"].join("_");
    const secret = marker + "_" + "x".repeat(24);
    const opaque = "x".repeat(36);
    const privateKeyBody = "A".repeat(64);
    const canaries: ReadonlyArray<readonly [string, string]> = [
      ["fixture.json", ["Author", "ization: Bearer ", secret, "-fixture"].join("")],
      ["action-state.json", ["client_", "secret=", secret, "-action"].join("")],
      ["report.md", ["Cook", "ie: sid=", secret, "-report"].join("")],
      ["package-output.log", ["pass", "word=", secret, "-package"].join("")],
      ["github-token.log", ["g", "hp_", opaque].join("")],
      ["github-pat.log", ["github", "_pat_", opaque].join("")],
      ["npm-token.log", ["np", "m_", opaque].join("")],
      ["slack-token.log", ["xo", "xb-", opaque].join("")],
      ["jwt.log", ["ey", "J", opaque, ".", opaque, ".", opaque].join("")],
      ["google-key.log", ["AI", "za", opaque].join("")],
      ["credential-url.log", ["https://", "user:", opaque, "@example.com"].join("")],
      ["private-key.log", ["-----BEGIN ", "PRIVATE KEY-----\n", privateKeyBody, "\n-----END ", "PRIVATE KEY-----"].join("")],
      ["provider-token.log", ["GITHUB", "_TOKEN=", opaque].join("")],
      ["aws-secret-access-key.log", ["AWS_SECRET", "_ACCESS_KEY=", opaque].join("")],
      ["quoted-multiline-provider.log", ["GITHUB", "_TOKEN=\"\n", opaque, "\n\""].join("")],
      ["unquoted-multiline-provider.log", ["GITHUB", "_TOKEN=\n", opaque].join("")],
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
      for (const [, canary] of canaries) expect(output).not.toContain(canary);
      expect(output).not.toContain(privateKeyBody);
      expect(output).not.toContain(opaque);
      expect(output.match(/\[REDACTED SENSITIVE LINE\]/g)?.length ?? 0).toBeGreaterThanOrEqual(canaries.length);
      expect(output).toContain("safe diagnostic");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
