import { createHash } from "node:crypto";

import type { JsonObject, JsonValue } from "./contracts.js";

export interface ProjectLanguageDefaults {
  readonly jira_ticket_content: string;
  readonly user_response: string;
  readonly mcp_schema_and_query?: "preserve";
  readonly explicit_override_allowed?: true;
  readonly existing_ticket_mode?: "preserve-human-content";
  readonly preserved_literal_kinds?: readonly string[];
  readonly preserved_technical_terms?: readonly string[];
}

export interface DeliveryContract {
  readonly hierarchy: readonly ["Epic", "Story", "Sub-task"];
  readonly story_semantics: "goal";
  readonly minimum_goal_stories_per_epic: number;
  readonly minimum_subtasks_per_goal: number;
  readonly maximum_subtask_hours: number;
  readonly required_goal_fields: readonly string[];
  readonly [key: string]: unknown;
}

export interface ProjectProfile {
  readonly project_id: string;
  readonly aliases: readonly string[];
  readonly jira_project_key: string;
  readonly confluence: {
    readonly allowed_space_keys: readonly string[];
    readonly page_roots: Readonly<Record<string, string | null>>;
  };
  readonly timezone: string;
  readonly sprint_length_days: number;
  readonly language: ProjectLanguageDefaults;
  readonly delivery: DeliveryContract;
  readonly profile_revision: number;
}

export interface RepositoryMapping {
  readonly project_id: string;
  readonly repository_root?: string;
  readonly git_remote?: string;
}

export interface ProjectProfileRegistry {
  readonly schema_version: 6;
  readonly default_project_id: string;
  readonly profiles: Readonly<Record<string, ProjectProfile>>;
  readonly repository_mappings: readonly RepositoryMapping[];
  readonly actions?: Readonly<Record<string, unknown>>;
  readonly state?: Readonly<Record<string, unknown>>;
}

export interface ProjectContext {
  readonly project_id: string;
  readonly jira_project_key: string;
  readonly confluence_space_keys: readonly string[];
  readonly page_roots: Readonly<Record<string, string | null>>;
  readonly timezone: string;
  readonly sprint_length_days: number;
  readonly language: ProjectLanguageDefaults;
  readonly delivery: DeliveryContract;
  readonly profile_revision: number;
  readonly fingerprint: string;
  readonly source: "explicit-command" | "session-binding" | "repository-mapping" | "single-project-default";
}

export interface ProjectContextSessionBinding {
  readonly project_id: string;
  readonly profile_revision: number;
  readonly context_fingerprint: string;
}

export interface ProjectContextResolutionInput {
  readonly explicit_project?: string;
  readonly session_project_id?: string;
  readonly session_binding?: ProjectContextSessionBinding;
  readonly repository_root?: string;
  readonly git_remote?: string;
  readonly remote_evidence?: unknown;
}

export type ProjectContextResolution =
  | {readonly status: "resolved"; readonly context: ProjectContext}
  | {readonly status: "project-not-found" | "context-ambiguous" | "context-conflict" | "profile-stale"; readonly candidates: readonly string[]; readonly reason: string};

const PROJECT_ID = /^[a-z][a-z0-9-]{1,31}$/u;
const PROJECT_ALIAS = /^[a-z][a-z0-9-]{1,31}$/u;
const JIRA_KEY = /^[A-Z][A-Z0-9_]{1,31}$/u;
const SPACE_KEY = /^[A-Z][A-Z0-9_-]{1,31}$/u;
const JIRA_ISSUE_KEY = /^([A-Z][A-Z0-9_]{1,31})-[0-9]+$/u;
const LANGUAGE_TAG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;
const REQUIRED_GOAL_FIELDS = ["goal_name", "target_completion_date", "acceptance_criteria", "definition_of_done"] as const;
const GLOBAL_ACTIONS = ["all_or_nothing_preflight", "read_before_write", "read_after_write"] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function strings(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validLanguage(value: unknown): boolean {
  if (typeof value !== "string" || !LANGUAGE_TAG.test(value)) return false;
  try {
    Intl.getCanonicalLocales(value);
    return true;
  } catch (error: unknown) {
    return error instanceof RangeError ? false : (() => { throw error; })();
  }
}

function validTimezone(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", {timeZone: value}).format();
    return true;
  } catch (error: unknown) {
    return error instanceof RangeError ? false : (() => { throw error; })();
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  const object = record(value);
  if (object !== null) return Object.fromEntries(Object.entries(object).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  return value;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function profileShapeViolations(projectId: string, value: unknown): string[] {
  const profile = record(value);
  const violations: string[] = [];
  if (!PROJECT_ID.test(projectId) || profile === null || profile.project_id !== projectId) return ["invalid-project-id"];
  if (!strings(profile.aliases) || profile.aliases.some((alias) => !PROJECT_ALIAS.test(alias))) violations.push(`${projectId}:invalid-alias`);
  if (strings(profile.aliases) && profile.aliases.length !== new Set(profile.aliases).size) violations.push(`${projectId}:duplicate-alias`);
  if (typeof profile.jira_project_key !== "string" || !JIRA_KEY.test(profile.jira_project_key)) violations.push(`${projectId}:invalid-jira-key`);
  const confluence = record(profile.confluence);
  if (confluence === null || !strings(confluence.allowed_space_keys) || confluence.allowed_space_keys.length === 0 || confluence.allowed_space_keys.some((space) => !SPACE_KEY.test(space))) violations.push(`${projectId}:invalid-confluence-scope`);
  if (confluence !== null && strings(confluence.allowed_space_keys) && confluence.allowed_space_keys.length !== new Set(confluence.allowed_space_keys).size) violations.push(`${projectId}:duplicate-confluence-space`);
  const roots = confluence === null ? null : record(confluence.page_roots);
  if (roots === null || Object.values(roots).some((root) => root !== null && (typeof root !== "string" || root.length === 0))) violations.push(`${projectId}:invalid-page-root`);
  if (!validTimezone(profile.timezone)) violations.push(`${projectId}:invalid-timezone`);
  const sprintLength = profile.sprint_length_days;
  if (typeof sprintLength !== "number" || !Number.isInteger(sprintLength) || sprintLength < 1) violations.push(`${projectId}:invalid-sprint-length`);
  const language = record(profile.language);
  if (language === null || !validLanguage(language.jira_ticket_content) || !validLanguage(language.user_response)) violations.push(`${projectId}:invalid-language-defaults`);
  const delivery = record(profile.delivery);
  const requiredGoalFields = delivery !== null && strings(delivery.required_goal_fields) ? delivery.required_goal_fields : null;
  const revision = profile.profile_revision;
  if (delivery === null || JSON.stringify(delivery.hierarchy) !== JSON.stringify(["Epic", "Story", "Sub-task"]) || delivery.story_semantics !== "goal" || typeof delivery.minimum_goal_stories_per_epic !== "number" || delivery.minimum_goal_stories_per_epic < 2 || typeof delivery.minimum_subtasks_per_goal !== "number" || delivery.minimum_subtasks_per_goal < 2 || typeof delivery.maximum_subtask_hours !== "number" || delivery.maximum_subtask_hours <= 0 || delivery.maximum_subtask_hours > 4 || requiredGoalFields === null || REQUIRED_GOAL_FIELDS.some((field) => !requiredGoalFields.includes(field))) violations.push(`${projectId}:weak-delivery-contract`);
  if (!Number.isInteger(revision) || typeof revision !== "number" || revision < 1) violations.push(`${projectId}:invalid-profile-revision`);
  return violations;
}

export function profileRegistryViolations(value: unknown): string[] {
  const registry = record(value);
  const violations: string[] = [];
  if (registry === null || registry.schema_version !== 6 || typeof registry.default_project_id !== "string") return ["invalid-registry-header"];
  const profiles = record(registry.profiles);
  if (profiles === null || Object.keys(profiles).length === 0) return ["empty-profile-registry"];
  const projectIds = Object.keys(profiles);
  if (!projectIds.includes(registry.default_project_id)) violations.push("unknown-default-project");
  const aliases = new Set<string>();
  const jiraKeys = new Set<string>();
  for (const [projectId, profile] of Object.entries(profiles)) {
    violations.push(...profileShapeViolations(projectId, profile));
    const parsed = record(profile);
    if (parsed === null) continue;
    const key = parsed.jira_project_key;
    if (typeof key === "string" && jiraKeys.has(key)) violations.push(`duplicate-jira-key:${key}`);
    if (typeof key === "string") jiraKeys.add(key);
    if (Array.isArray(parsed.aliases)) {
      for (const alias of parsed.aliases) {
        if (typeof alias !== "string") continue;
        if (aliases.has(alias) || projectIds.includes(alias)) violations.push(`ambiguous-alias:${alias}`);
        aliases.add(alias);
      }
    }
  }
  const identityOwners = new Map<string, Set<string>>();
  for (const [projectId, profile] of Object.entries(profiles)) {
    const parsed = record(profile);
    const identifiers = [projectId, ...(Array.isArray(parsed?.aliases) ? parsed.aliases.filter((alias): alias is string => typeof alias === "string") : []), ...(typeof parsed?.jira_project_key === "string" ? [parsed.jira_project_key] : [])];
    for (const identifier of identifiers) {
      const owners = identityOwners.get(identifier) ?? new Set<string>();
      owners.add(projectId);
      identityOwners.set(identifier, owners);
    }
  }
  for (const [identifier, owners] of identityOwners) if (owners.size > 1) violations.push(`ambiguous-project-identity:${identifier}`);
  const defaultProfile = record(profiles[registry.default_project_id]);
  const legacyProject = record(registry.project);
  if (defaultProfile !== null && legacyProject !== null && (
    legacyProject.key !== defaultProfile.jira_project_key ||
    legacyProject.timezone !== defaultProfile.timezone ||
    legacyProject.sprint_length_days !== defaultProfile.sprint_length_days
  )) violations.push("legacy-project-projection-mismatch");
  const registryRecord = registry as unknown as Record<string, unknown>;
  for (const [field, profileField] of [["language", "language"], ["confluence", "confluence"], ["delivery", "delivery"]] as const) {
    if (defaultProfile !== null && registryRecord[field] !== undefined && hash(registryRecord[field]) !== hash(defaultProfile[profileField])) violations.push(`legacy-${field}-projection-mismatch`);
  }
  const mappings = registry.repository_mappings;
  if (!Array.isArray(mappings)) violations.push("invalid-repository-mappings");
  else {
    for (const item of mappings) {
      const mapping = record(item);
      if (mapping === null || typeof mapping.project_id !== "string" || !projectIds.includes(mapping.project_id) ||
          (typeof mapping.repository_root !== "string" && typeof mapping.git_remote !== "string") ||
          (mapping.repository_root !== undefined && (typeof mapping.repository_root !== "string" || mapping.repository_root.length === 0)) ||
          (mapping.git_remote !== undefined && (typeof mapping.git_remote !== "string" || mapping.git_remote.length === 0))) {
        violations.push("invalid-repository-mapping");
      }
    }
  }
  const actions = record(registry.actions);
  if (actions === null) violations.push("invalid-global-actions");
  else for (const field of GLOBAL_ACTIONS) if (actions[field] !== true) violations.push(`global-safety:${field}`);
  const state = record(registry.state);
  if (state !== null && state.path !== ".kilo/state/jiraman.json") violations.push("invalid-state-path");
  return [...new Set(violations)].sort();
}

export function profileFingerprint(profile: ProjectProfile): string {
  return hash(profile);
}

export function projectContextFromProfile(profile: ProjectProfile, source: ProjectContext["source"]): ProjectContext {
  return {
    project_id: profile.project_id,
    jira_project_key: profile.jira_project_key,
    confluence_space_keys: [...profile.confluence.allowed_space_keys],
    page_roots: {...profile.confluence.page_roots},
    timezone: profile.timezone,
    sprint_length_days: profile.sprint_length_days,
    language: profile.language,
    delivery: profile.delivery,
    profile_revision: profile.profile_revision,
    fingerprint: profileFingerprint(profile),
    source,
  };
}

function clone(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

export function migrateV5Config(value: JsonValue): JsonObject {
  const input = record(value);
  if (input === null) throw new Error("configuration must be an object");
  if (input.schema_version === 6) {
    const violations = profileRegistryViolations(value);
    if (violations.length > 0) throw new Error(`invalid multi-project registry: ${violations.join(", ")}`);
    return clone(value);
  }
  if (input.schema_version !== 5) throw new Error("unsupported configuration version");
  const project = record(input.project), language = record(input.language), confluence = record(input.confluence), delivery = record(input.delivery);
  if (project === null || language === null || confluence === null || delivery === null || typeof project.key !== "string" || typeof project.timezone !== "string") throw new Error("malformed v5 project configuration");
  const projectId = project.key.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "legacy-project";
  const migrated: Record<string, unknown> = {
    schema_version: 6,
    default_project_id: projectId,
    profiles: {
      [projectId]: {
        project_id: projectId,
        aliases: [],
        jira_project_key: project.key,
        confluence: {allowed_space_keys: confluence.allowed_space_keys, page_roots: confluence.page_roots},
        timezone: project.timezone,
        sprint_length_days: project.sprint_length_days,
        language,
        delivery,
        profile_revision: 1,
      },
    },
    repository_mappings: [],
    actions: input.actions,
    state: input.state,
  };
  const result = clone(migrated);
  const violations = profileRegistryViolations(result);
  if (violations.length > 0) throw new Error(`malformed v5 configuration: ${violations.join(", ")}`);
  return result;
}

function projectCandidates(registry: ProjectProfileRegistry, reference: string): ProjectProfile[] {
  const direct = registry.profiles[reference];
  if (direct !== undefined) return [direct];
  return Object.values(registry.profiles).filter((profile) => profile.aliases.includes(reference) || profile.jira_project_key === reference);
}

function contextFromSession(registry: ProjectProfileRegistry, binding: ProjectContextSessionBinding): ProjectContextResolution {
  const profile = registry.profiles[binding.project_id];
  if (profile === undefined) return {status: "project-not-found", candidates: [], reason: "session project is not configured"};
  const context = projectContextFromProfile(profile, "session-binding");
  if (binding.profile_revision !== context.profile_revision || binding.context_fingerprint !== context.fingerprint) return {status: "profile-stale", candidates: [profile.project_id], reason: "session binding does not match the current profile revision or fingerprint"};
  return {status: "resolved", context};
}

export function resolveProjectContext(registry: ProjectProfileRegistry, input: ProjectContextResolutionInput): ProjectContextResolution {
  const registryViolations = profileRegistryViolations(registry);
  if (registryViolations.length > 0) return {status: "context-conflict", candidates: [], reason: `invalid project registry: ${registryViolations.join(", ")}`};
  if (input.explicit_project !== undefined) {
    const matches = projectCandidates(registry, input.explicit_project);
    if (matches.length !== 1) return {status: "project-not-found", candidates: matches.map((profile) => profile.project_id), reason: "explicit project is unknown or ambiguous"};
    return {status: "resolved", context: projectContextFromProfile(matches[0] as ProjectProfile, "explicit-command")};
  }
  if (input.session_binding !== undefined) return contextFromSession(registry, input.session_binding);
  if (input.session_project_id !== undefined) {
    const matches = projectCandidates(registry, input.session_project_id);
    if (matches.length !== 1) return {status: "project-not-found", candidates: matches.map((profile) => profile.project_id), reason: "session project is unknown or ambiguous"};
    return {status: "resolved", context: projectContextFromProfile(matches[0] as ProjectProfile, "session-binding")};
  }
  const mappings = Array.isArray(registry.repository_mappings) ? registry.repository_mappings.filter((mapping) =>
    (input.repository_root !== undefined && mapping.repository_root === input.repository_root) ||
    (input.git_remote !== undefined && mapping.git_remote === input.git_remote),
  ) : [];
  const mappedIds = [...new Set(mappings.map((mapping) => mapping.project_id))];
  if (mappedIds.length > 1) return {status: "context-ambiguous", candidates: mappedIds.sort(), reason: "repository metadata maps to multiple projects"};
  if (mappedIds.length === 1) {
    const profile = registry.profiles[mappedIds[0] as string];
    if (profile === undefined) return {status: "project-not-found", candidates: mappedIds, reason: "repository mapping points to an unknown project"};
    return {status: "resolved", context: projectContextFromProfile(profile, "repository-mapping")};
  }
  const profiles = Object.values(registry.profiles);
  if (profiles.length === 1) return {status: "resolved", context: projectContextFromProfile(profiles[0] as ProjectProfile, "single-project-default")};
  return {status: "context-ambiguous", candidates: profiles.map((profile) => profile.project_id).sort(), reason: "more than one project is configured and no trusted context selected"};
}

function privateKey(key: string): boolean {
  return /(?:remote[-_]?body|authorization(?:[-_]?header)?|cookie|password|access[-_]?token|refresh[-_]?token|client[-_]?secret|private[-_]?url|remote[-_]?url|credential|secret)/iu.test(key);
}

export function contextBindingViolations(value: JsonValue, context: ProjectContext): string[] {
  const root = record(value);
  if (root === null) return ["invalid-context-bound-record"];
  const violations = new Set<string>();
  const bound = record(root.context);
  if (bound === null || bound.project_id !== context.project_id || bound.jira_project_key !== context.jira_project_key || bound.profile_revision !== context.profile_revision || bound.context_fingerprint !== context.fingerprint) violations.add("context-mismatch");
  if (bound !== null && bound.profile_revision !== context.profile_revision) violations.add("profile-revision-mismatch");
  if (bound !== null && bound.context_fingerprint !== context.fingerprint) violations.add("context-fingerprint-mismatch");
  if (root.project !== context.jira_project_key) violations.add("jira-project-scope");
  const visit = (item: unknown, key = ""): void => {
    const object = record(item);
    if (object !== null) {
      for (const [field, child] of Object.entries(object)) {
        if (privateKey(field)) violations.add("private-state-content");
        if (field === "project" && typeof child === "string" && child !== context.jira_project_key) violations.add("jira-project-scope");
        if (["target_ref", "issue_key", "parent_ref", "parent", "jira_key"].includes(field) && typeof child === "string") {
          const match = JIRA_ISSUE_KEY.exec(child);
          if (match !== null && match[1] !== context.jira_project_key) violations.add("jira-project-scope");
        }
        if (["space", "space_key", "confluence_space_key"].includes(field) && typeof child === "string" && !context.confluence_space_keys.includes(child)) violations.add("confluence-scope");
        if (field === "page_root" && typeof child === "string" && !Object.values(context.page_roots).includes(child)) violations.add("confluence-page-root");
        if (field === "jql" && typeof child === "string" && new RegExp(`\\bproject\\s*=\\s*(?!${context.jira_project_key}\\b)[A-Z][A-Z0-9_]*`, "u").test(child)) violations.add("jira-project-scope");
        visit(child, key === "" ? field : `${key}.${field}`);
      }
    } else if (Array.isArray(item)) item.forEach((child) => visit(child, key));
  };
  visit(root);
  return [...violations].sort();
}

export function stateContextViolations(value: JsonValue, context: ProjectContext): string[] {
  const root = record(value);
  if (root === null) return ["invalid-state"];
  const violations = new Set<string>();
  const v6Projects = record(root.projects);
  if (root.schema_version === 6 && v6Projects !== null) {
    const session = record(root.session);
    if (session !== null && session.project_id !== null && (session.project_id !== context.project_id || session.jira_project_key !== context.jira_project_key || session.profile_revision !== context.profile_revision || session.context_fingerprint !== context.fingerprint)) violations.add("context-mismatch");
    const projectState = record(v6Projects[context.project_id]);
    if (projectState === null || projectState.project_id !== context.project_id || projectState.jira_project_key !== context.jira_project_key || projectState.profile_revision !== context.profile_revision || projectState.context_fingerprint !== context.fingerprint) violations.add("context-mismatch");
    const groups = projectState?.pending_action_groups;
    if (groups !== null && typeof groups === "object" && !Array.isArray(groups)) for (const [id, group] of Object.entries(groups)) {
      const groupObject = record(group);
      if (groupObject === null || groupObject.id !== id) violations.add("state-action-id-mismatch");
      for (const violation of contextBindingViolations(group as JsonValue, context)) violations.add(violation);
    }
    return [...violations].sort();
  }
  for (const violation of contextBindingViolations(value, context)) violations.add(violation);
  const groups = record(root.pending_action_groups);
  if (groups !== null) for (const [id, group] of Object.entries(groups)) {
    const groupObject = record(group);
    if (groupObject === null || groupObject.id !== id) violations.add("state-action-id-mismatch");
    for (const violation of contextBindingViolations(group as JsonValue, context)) violations.add(violation);
  }
  return [...violations].sort();
}
