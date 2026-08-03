import { describe, expect, test } from "vitest";

import { jiraReadBackMatches } from "../../src/action-rules.js";
import { asArray, asObject, parseFrontmatter, readJson, readText, validateJson, type JsonObject } from "../../src/contracts.js";
import { goalHierarchyGroup } from "./goal-hierarchy-fixture.js";

const PRESERVATION = {policy_ref: ".kilo/config/jiraman.json#/language/preserved_literal_kinds", mode: "exact"};

function actionGroup(): JsonObject {
  return asObject(readJson("tests/fixtures/actions/valid.json"), "valid action group");
}

function firstAction(group: JsonObject): JsonObject {
  return asObject(asArray(group.actions, "actions")[0] ?? null, "action");
}

describe("Vietnamese Jira apply contract", () => {
  test("requires vi-VN and literal metadata for create, user-facing update, and comment", () => {
    const valid = actionGroup();
    expect(validateJson("action-group.schema.json", valid).valid).toBe(true);

    const missingLanguage = structuredClone(valid);
    delete asObject(firstAction(missingLanguage).desired_state ?? null, "desired state").content_language;
    const missingPreservation = structuredClone(valid);
    delete asObject(firstAction(missingPreservation).desired_state ?? null, "desired state").literal_preservation;

    expect(validateJson("action-group.schema.json", missingLanguage).valid).toBe(false);
    expect(validateJson("action-group.schema.json", missingPreservation).valid).toBe(false);
  });

  test("binds an English override to one immutable action ID", () => {
    const overridden = actionGroup();
    const action = firstAction(overridden);
    const desired = asObject(action.desired_state ?? null, "desired state");
    desired.content_language = "en-US";
    desired.language_override = {
      requested_language: "en-US",
      scope_type: "jira-action",
      scope_ref: action.id ?? "",
      source: "explicit-user-request",
      evidence_reference: "user-request-2026-08-03",
    };
    const leaked = structuredClone(overridden);
    asObject(firstAction(leaked).desired_state ?? null, "desired state").language_override = {
      requested_language: "en-US",
      scope_type: "jira-action",
      scope_ref: "PMA-20260801-99",
      source: "explicit-user-request",
      evidence_reference: "user-request-2026-08-03",
    };

    expect(validateJson("action-group.schema.json", overridden).valid).toBe(true);
    expect(validateJson("action-group.schema.json", leaked).valid).toBe(false);
  });

  test("protects existing English descriptions unless full translation is separately approved", () => {
    const managed = goalHierarchyGroup();
    const managedAction = firstAction(managed);
    const managedBefore = structuredClone(asObject(managedAction.desired_state ?? null, "Epic state"));
    managedAction.operation = "issue.update";
    managedAction.target_ref = "AIPLATFORM-100";
    managedAction.target_version = "7";
    managedAction.before_state = {...managedBefore, human_content_language: "en-US", description: "Human notes", issue_key: "AIPLATFORM-100"};
    managedAction.desired_state = {
      content_language: "vi-VN",
      literal_preservation: PRESERVATION,
      existing_content_mode: "managed-section-only",
      description_update_mode: "managed-section",
      managed_section: "acceptance-criteria",
      managed_content: "## Tiêu chí nghiệm thu\nAC-1: Giữ nguyên `REQ-1` và `npm run ci`.",
    };

    const translated = goalHierarchyGroup();
    const translatedAction = firstAction(translated);
    const translatedBefore = structuredClone(asObject(translatedAction.desired_state ?? null, "Epic state"));
    translatedAction.operation = "issue.update";
    translatedAction.target_ref = "AIPLATFORM-100";
    translatedAction.target_version = "7";
    translatedAction.risk = "high";
    translatedAction.approval_required = "per-action";
    translatedAction.before_state = {...translatedBefore, human_content_language: "en-US", description: "Keep `REQ-1` and `npm run ci`.", issue_key: "AIPLATFORM-100"};
    translatedAction.desired_state = {
      content_language: "vi-VN",
      literal_preservation: PRESERVATION,
      existing_content_mode: "approved-full-translation",
      description_update_mode: "approved-full-translation",
      description: "Giữ nguyên `REQ-1` và `npm run ci`.",
      translation_authorization: {source: "explicit-user-request", evidence_reference: "user-request-2026-08-03"},
    };

    const unsafe = structuredClone(translated);
    const unsafeAction = firstAction(unsafe);
    unsafeAction.risk = "medium";
    unsafeAction.approval_required = "group";

    expect(validateJson("action-group.schema.json", managed).valid).toBe(true);
    expect(validateJson("action-group.schema.json", translated).valid).toBe(true);
    expect(validateJson("action-group.schema.json", unsafe).valid).toBe(false);
  });

  test("read-back normalizes only CRLF and object key order", () => {
    const approved = {summary: "Khôi phục dữ liệu\r\nGiữ `REQ-1`", labels: ["Ready", "blocked"], fields: {status: "In Progress", command: "npm run ci"}};
    const normalized = {fields: {command: "npm run ci", status: "In Progress"}, labels: ["Ready", "blocked"], summary: "Khôi phục dữ liệu\nGiữ `REQ-1`"};
    const reorderedArray = {...normalized, labels: ["blocked", "Ready"]};
    const translatedLiteral = {...normalized, fields: {command: "npm chạy ci", status: "In Progress"}};

    expect(jiraReadBackMatches(approved, normalized)).toBe(true);
    expect(jiraReadBackMatches(approved, reorderedArray)).toBe(false);
    expect(jiraReadBackMatches(approved, translatedLiteral)).toBe(false);
  });

  test("binds apply to the indexed safe language and read-back contract", () => {
    const index = asObject(readJson("template/docs/project-management/templates/jira/index.json"), "Jira template index");
    const apply = asObject(index.apply_workflow ?? null, "apply workflow");
    const frontmatter = parseFrontmatter(readText("template/.kilo/skills/jiraman-apply-actions/SKILL.md"));

    expect(frontmatter.get("jira_language_contract")).toBe("docs/project-management/templates/jira/index.json#/apply_workflow");
    expect(apply).toEqual({
      name: "jiraman-apply-actions",
      operations: ["issue.create", "issue.update", "issue.comment"],
      default_content_language: "vi-VN",
      override_scope: "single-approved-action",
      existing_ticket_mode: "preserve-human-content",
      read_back_normalization: ["crlf-to-lf", "object-key-order"],
      array_order: "preserve-exact",
      unicode: "preserve-exact",
      live_writes: "approved-safe-test-scope-only",
    });
  });
});
