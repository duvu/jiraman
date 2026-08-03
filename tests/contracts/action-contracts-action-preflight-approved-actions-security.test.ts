import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";
import { approvalSelectionAllowed, canonicalPayloadHash, canTransition, dependencyOrder, dependentWritesAllowed, evaluatePreflight, semanticallyEqual, targetPreflightBlockers, verificationOutcome, type PreflightInput, type TargetPreflightInput } from "../../src/action-rules.js";
import { asArray, asObject, asString, readJson, requireValid, validDateTime, validateJson, type JsonObject, type JsonValue } from "../../src/contracts.js";
import { findSensitiveValues } from "../../src/scan-secrets.js";
import type { JiraLanguageValidationContext } from "../../src/jira-language-rules.js";
import { releaseInvariantNames, sanitizeSensitiveText } from "../../scripts/sensitive-content.mjs";
import { goalHierarchyGroup } from "./goal-hierarchy-fixture.js";

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
  test("canonical payload hashing is independent of host collation", () => {
    const actions: JsonValue[] = [{id: "PMA-20260801-01", status: "proposed", desired_state: {z: 1, "ä": 2, "å": 3, a: 4}}];
    const originalLocaleCompare = String.prototype.localeCompare;
    const hashUnder = (locale: string): string => {
      String.prototype.localeCompare = function (this: string, compareString: string): number {
        return originalLocaleCompare.call(this, compareString, locale);
      };
      return canonicalPayloadHash(actions);
    };
    try {
      expect(hashUnder("en")).toBe(hashUnder("sv"));
    } finally {
      String.prototype.localeCompare = originalLocaleCompare;
    }
  });

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
    const incompleteGroupApproval = validateJson("action-group.schema.json", readJson("tests/fixtures/actions/group-approved-invalid.json"));
    expect(incompleteGroupApproval.valid).toBe(false);
    expect(incompleteGroupApproval.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: "/approval/approved_action_ids", keyword: "approvalActionIds", schemaPath: "#/x-action-group-approval/approved-action-ids" }),
    ]));
    const lifecycleMismatch = validateJson("action-group.schema.json", readJson("tests/fixtures/actions/approved-action-status-invalid.json"));
    expect(lifecycleMismatch.valid).toBe(false);
    expect(lifecycleMismatch.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: "/actions", keyword: "actionLifecycle", schemaPath: "#/x-action-group-lifecycle/status" }),
    ]));

    const forgedHash = structuredClone(high);
    forgedHash.payload_hash = "0".repeat(64);
    asObject(forgedHash.approval ?? null, "forged approval").payload_hash = forgedHash.payload_hash;
    expect(validateJson("action-group.schema.json", forgedHash)).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({instancePath: "/payload_hash", keyword: "canonicalPayloadHash"}),
      ]),
    }));
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
  test("rejecting one PMA terminalizes its group without changing sibling action history", () => {
    const fixture = asObject(readJson("tests/fixtures/actions/partially-rejected.json"), "partially rejected");
    const actions = asArray(fixture.actions, "partially rejected actions");
    const group: JsonObject = { ...fixture, payload_hash: canonicalPayloadHash(actions) };
    const validation = validateJson("action-group.schema.json", group);
    expect(validation).toEqual({ valid: true, errors: [] });
    const rejectedPartialApproval: JsonObject = {
      ...group,
      approval: {
        group_approved_by: "reviewer",
        approved_action_ids: [],
        approved_at: "2026-08-01T00:30:00Z",
        payload_hash: asString(group.payload_hash, "rejected payload hash"),
      },
    };
    const rejectedPartialValidation = validateJson("action-group.schema.json", rejectedPartialApproval);
    expect(rejectedPartialValidation.valid).toBe(false);
    expect(rejectedPartialValidation.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: "/approval", keyword: "approvalTuple", schemaPath: "#/x-action-group-approval/tuple" }),
    ]));
    expect(group.status).toBe("rejected");
    expect(canTransition("rejected", "approved")).toBe(false);

    const directory = mkdtempSync(join(tmpdir(), "jiraman-partial-reject-"));
    try {
      const statePath = join(directory, "state.json");
      const groupId = asString(group.id, "partially rejected group ID");
      const state: JsonObject = {
        schema_version: 5,
        project: "AIPLATFORM",
        pending_action_groups: { [groupId]: group },
        deliverable_candidates: {},
        run_records: [],
        migration: { legacy_state_file: null, reapproval_required_ids: [] },
      };
      writeFileSync(statePath, JSON.stringify(state));
      expect(readFileSync(statePath, "utf8")).toContain("Bản nháp đã bị từ chối");
      const installedValidation = spawnSync("./verify.sh", ["--validate-state-file", statePath], { encoding: "utf8" });
      expect(installedValidation.status, installedValidation.stderr).toBe(0);
      const reuseGroup = structuredClone(group);
      const reuseAction = asObject(asArray(reuseGroup.actions, "reuse actions")[0] ?? null, "reuse action");
      reuseAction.operation = "issue.reuse";
      reuseAction.target_version = "7";
      reuseAction.before_state = {project: "AIPLATFORM", issue_type: "Bug", summary: "Sự cố đã tồn tại"};
      reuseAction.desired_state = {reuse: true};
      reuseGroup.payload_hash = canonicalPayloadHash(asArray(reuseGroup.actions, "reuse actions"));
      const reuseState = {...state, pending_action_groups: {[groupId]: reuseGroup}};
      writeFileSync(statePath, JSON.stringify(reuseState));
      const installedReuseValidation = spawnSync("./verify.sh", ["--validate-state-file", statePath], { encoding: "utf8" });
      expect(installedReuseValidation.status, installedReuseValidation.stderr).toBe(5);

      const missingLanguage = structuredClone(group);
      const missingLanguageAction = asObject(asArray(missingLanguage.actions, "missing language actions")[0] ?? null, "missing language action");
      const missingLanguageDesired = asObject(missingLanguageAction.desired_state ?? null, "missing language desired state");
      delete missingLanguageDesired.content_language;
      delete missingLanguageDesired.literal_preservation;
      missingLanguage.payload_hash = canonicalPayloadHash(asArray(missingLanguage.actions, "missing language actions"));
      writeFileSync(statePath, JSON.stringify({...state, pending_action_groups: {[groupId]: missingLanguage}}));
      const installedLanguageValidation = spawnSync("./verify.sh", ["--validate-state-file", statePath], { encoding: "utf8" });
      expect(installedLanguageValidation.status, installedLanguageValidation.stderr).toBe(5);
      expect(validateJson("state.schema.json", {...state, pending_action_groups: {[groupId]: missingLanguage}}).valid).toBe(false);

      const relabeledOperation = structuredClone(group);
      asObject(asArray(relabeledOperation.actions, "relabeled actions")[0] ?? null, "relabeled action").system = "confluence";
      relabeledOperation.payload_hash = canonicalPayloadHash(asArray(relabeledOperation.actions, "relabeled actions"));
      writeFileSync(statePath, JSON.stringify({...state, pending_action_groups: {[groupId]: relabeledOperation}}));
      const installedRelabeledValidation = spawnSync("./verify.sh", ["--validate-state-file", statePath], {encoding: "utf8"});
      expect(installedRelabeledValidation.status, installedRelabeledValidation.stderr).toBe(5);
      expect(validateJson("state.schema.json", {...state, pending_action_groups: {[groupId]: relabeledOperation}}).valid).toBe(false);

      const untrustedOverride = structuredClone(group);
      const overrideAction = asObject(asArray(untrustedOverride.actions, "override actions")[0] ?? null, "override action");
      const overrideDesired = asObject(overrideAction.desired_state ?? null, "override desired state");
      overrideDesired.content_language = "en-US";
      overrideDesired.language_override = {
        requested_language: "en-US",
        scope_type: "jira-action",
        scope_ref: overrideAction.id ?? "",
        source: "explicit-user-request",
        evidence_reference: "active-user-authorization",
      };
      untrustedOverride.payload_hash = canonicalPayloadHash(asArray(untrustedOverride.actions, "override actions"));
      const overrideState = {...state, pending_action_groups: {[groupId]: untrustedOverride}};
      const trustedOverride: JiraLanguageValidationContext = {trustedUserAuthorizations: [{
        reference: "active-user-authorization",
        capability: "jira-language-override",
        scopeType: "jira-action",
        scopeRef: asString(overrideAction.id, "override action ID"),
        requestedLanguage: "en-US",
      }]};
      expect(validateJson("state.schema.json", overrideState).valid).toBe(false);
      expect(validateJson("state.schema.json", overrideState, trustedOverride).valid).toBe(true);
      writeFileSync(statePath, JSON.stringify(overrideState));
      const installedOverrideValidation = spawnSync("./verify.sh", ["--validate-state-file", statePath], {encoding: "utf8"});
      expect(installedOverrideValidation.status, installedOverrideValidation.stderr).toBe(5);

      const validReuse = goalHierarchyGroup();
      const validReuseAction = asObject(asArray(validReuse.actions, "valid reuse actions")[0] ?? null, "valid reuse action");
      const existingEpic = structuredClone(asObject(validReuseAction.desired_state ?? null, "existing Epic"));
      validReuseAction.operation = "issue.reuse";
      validReuseAction.target_ref = "AIPLATFORM-100";
      validReuseAction.target_version = "7";
      validReuseAction.before_state = {...existingEpic, issue_key: "AIPLATFORM-100", human_content_language: "vi-VN"};
      validReuseAction.desired_state = {reuse: true};
      validReuse.payload_hash = canonicalPayloadHash(asArray(validReuse.actions, "valid reuse actions"));
      expect(validateJson("action-group.schema.json", validReuse)).toEqual({valid: true, errors: []});
      const validReuseId = asString(validReuse.id, "valid reuse group ID");
      writeFileSync(statePath, JSON.stringify({...state, pending_action_groups: {[validReuseId]: validReuse}}));
      const installedValidReuse = spawnSync("./verify.sh", ["--validate-state-file", statePath], {encoding: "utf8"});
      expect(installedValidReuse.status, installedValidReuse.stderr).toBe(0);

      const translationGroup = goalHierarchyGroup();
      const translationAction = asObject(asArray(translationGroup.actions, "translation actions")[0] ?? null, "translation action");
      const existingTranslationState = structuredClone(asObject(translationAction.desired_state ?? null, "translation source state"));
      translationAction.operation = "issue.update";
      translationAction.target_ref = "AIPLATFORM-100";
      translationAction.target_version = "8";
      translationAction.risk = "high";
      translationAction.approval_required = "per-action";
      translationAction.before_state = {...existingTranslationState, issue_key: "AIPLATFORM-100", human_content_language: "en-US", description: "Keep REQ-1."};
      translationAction.desired_state = {
        content_language: "vi-VN",
        literal_preservation: {policy_ref: ".kilo/config/jiraman.json#/language/preserved_literal_kinds", mode: "exact"},
        existing_content_mode: "approved-full-translation",
        description_update_mode: "approved-full-translation",
        description: "Giữ REQ-1.",
        translation_authorization: {source: "explicit-user-request", evidence_reference: "active-translation-authorization"},
      };
      translationGroup.payload_hash = canonicalPayloadHash(asArray(translationGroup.actions, "translation actions"));
      const translationId = asString(translationGroup.id, "translation group ID");
      const translationState = {...state, pending_action_groups: {[translationId]: translationGroup}};
      const trustedTranslation: JiraLanguageValidationContext = {trustedUserAuthorizations: [{
        reference: "active-translation-authorization",
        capability: "jira-full-description-translation",
        scopeType: "jira-action",
        scopeRef: asString(translationAction.id, "translation action ID"),
        requestedLanguage: "vi-VN",
      }]};
      expect(validateJson("state.schema.json", translationState).valid).toBe(false);
      expect(validateJson("state.schema.json", translationState, trustedTranslation).valid).toBe(true);
      writeFileSync(statePath, JSON.stringify(translationState));
      const installedTranslationValidation = spawnSync("./verify.sh", ["--validate-state-file", statePath], {encoding: "utf8"});
      expect(installedTranslationValidation.status, installedTranslationValidation.stderr).toBe(5);

      const vagueAcceptanceGroup = goalHierarchyGroup();
      const vagueAcceptanceAction = asObject(asArray(vagueAcceptanceGroup.actions, "vague Acceptance Criteria actions")[0] ?? null, "vague Acceptance Criteria action");
      vagueAcceptanceAction.operation = "issue.comment";
      vagueAcceptanceAction.target_ref = "AIPLATFORM-101";
      vagueAcceptanceAction.target_version = "2026-08-01T00:00:00Z";
      vagueAcceptanceAction.before_state = {issue_key: "AIPLATFORM-101", project: "AIPLATFORM", issue_type: "Epic", human_content_language: "vi-VN"};
      vagueAcceptanceAction.desired_state = {
        purpose: "acceptance-criteria-gap",
        content_language: "vi-VN",
        literal_preservation: {policy_ref: ".kilo/config/jiraman.json#/language/preserved_literal_kinds", mode: "exact"},
        managed_content_only: true,
        acceptance_criteria: [{id: "AC-1", statement: "Đạt yêu cầu", verification: "Kiểm tra"}],
      };
      vagueAcceptanceGroup.actions = [vagueAcceptanceAction];
      vagueAcceptanceGroup.payload_hash = canonicalPayloadHash(asArray(vagueAcceptanceGroup.actions, "vague Acceptance Criteria actions"));
      const vagueAcceptanceId = asString(vagueAcceptanceGroup.id, "vague Acceptance Criteria group ID");
      const vagueAcceptanceState = {...state, pending_action_groups: {[vagueAcceptanceId]: vagueAcceptanceGroup}};
      expect(validateJson("state.schema.json", vagueAcceptanceState).valid).toBe(false);
      writeFileSync(statePath, JSON.stringify(vagueAcceptanceState));
      const installedVagueAcceptanceValidation = spawnSync("./verify.sh", ["--validate-state-file", statePath], {encoding: "utf8"});
      expect(installedVagueAcceptanceValidation.status, installedVagueAcceptanceValidation.stderr).toBe(5);

      const nonAsciiHashGroup = goalHierarchyGroup();
      const nonAsciiHashAction = asObject(asArray(nonAsciiHashGroup.actions, "non-ASCII hash actions")[0] ?? null, "non-ASCII hash action");
      const nonAsciiHashDesired = asObject(nonAsciiHashAction.desired_state ?? null, "non-ASCII hash desired state");
      Object.assign(nonAsciiHashDesired, {z: 1, "ä": 2, "å": 3, a: 4});
      nonAsciiHashGroup.payload_hash = canonicalPayloadHash(asArray(nonAsciiHashGroup.actions, "non-ASCII hash actions"));
      const nonAsciiHashId = asString(nonAsciiHashGroup.id, "non-ASCII hash group ID");
      const nonAsciiHashState = {...state, pending_action_groups: {[nonAsciiHashId]: nonAsciiHashGroup}};
      expect(validateJson("state.schema.json", nonAsciiHashState)).toEqual({valid: true, errors: []});
      writeFileSync(statePath, JSON.stringify(nonAsciiHashState));
      for (const locale of ["C.UTF-8", "sv_SE.UTF-8"]) {
        const installedNonAsciiHashValidation = spawnSync("./verify.sh", ["--validate-state-file", statePath], {encoding: "utf8", env: {...process.env, LANG: locale}});
        expect(installedNonAsciiHashValidation.status, `${locale}: ${installedNonAsciiHashValidation.stderr}`).toBe(0);
      }

      writeFileSync(statePath, JSON.stringify({ ...state, pending_action_groups: { [groupId]: rejectedPartialApproval } }));
      const rejectedPartialState = spawnSync("./verify.sh", ["--validate-state-file", statePath], { encoding: "utf8" });
      expect(rejectedPartialState.status).toBe(5);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

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
    const yamlCanaries: Array<readonly [string, string]> = [];
    for (const [index, indicator] of ["|2", "|-2", "|+2", ">2", ">-2"].entries()) {
      yamlCanaries.push(["yaml-provider-" + index + ".yml", ["AWS_SECRET", "_ACCESS_KEY: ", indicator, "\n  ", opaque, "\n  continuation"].join("")]);
      yamlCanaries.push(["yaml-generic-" + index + ".yml", ["api_", "key: ", indicator, "\n  ", opaque, "\n  continuation"].join("")]);
      yamlCanaries.push(["yaml-provider-blank-" + index + ".yml", ["AWS_SECRET", "_ACCESS_KEY: ", indicator, "\n\n  ", opaque, "\n  continuation"].join("")]);
      yamlCanaries.push(["yaml-generic-blank-" + index + ".yml", ["api_", "key: ", indicator, "\n\n  ", opaque, "\n  continuation"].join("")]);
    }
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
      ["yaml-block-provider.yml", ["AWS_SECRET", "_ACCESS_KEY: |\n  ", opaque, "\n  continuation"].join("")],
      ["escaped-quote-provider.log", ["GITHUB", "_TOKEN=", "\\", "\"", "\n", opaque, "\n", "\\", "\""].join("")],
      ["generic-quoted-multiline.log", ["pass", "word=\"\n", opaque, "\n\""].join("")],
      ["quoted-provider-key.yml", ["\"AWS_SECRET", "_ACCESS_KEY\": |2\n  ", opaque].join("")],
      ["single-quoted-generic-key.yml", ["'api_", "key': >-2\n  ", opaque].join("")],
      ["quoted-inner-escape.log", ["GITHUB", "_TOKEN=\"\n", opaque, "\\", "\"still-value\n", opaque, "_later\n\""].join("")],
      ["unquoted-multiple-lines.log", ["GITHUB", "_TOKEN=\n", opaque, "\n", opaque, "_later"].join("")],
      ["quoted-even-backslash.log", ["GITHUB", "_TOKEN=\"\n", opaque, "\\\\", "\"\n", opaque, "_tail\n\""].join("")],
      ["unquoted-blank-continuation.log", ["GITHUB", "_TOKEN=\n", opaque, "\n\n", opaque, "_later"].join("")],
      ["authorization-bearer-lf.log", ["Author", "ization: Bearer\n", opaque].join("")],
      ["authorization-basic-crlf.log", ["Author", "ization: Basic\r\n", opaque].join("")],
      ["cookie-lf.log", ["Cook", "ie:\n", opaque].join("")],
      ["set-cookie-crlf.log", ["Set-", "Cook", "ie:\r\n", opaque].join("")],
      ["prefixed-authorization.log", ["prefixAuthor", "ization: Basic\n", opaque].join("")],
      ["prefixed-proxy-authorization.log", ["prefixProxyAuthor", "ization: Bearer\r\n", opaque].join("")],
      ["prefixed-cookie.log", ["prefixCook", "ie:\n", opaque].join("")],
      ...yamlCanaries,
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
      const safeVietnameseDiagnostic = "Xác minh tiếng Việt: khôi phục `REQ-1` bằng `npm run ci`.";
      writeFileSync(raw, canaries.map(([, canary]) => canary).join("\n\n") + `\n\nsafe diagnostic\n${safeVietnameseDiagnostic}\n`);
      const sanitize = spawnSync("./scripts/sanitize_ci_log.sh", [raw, sanitized], { encoding: "utf8" });
      expect(sanitize.status).toBe(0);
      const output = readFileSync(sanitized, "utf8");
      for (const [, canary] of canaries) expect(output).not.toContain(canary);
      expect(output).not.toContain(privateKeyBody);
      expect(output).not.toContain(opaque);
      expect(output.match(/\[REDACTED SENSITIVE LINE\]/g)?.length ?? 0).toBeGreaterThanOrEqual(canaries.length);
      const unicodeRaw = join(directory, "unicode-raw.log");
      const unicodeSanitized = join(directory, "unicode-sanitized.log");
      writeFileSync(unicodeRaw, `${safeVietnameseDiagnostic}\n`);
      const unicodeSanitize = spawnSync("./scripts/sanitize_ci_log.sh", [unicodeRaw, unicodeSanitized], { encoding: "utf8" });
      expect(unicodeSanitize.status).toBe(0);
      expect(readFileSync(unicodeSanitized, "utf8")).toBe(`${safeVietnameseDiagnostic}\n`);
      const combined = sanitizeSensitiveText([
        "prefixAuthor",
        "ization: Bearer\n",
        opaque,
        "\nFAIL invariant=SECURITY_INVARIANTS action blocked",
      ].join(""));
      expect(combined).toContain("FAIL invariant=SECURITY_INVARIANTS");
      expect(combined).not.toContain("action blocked");
      expect(combined).not.toContain(opaque);
      expect(sanitizeSensitiveText("FAIL invariant=SECURITY_INVARIANTS " + opaque)).toBe("FAIL invariant=SECURITY_INVARIANTS");
      expect(sanitizeSensitiveText("FAIL invariant=UNKNOWN " + opaque)).toBe("[REDACTED SENSITIVE LINE]");
      expect(releaseInvariantNames.has("SECURITY_INVARIANTS")).toBe(true);
      const failedGate = spawnSync("./scripts/ci.sh", [
        "--run-invariant",
        "SECURITY_INVARIANTS",
        "node",
        "-e",
        'process.stderr.write(["prefixAuthor", "ization: Bearer\\n", process.argv[1], "\\nuntrusted suffix\\n"].join("")); process.exit(19);',
        opaque,
      ], { encoding: "utf8" });
      expect(failedGate.status).toBe(19);
      const failedGateOutput = sanitizeSensitiveText(failedGate.stdout + failedGate.stderr);
      expect(failedGateOutput).toContain("FAIL invariant=SECURITY_INVARIANTS");
      expect(failedGateOutput).not.toContain("untrusted suffix");
      expect(failedGateOutput).not.toContain(opaque);
      expect(sanitizeSensitiveText("safe diagnostic\nordinary output")).toBe("safe diagnostic\nordinary output");
      expect(sanitizeSensitiveText(safeVietnameseDiagnostic)).toBe(safeVietnameseDiagnostic);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("documented source-template verification command passes", () => {
    const verification = spawnSync("./verify.sh", ["template"], { encoding: "utf8" });
    expect(verification.status, verification.stderr).toBe(0);
    expect(verification.stdout).toContain("Jiraman verification: PASS");
  });
});
