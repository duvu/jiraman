import { type ErrorObject } from "ajv";

import { type JsonObject, type JsonValue } from "./contracts.js";

interface ScopedContent {
  readonly path: string;
  readonly scopeType: "jira-draft" | "jira-action";
  readonly scopeRef: string;
  readonly value: JsonObject;
}

export interface JiraLanguageRequest {
  readonly requestedLanguage: string;
  readonly explicit: boolean;
}

export type JiraAuthorizationCapability = "jira-full-description-translation" | "jira-language-override";

export interface TrustedUserAuthorization {
  readonly reference: string;
  readonly capability: JiraAuthorizationCapability;
  readonly scopeType: "jira-draft" | "jira-action";
  readonly scopeRef: string;
  readonly requestedLanguage: string;
}

export interface JiraLanguageValidationContext {
  readonly trustedUserAuthorizations?: readonly TrustedUserAuthorization[];
}

export function resolveJiraContentLanguage(request: JiraLanguageRequest | null): string {
  return request?.explicit === true && validLanguageTag(request.requestedLanguage) ? request.requestedLanguage : "vi-VN";
}

function objectValue(value: JsonValue | undefined): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function languageError(path: string, message: string): ErrorObject {
  return {
    instancePath: path,
    schemaPath: "#/x-jira-content-language",
    keyword: "jiraContentLanguage",
    params: {},
    message,
  };
}

function validLanguageTag(value: string): boolean {
  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value)) return false;
  try {
    Intl.getCanonicalLocales(value);
    return true;
  } catch (error: unknown) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function hasTrustedAuthorization(
  context: JiraLanguageValidationContext,
  capability: JiraAuthorizationCapability,
  reference: JsonValue | undefined,
  scopeType: "jira-draft" | "jira-action",
  scopeRef: string,
  requestedLanguage: string,
): boolean {
  if (typeof reference !== "string") return false;
  return context.trustedUserAuthorizations?.some((authorization) =>
    authorization.reference === reference && authorization.capability === capability && authorization.scopeType === scopeType &&
    authorization.scopeRef === scopeRef && authorization.requestedLanguage === requestedLanguage,
  ) === true;
}

function scopedContentErrors(content: ScopedContent, context: JiraLanguageValidationContext): ErrorObject[] {
  const language = content.value.content_language;
  const override = objectValue(content.value.language_override);
  if (typeof language !== "string") return [];
  if (!validLanguageTag(language)) return [languageError(`${content.path}/content_language`, "must be a well-formed language tag supported by the runtime")];
  if (language === "vi-VN") {
    return override === null ? [] : [languageError(`${content.path}/language_override`, "must be absent for the default vi-VN language")];
  }
  if (override === null) return [languageError(`${content.path}/language_override`, "is required for a non-default content language")];
  const valid = override.requested_language === language && override.scope_type === content.scopeType &&
    override.scope_ref === content.scopeRef && override.source === "explicit-user-request" &&
    hasTrustedAuthorization(context, "jira-language-override", override.evidence_reference, content.scopeType, content.scopeRef, language);
  return valid ? [] : [languageError(`${content.path}/language_override`, "must match trusted local user input and the exact draft or action scope")];
}

function draftContents(schemaName: string, value: JsonValue): ScopedContent[] {
  const root = objectValue(value);
  if (root === null) return [];
  if (schemaName === "backlog-draft.schema.json") {
    const epic = objectValue(root.epic);
    const stories = Array.isArray(root.stories) ? root.stories : [];
    return [
      ...(epic === null || typeof epic.draft_ref !== "string" ? [] : [{path: "/epic", scopeType: "jira-draft" as const, scopeRef: epic.draft_ref, value: epic}]),
      ...stories.flatMap((item, index) => {
        const story = objectValue(item);
        return story === null || typeof story.draft_ref !== "string" ? [] : [{path: `/stories/${index}`, scopeType: "jira-draft" as const, scopeRef: story.draft_ref, value: story}];
      }),
    ];
  }
  if (schemaName === "subtask-draft.schema.json") {
    const goal = objectValue(root.goal);
    const subtasks = Array.isArray(root.subtasks) ? root.subtasks : [];
    return [
      ...(goal === null || typeof root.story_ref !== "string" ? [] : [{path: "/goal", scopeType: "jira-draft" as const, scopeRef: root.story_ref, value: goal}]),
      ...subtasks.flatMap((item, index) => {
        const subtask = objectValue(item);
        return subtask === null || typeof subtask.draft_ref !== "string" ? [] : [{path: `/subtasks/${index}`, scopeType: "jira-draft" as const, scopeRef: subtask.draft_ref, value: subtask}];
      }),
    ];
  }
  return [];
}

function requiresActionLanguage(action: JsonObject): boolean {
  if (action.system !== "jira") return false;
  return action.operation === "issue.create" || action.operation === "issue.update" || action.operation === "issue.comment";
}

function preservationValid(value: JsonValue | undefined): boolean {
  const preservation = objectValue(value);
  return preservation?.policy_ref === ".kilo/config/jiraman.json#/language/preserved_literal_kinds" && preservation.mode === "exact";
}

function existingContentErrors(action: JsonObject, desired: JsonObject, path: string, context: JiraLanguageValidationContext): ErrorObject[] {
  if (action.operation !== "issue.update" && action.operation !== "issue.comment") return [];
  const before = objectValue(action.before_state);
  if (before === null || typeof before.human_content_language !== "string" || before.issue_key !== action.target_ref) {
    return [languageError(`${path}/before_state`, "must contain a fresh target-bound human_content_language snapshot")];
  }
  if (before.human_content_language === "vi-VN") return [];
  if (action.operation === "issue.comment") {
    return desired.existing_content_mode === "preserve-human-content" ? [] : [languageError(`${path}/desired_state/existing_content_mode`, "must preserve existing non-Vietnamese human content")];
  }
  if (desired.existing_content_mode === "managed-section-only") {
    const valid = desired.description_update_mode === "managed-section" && typeof desired.managed_section === "string" &&
      desired.managed_section.length > 0 && desired.description === undefined && desired.summary === undefined;
    return valid ? [] : [languageError(`${path}/desired_state`, "must update only one managed section on existing non-Vietnamese content")];
  }
  const authorization = objectValue(desired.translation_authorization);
  const fullTranslation = desired.existing_content_mode === "approved-full-translation" && desired.description_update_mode === "approved-full-translation" &&
    typeof before.description === "string" && typeof desired.description === "string" && authorization?.source === "explicit-user-request" &&
    typeof action.id === "string" && typeof desired.content_language === "string" && hasTrustedAuthorization(context, "jira-full-description-translation", authorization.evidence_reference, "jira-action", action.id, desired.content_language) &&
    action.risk === "high" && action.approval_required === "per-action";
  return fullTranslation ? [] : [languageError(`${path}/desired_state`, "full translation requires complete before/after content and separate explicit high-risk approval")];
}

function actionContentErrors(value: JsonValue, context: JiraLanguageValidationContext): ErrorObject[] {
  const group = objectValue(value);
  if (group === null || !Array.isArray(group.actions)) return [];
  return group.actions.flatMap((item, index) => {
    const action = objectValue(item);
    const desired = objectValue(action?.desired_state);
    if (action === null || desired === null || !requiresActionLanguage(action) || typeof action.id !== "string") return [];
    const path = `/actions/${index}`;
    return [
      ...(typeof desired.content_language === "string" ? scopedContentErrors({path: `${path}/desired_state`, scopeType: "jira-action", scopeRef: action.id, value: desired}, context) : [languageError(`${path}/desired_state/content_language`, "is required for Jira user-facing content")]),
      ...(preservationValid(desired.literal_preservation) ? [] : [languageError(`${path}/desired_state/literal_preservation`, "must bind exact canonical literal preservation")]),
      ...existingContentErrors(action, desired, path, context),
    ];
  });
}

export function jiraLanguageSemanticErrors(schemaName: string, value: JsonValue, context: JiraLanguageValidationContext = {}): ErrorObject[] {
  return [
    ...draftContents(schemaName, value).flatMap((content) => scopedContentErrors(content, context)),
    ...(schemaName === "action-group.schema.json" ? actionContentErrors(value, context) : []),
  ];
}
