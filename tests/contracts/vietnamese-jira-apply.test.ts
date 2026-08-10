import { describe, expect, test } from "vitest";

import { canonicalPayloadHash, jiraReadBackMatches } from "../../src/action-rules.js";
import { asArray, asObject, asString, parseFrontmatter, readJson, readText, validateJson, type JsonObject } from "../../src/contracts.js";
import { jiraLanguageSemanticErrors, type JiraLanguageValidationContext } from "../../src/jira-language-rules.js";
import { goalHierarchyGroup } from "./goal-hierarchy-fixture.js";

const PRESERVATION = {policy_ref: ".kilo/config/jiraman.json#/language/preserved_literal_kinds", mode: "exact"};

function actionGroup(): JsonObject {
  return asObject(readJson("tests/fixtures/actions/valid.json"), "valid action group");
}

function firstAction(group: JsonObject): JsonObject {
  return asObject(asArray(group.actions, "actions")[0] ?? null, "action");
}

function validateActionGroup(group: JsonObject, context: JiraLanguageValidationContext = {}) {
  group.payload_hash = canonicalPayloadHash(asArray(group.actions, "actions"));
  const approval = asObject(group.approval ?? null, "approval");
  if (typeof approval.payload_hash === "string") approval.payload_hash = group.payload_hash;
  return validateJson("action-group.schema.json", group, context);
}

describe("Vietnamese Jira apply contract", () => {
  test("requires vi-VN and literal metadata for create, user-facing update, and comment", () => {
    const valid = actionGroup();
    expect(validateActionGroup(valid).valid).toBe(true);

    const missingLanguage = structuredClone(valid);
    delete asObject(firstAction(missingLanguage).desired_state ?? null, "desired state").content_language;
    const missingPreservation = structuredClone(valid);
    delete asObject(firstAction(missingPreservation).desired_state ?? null, "desired state").literal_preservation;

    expect(validateActionGroup(missingLanguage).valid).toBe(false);
    expect(validateActionGroup(missingPreservation).valid).toBe(false);
  });

  test("cannot bypass update metadata through a managed narrative field", () => {
    const update = actionGroup();
    const action = firstAction(update);
    action.operation = "issue.update";
    action.desired_state = {validation: "Chạy `npm run ci` và lưu bằng chứng."};

    expect(jiraLanguageSemanticErrors("action-group.schema.json", update).some((error) => error.instancePath.endsWith("/content_language"))).toBe(true);
  });

  test("couples Jira operations to the Jira system before language classification", () => {
    const relabeled = actionGroup();
    const action = firstAction(relabeled);
    const desired = asObject(action.desired_state ?? null, "desired state");
    action.system = "confluence";
    delete desired.content_language;
    delete desired.literal_preservation;

    expect(validateActionGroup(relabeled).valid).toBe(false);
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

    const trustedAuthorization: JiraLanguageValidationContext = {
      trustedUserAuthorizations: [{
        reference: "user-request-2026-08-03",
        capability: "jira-language-override",
        scopeType: "jira-action",
        scopeRef: asString(action.id, "action ID"),
        requestedLanguage: "en-US",
      }],
    };

    expect(validateActionGroup(overridden).valid).toBe(false);
    expect(validateActionGroup(overridden, trustedAuthorization).valid).toBe(true);
    expect(validateActionGroup(leaked).valid).toBe(false);
  });

  test("accepts well-formed BCP 47 override tags only with matching trusted input", () => {
    for (const language of ["zh-Hant", "de-DE-1996", "en-001"]) {
      const overridden = actionGroup();
      const action = firstAction(overridden);
      const desired = asObject(action.desired_state ?? null, "desired state");
      desired.content_language = language;
      desired.language_override = {
        requested_language: language,
        scope_type: "jira-action",
        scope_ref: action.id ?? "",
        source: "explicit-user-request",
        evidence_reference: `local-user-input-${language}`,
      };
      const trustedAuthorization: JiraLanguageValidationContext = {
        trustedUserAuthorizations: [{
          reference: `local-user-input-${language}`,
          capability: "jira-language-override",
          scopeType: "jira-action",
          scopeRef: asString(action.id, "action ID"),
          requestedLanguage: language,
        }],
      };

      expect(validateActionGroup(overridden, trustedAuthorization).valid, language).toBe(true);
    }
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

    expect(validateActionGroup(managed).valid).toBe(true);
    const trustedTranslation: JiraLanguageValidationContext = {
      trustedUserAuthorizations: [{
        reference: "user-request-2026-08-03",
        capability: "jira-full-description-translation",
        scopeType: "jira-action",
        scopeRef: asString(translatedAction.id, "translated action ID"),
        requestedLanguage: "vi-VN",
      }],
    };
    const wrongCapability: JiraLanguageValidationContext = {
      trustedUserAuthorizations: [{
        reference: "user-request-2026-08-03",
        capability: "jira-language-override",
        scopeType: "jira-action",
        scopeRef: asString(translatedAction.id, "translated action ID"),
        requestedLanguage: "vi-VN",
      }],
    };

    expect(validateActionGroup(translated).valid).toBe(false);
    expect(validateActionGroup(translated, wrongCapability).valid).toBe(false);
    expect(validateActionGroup(translated, trustedTranslation).valid).toBe(true);
    expect(validateActionGroup(unsafe).valid).toBe(false);

    const managedFieldExpansion = structuredClone(managed);
    Object.assign(asObject(firstAction(managedFieldExpansion).desired_state ?? null, "managed desired state"), {
      status: "Done",
      assignee: "unexpected-user",
    });
    expect(validateActionGroup(managedFieldExpansion).valid).toBe(false);

    const commentFieldExpansion = actionGroup();
    Object.assign(asObject(firstAction(commentFieldExpansion).desired_state ?? null, "comment desired state"), {
      summary: "Tóm tắt không thuộc bình luận",
      description: "Mô tả không thuộc bình luận",
    });
    expect(validateActionGroup(commentFieldExpansion).valid).toBe(false);

    const vietnameseCommentExpansion = actionGroup();
    const vietnameseCommentAction = firstAction(vietnameseCommentExpansion);
    asObject(vietnameseCommentAction.before_state ?? null, "Vietnamese comment before state").human_content_language = "vi-VN";
    const vietnameseCommentDesired = asObject(vietnameseCommentAction.desired_state ?? null, "Vietnamese comment desired state");
    delete vietnameseCommentDesired.existing_content_mode;
    vietnameseCommentDesired.assignee = "unexpected-user";
    expect(validateActionGroup(vietnameseCommentExpansion).valid).toBe(false);

    const unpairedSummary = structuredClone(translated);
    const unpairedAction = firstAction(unpairedSummary);
    delete asObject(unpairedAction.before_state ?? null, "translation before state").summary;
    asObject(unpairedAction.desired_state ?? null, "translation desired state").summary = "Tóm tắt đã dịch";
    expect(validateActionGroup(unpairedSummary, trustedTranslation).valid).toBe(false);

    const pairedSummary = structuredClone(translated);
    asObject(firstAction(pairedSummary).desired_state ?? null, "translation desired state").summary = "Tóm tắt đã dịch";
    expect(validateActionGroup(pairedSummary, trustedTranslation).valid).toBe(true);

    const translatedFieldExpansion = structuredClone(translated);
    asObject(firstAction(translatedFieldExpansion).desired_state ?? null, "translation desired state").assignee = "unexpected-user";
    expect(validateActionGroup(translatedFieldExpansion, trustedTranslation).valid).toBe(false);
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
      override_authorization_ref: "#/override_authorization",
      existing_ticket_mode: "preserve-human-content",
      read_back_normalization: ["crlf-to-lf", "object-key-order"],
      array_order: "preserve-exact",
      unicode: "preserve-exact",
      live_writes: "approved-safe-test-scope-only",
    });
  });
});
