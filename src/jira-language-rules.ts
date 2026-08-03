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

export function resolveJiraContentLanguage(request: JiraLanguageRequest | null): string {
  return request?.explicit === true ? request.requestedLanguage : "vi-VN";
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

function scopedContentErrors(content: ScopedContent): ErrorObject[] {
  const language = content.value.content_language;
  const override = objectValue(content.value.language_override);
  if (typeof language !== "string") return [];
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language)) return [languageError(`${content.path}/content_language`, "must be a supported BCP 47 language tag")];
  if (language === "vi-VN") {
    return override === null ? [] : [languageError(`${content.path}/language_override`, "must be absent for the default vi-VN language")];
  }
  if (override === null) return [languageError(`${content.path}/language_override`, "is required for a non-default content language")];
  const valid = override.requested_language === language && override.scope_type === content.scopeType &&
    override.scope_ref === content.scopeRef && override.source === "explicit-user-request" &&
    typeof override.evidence_reference === "string" && override.evidence_reference.length > 0;
  return valid ? [] : [languageError(`${content.path}/language_override`, "must match the requested language and exact draft or action scope")];
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

const USER_FACING_FIELDS = new Set(["summary", "description", "body", "comment", "managed_content", "acceptance_criteria", "definition_of_done", "goal_name", "outcome"]);

function requiresActionLanguage(action: JsonObject, desired: JsonObject): boolean {
  if (action.system !== "jira") return false;
  if (action.operation === "issue.create" || action.operation === "issue.comment") return true;
  return action.operation === "issue.update" && Object.keys(desired).some((field) => USER_FACING_FIELDS.has(field));
}

function preservationValid(value: JsonValue | undefined): boolean {
  const preservation = objectValue(value);
  return preservation?.policy_ref === ".kilo/config/jiraman.json#/language/preserved_literal_kinds" && preservation.mode === "exact";
}

function existingContentErrors(action: JsonObject, desired: JsonObject, path: string): ErrorObject[] {
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
    typeof authorization.evidence_reference === "string" && authorization.evidence_reference.length > 0 && action.risk === "high" && action.approval_required === "per-action";
  return fullTranslation ? [] : [languageError(`${path}/desired_state`, "full translation requires complete before/after content and separate explicit high-risk approval")];
}

function actionContentErrors(value: JsonValue): ErrorObject[] {
  const group = objectValue(value);
  if (group === null || !Array.isArray(group.actions)) return [];
  return group.actions.flatMap((item, index) => {
    const action = objectValue(item);
    const desired = objectValue(action?.desired_state);
    if (action === null || desired === null || !requiresActionLanguage(action, desired) || typeof action.id !== "string") return [];
    const path = `/actions/${index}`;
    return [
      ...(typeof desired.content_language === "string" ? scopedContentErrors({path: `${path}/desired_state`, scopeType: "jira-action", scopeRef: action.id, value: desired}) : [languageError(`${path}/desired_state/content_language`, "is required for Jira user-facing content")]),
      ...(preservationValid(desired.literal_preservation) ? [] : [languageError(`${path}/desired_state/literal_preservation`, "must bind exact canonical literal preservation")]),
      ...existingContentErrors(action, desired, path),
    ];
  });
}

export function jiraLanguageSemanticErrors(schemaName: string, value: JsonValue): ErrorObject[] {
  return [
    ...draftContents(schemaName, value).flatMap(scopedContentErrors),
    ...(schemaName === "action-group.schema.json" ? actionContentErrors(value) : []),
  ];
}
