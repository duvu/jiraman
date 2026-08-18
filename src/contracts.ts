import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";

import { canonicalPayloadHash } from "./action-rules.js";
import { validDate, validDateTime } from "./date-rules.js";
import { goalDraftSemanticErrors } from "./goal-rules.js";
import { goalActionSemanticErrors } from "./goal-action-rules.js";
import { jiraLanguageSemanticErrors, type JiraLanguageValidationContext } from "./jira-language-rules.js";
import { contextBindingViolations, profileRegistryViolations } from "./project-rules.js";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export { validDate, validDateTime } from "./date-rules.js";

export const ROOT = resolve(process.cwd());

export class ContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new ContractError(message);
  }
}

export function readText(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

export function readJson(path: string): JsonValue {
  const parsed: unknown = JSON.parse(readText(path));
  return asJsonValue(parsed, path);
}

export function asJsonValue(value: unknown, label: string): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => asJsonValue(item, `${label}[${index}]`));
  }
  invariant(typeof value === "object", `${label} must be JSON`);
  const output: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = asJsonValue(item, `${label}.${key}`);
  }
  return output;
}

export function asObject(value: JsonValue, label: string): JsonObject {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

export function asArray(value: JsonValue | undefined, label: string): JsonValue[] {
  invariant(Array.isArray(value), `${label} must be an array`);
  return value;
}

export function asString(value: JsonValue | undefined, label: string): string {
  invariant(typeof value === "string", `${label} must be a string`);
  return value;
}

export function walkFiles(path: string): string[] {
  const absolute = resolve(ROOT, path);
  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(relative(ROOT, child)));
    } else if (entry.isFile()) {
      files.push(relative(ROOT, child));
    }
  }
  return files.sort();
}

export function listSkillFiles(): string[] {
  return walkFiles("template/.kilo/skills").filter((path) => path.endsWith("/SKILL.md"));
}

export function parseFrontmatter(text: string): ReadonlyMap<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  invariant(match?.[1] !== undefined, "Markdown frontmatter is required");
  const values = new Map<string, string>();
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator > 0) {
      values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^"|"$/g, ""));
    }
  }
  return values;
}

const schemaValidators = new Map<string, ValidateFunction>();

function schemaValidator(schemaName: string): ValidateFunction {
  const cached = schemaValidators.get(schemaName);
  if (cached !== undefined) return cached;

  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
    formats: {
      date: { type: "string", validate: validDate },
      "date-time": { type: "string", validate: validDateTime },
    },
  });
  for (const path of walkFiles("schemas").filter((item) => item.endsWith(".schema.json"))) {
    const schema = asObject(readJson(path), path);
    ajv.addSchema(schema, basename(path));
  }
  const validator = ajv.getSchema(schemaName);
  invariant(validator !== undefined, `schema not registered: ${schemaName}`);
  schemaValidators.set(schemaName, validator);
  return validator;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ErrorObject[];
}

function actionStatusesMatchGroup(groupStatus: string, actionStatuses: readonly string[]): boolean {
  if (groupStatus === "proposed") return actionStatuses.every((status) => status === "proposed");
  if (groupStatus === "approved") return actionStatuses.every((status) => status === "approved");
  if (groupStatus === "rejected") return actionStatuses.includes("rejected") && actionStatuses.every((status) => ["proposed", "approved", "rejected"].includes(status));
  if (groupStatus === "stale") return actionStatuses.every((status) => status === "stale");
  if (groupStatus === "applying") return actionStatuses.includes("applying") && actionStatuses.every((status) => ["approved", "applying", "applied", "failed", "verification-failed"].includes(status));
  if (groupStatus === "applied") return actionStatuses.every((status) => status === "applied");
  if (groupStatus === "failed") return actionStatuses.includes("failed") && actionStatuses.every((status) => ["approved", "applied", "failed"].includes(status));
  if (groupStatus === "verification-failed") return actionStatuses.includes("verification-failed") && actionStatuses.every((status) => ["approved", "applied", "verification-failed"].includes(status));
  return false;
}

function actionGroupApprovalErrors(value: JsonValue): ErrorObject[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  const executableStatuses = new Set(["approved", "applying", "applied", "failed", "verification-failed"]);
  if (typeof value.status !== "string") return [];
  const executable = executableStatuses.has(value.status);
  if (!Array.isArray(value.actions) || value.approval === null || typeof value.approval !== "object" || Array.isArray(value.approval)) return [];

  const actionIds: string[] = [];
  const actionStatuses: string[] = [];
  for (const action of value.actions) {
    if (action === null || typeof action !== "object" || Array.isArray(action) || typeof action.id !== "string" || typeof action.status !== "string") return [];
    actionIds.push(action.id);
    actionStatuses.push(action.status);
  }

  const errors: ErrorObject[] = [];
  const approvedIds = value.approval.approved_action_ids;
  const approvedIdSet = Array.isArray(approvedIds) && approvedIds.every((id) => typeof id === "string") ? new Set(approvedIds) : null;
  const emptyApproval = value.approval.group_approved_by === null && value.approval.approved_at === null && value.approval.payload_hash === null && Array.isArray(approvedIds) && approvedIds.length === 0;
  const completeApproval = typeof value.approval.group_approved_by === "string" && value.approval.group_approved_by.length > 0 &&
    typeof value.approval.approved_at === "string" && validDateTime(value.approval.approved_at) &&
    typeof value.approval.payload_hash === "string" && value.approval.payload_hash === value.payload_hash &&
    approvedIdSet !== null && approvedIdSet.size === actionIds.length && actionIds.every((id) => approvedIdSet.has(id));
  if ((!emptyApproval && !completeApproval) || (value.status === "proposed" && !emptyApproval)) {
    errors.push({
      instancePath: "/approval",
      schemaPath: "#/x-action-group-approval/tuple",
      keyword: "approvalTuple",
      params: {},
      message: "must be empty or contain a complete approval for every action",
    });
  }
  if (executable && !completeApproval) {
    errors.push({
      instancePath: "/approval/approved_action_ids",
      schemaPath: "#/x-action-group-approval/approved-action-ids",
      keyword: "approvalActionIds",
      params: {},
      message: "must contain every action ID exactly once",
    });
  }
  if (!actionStatusesMatchGroup(value.status, actionStatuses)) {
    errors.push({
      instancePath: "/actions",
      schemaPath: "#/x-action-group-lifecycle/status",
      keyword: "actionLifecycle",
      params: {},
      message: "must match the action group lifecycle state",
    });
  }
  if (typeof value.payload_hash === "string" && typeof value.approval.payload_hash === "string" && value.approval.payload_hash !== value.payload_hash) {
    errors.push({
      instancePath: "/approval/payload_hash",
      schemaPath: "#/x-action-group-approval/payload-hash",
      keyword: "approvalPayloadHash",
      params: {},
      message: "must equal the action group payload_hash",
    });
  }
  if (typeof value.payload_hash === "string" && value.payload_hash !== canonicalPayloadHash(value.actions)) {
    errors.push({
      instancePath: "/payload_hash",
      schemaPath: "#/x-action-group-approval/canonical-payload-hash",
      keyword: "canonicalPayloadHash",
      params: {},
      message: "must equal the SHA-256 of the canonical immutable action payload",
    });
  }
  return errors;
}

function contextSemanticErrors(value: JsonValue, context: JiraLanguageValidationContext): ErrorObject[] {
  if (context.project_context === undefined) return [];
  return contextBindingViolations(value, context.project_context).map((violation) => ({
    instancePath: "/context",
    schemaPath: "#/x-project-context-binding",
    keyword: "projectContextBinding",
    params: {violation},
    message: violation,
  }));
}

function actionGroupSemanticErrors(value: JsonValue, context: JiraLanguageValidationContext): ErrorObject[] {
  const group = value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
  const groupContext = group !== null && group.context !== null && typeof group.context === "object" && !Array.isArray(group.context) ? group.context : null;
  const effectiveContext = context.jira_project_key !== undefined || context.project_context !== undefined
    ? {...context, default_content_language: context.default_content_language ?? context.project_context?.language.jira_ticket_content}
    : (typeof groupContext?.jira_project_key === "string" ? {jira_project_key: groupContext.jira_project_key} : {});
  const legacyProjectErrors: ErrorObject[] = group?.schema_version === 5 && group.project !== "AIPLATFORM" ? [{instancePath: "/project", schemaPath: "#/properties/project/const", keyword: "const", params: {allowedValue: "AIPLATFORM"}, message: "must be equal to constant"}] : [];
  return [
    ...legacyProjectErrors,
    ...contextSemanticErrors(value, context),
    ...actionGroupApprovalErrors(value),
    ...goalActionSemanticErrors(value, effectiveContext),
    ...jiraLanguageSemanticErrors("action-group.schema.json", value, context),
  ];
}

function prefixedErrors(errors: readonly ErrorObject[], prefix: string): ErrorObject[] {
  return errors.map((error) => ({...error, instancePath: `${prefix}${error.instancePath}`}));
}

function stateActionGroupErrors(value: JsonValue, context: JiraLanguageValidationContext): ErrorObject[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  const errors: ErrorObject[] = [];
  const escapePointer = (id: string): string => id.replace(/~/g, "~0").replace(/\//g, "~1");
  const validateGroups = (groups: JsonValue | undefined, prefix: string, projectKey?: string, projectId?: string, profileRevision?: number, contextFingerprint?: string): void => {
    if (groups === null || typeof groups !== "object" || Array.isArray(groups)) return;
    for (const [id, group] of Object.entries(groups)) {
      const groupPath = `${prefix}/${escapePointer(id)}`;
      const groupObject = group !== null && typeof group === "object" && !Array.isArray(group) ? group : null;
      if (projectKey !== undefined && groupObject !== null) {
        const groupContext = groupObject.context !== null && typeof groupObject.context === "object" && !Array.isArray(groupObject.context) ? groupObject.context : null;
        if (groupObject.schema_version !== 6 || groupObject.project !== projectKey || groupContext?.jira_project_key !== projectKey || (projectId !== undefined && groupContext?.project_id !== projectId) || (profileRevision !== undefined && groupContext?.profile_revision !== profileRevision) || (contextFingerprint !== undefined && groupContext?.context_fingerprint !== contextFingerprint)) {
          errors.push({instancePath: `${groupPath}/context`, schemaPath: "#/x-project-context-binding", keyword: "projectContextBinding", params: {violation: "jira-project-scope"}, message: "action group must remain in its project state partition"});
        }
      }
      errors.push(...prefixedErrors(actionGroupSemanticErrors(group, projectKey === undefined ? context : {...context, jira_project_key: context.jira_project_key ?? projectKey}), groupPath));
    }
  };
  validateGroups(value.pending_action_groups, "/pending_action_groups", context.jira_project_key);
  const projects = value.projects !== null && typeof value.projects === "object" && !Array.isArray(value.projects) ? value.projects : null;
  if (projects !== null) {
    for (const [projectId, projectState] of Object.entries(projects)) {
      if (projectState === null || typeof projectState !== "object" || Array.isArray(projectState)) continue;
      const stateProjectKey = typeof projectState.jira_project_key === "string" ? projectState.jira_project_key : undefined;
      const stateProfileRevision = typeof projectState.profile_revision === "number" ? projectState.profile_revision : undefined;
      const stateFingerprint = typeof projectState.context_fingerprint === "string" ? projectState.context_fingerprint : undefined;
      validateGroups(projectState.pending_action_groups, `/projects/${escapePointer(projectId)}/pending_action_groups`, stateProjectKey, projectId, stateProfileRevision, stateFingerprint);
    }
  }
  return errors;
}

export function validateJson(schemaName: string, value: JsonValue, context: JiraLanguageValidationContext = {}): ValidationResult {
  const validator = schemaValidator(schemaName);
  const schemaValid = validator(value);
  const draftContextErrors: ErrorObject[] = [];
  if (schemaName === "subtask-draft.schema.json" && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const projectKey = context.jira_project_key ?? "AIPLATFORM";
    if (typeof value.story_ref !== "string" || (!/^story-[0-9]+$/.test(value.story_ref) && !new RegExp(`^${projectKey}-[0-9]+$`).test(value.story_ref))) {
      draftContextErrors.push({instancePath: "/story_ref", schemaPath: "#/properties/story_ref/pattern", keyword: "pattern", params: {}, message: "must be scoped to the selected Jira project"});
    }
  }
  if (["deliverable-plan.schema.json", "backlog-draft.schema.json"].includes(schemaName) && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const projectKey = context.jira_project_key ?? "AIPLATFORM";
    const issueKey = new RegExp(`^${projectKey}-[0-9]+$`);
    const visit = (item: JsonValue, path: string): void => {
      if (Array.isArray(item)) { item.forEach((child, index) => visit(child, `${path}/${index}`)); return; }
      if (item === null || typeof item !== "object") return;
      for (const [key, child] of Object.entries(item)) {
        const childPath = `${path}/${key}`;
        const referenceValues = Array.isArray(child) ? child : [child];
        if (["story_ref", "epic_parent", "ref", "existing_key", "key", "dependencies"].includes(key) && referenceValues.some((candidate) => typeof candidate === "string" && candidate.includes("-") && !issueKey.test(candidate) && !/^REQ-|^AC-|^DLV-|^story-|^draft-|^subtask-/.test(candidate))) {
          draftContextErrors.push({instancePath: childPath, schemaPath: "#/properties/reference/pattern", keyword: "pattern", params: {}, message: "must be scoped to the selected Jira project"});
        }
        visit(child, childPath);
      }
    };
    visit(value, "");
  }
  if (schemaName === "config.schema.json" && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const config = value as JsonObject;
    const profiles = config.profiles !== null && typeof config.profiles === "object" && !Array.isArray(config.profiles) ? config.profiles : null;
    const defaultProfile = profiles !== null && typeof config.default_project_id === "string" && profiles[config.default_project_id] !== null && typeof profiles[config.default_project_id] === "object" && !Array.isArray(profiles[config.default_project_id]) ? profiles[config.default_project_id] as JsonObject : null;
    const language = config.schema_version === 6 ? defaultProfile?.language ?? config.language : config.language;
    const languagePath = config.schema_version === 6 && defaultProfile !== null && config.language === undefined ? `/profiles/${config.default_project_id}/language` : "/language";
    const requiredLiterals = ["jira-key", "req-id", "ac-id", "pmg-id", "pma-id", "dlv-id", "issue-type", "status", "custom-field", "source-excerpt", "jql", "json-key", "mcp-tool", "mcp-schema", "technical-term", "code-symbol", "path", "command", "url", "code-block", "stack-trace", "log"];
    const requiredTerms = ["API", "CI/CD", "Kubernetes", "OAuth", "OpenID Connect"];
    const literalKinds = language !== null && typeof language === "object" && !Array.isArray(language) && Array.isArray(language.preserved_literal_kinds) ? language.preserved_literal_kinds : null;
    const terms = language !== null && typeof language === "object" && !Array.isArray(language) && Array.isArray(language.preserved_technical_terms) ? language.preserved_technical_terms : null;
    if (literalKinds === null || requiredLiterals.some((item) => !literalKinds.includes(item)) || terms === null || requiredTerms.some((item) => !terms.includes(item))) {
      draftContextErrors.push({instancePath: languagePath, schemaPath: "#/definitions/compatLanguage", keyword: "canonicalLanguagePolicy", params: {}, message: "must preserve the canonical language and literal contract"});
    }
    if (config.schema_version === 6) for (const violation of profileRegistryViolations(config)) {
      draftContextErrors.push({instancePath: "/profiles", schemaPath: "#/x-project-profile-registry", keyword: "projectProfileRegistry", params: {violation}, message: violation});
    }
  }
  const semanticErrors = [
    ...(schemaName === "action-group.schema.json" ? actionGroupSemanticErrors(value, context) : []),
    ...(schemaName === "state.schema.json" ? stateActionGroupErrors(value, context) : []),
    ...goalDraftSemanticErrors(schemaName, value),
    ...(schemaName === "action-group.schema.json" ? [] : jiraLanguageSemanticErrors(schemaName, value, context)),
    ...draftContextErrors,
  ];
  return { valid: schemaValid && semanticErrors.length === 0, errors: [...(validator.errors ?? []), ...semanticErrors] };
}

export function requireValid(schemaName: string, path: string): void {
  const result = validateJson(schemaName, readJson(path));
  invariant(result.valid, `${path} failed ${schemaName}: ${JSON.stringify(result.errors)}`);
}

export function requireInvalid(schemaName: string, path: string): void {
  const result = validateJson(schemaName, readJson(path));
  invariant(!result.valid, `${path} unexpectedly passed ${schemaName}`);
}

export function fixtureFiles(directory: string): string[] {
  return walkFiles(directory).filter((path) => path.endsWith(".json"));
}

export function hashFiles(paths: readonly string[]): string {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(resolve(ROOT, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function isExecutable(path: string): boolean {
  return (statSync(resolve(ROOT, path)).mode & 0o111) !== 0;
}
