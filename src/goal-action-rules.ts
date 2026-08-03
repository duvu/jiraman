import type { ErrorObject } from "ajv";

import { validDate, type JsonObject, type JsonValue } from "./contracts.js";

function objectValue(value: JsonValue | undefined): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function semanticError(index: number, keyword: string, message: string): ErrorObject {
  return {
    instancePath: `/actions/${index}/desired_state`,
    schemaPath: `#/x-goal-action-contract/${keyword}`,
    keyword,
    params: {},
    message,
  };
}

function nonEmptyStrings(value: JsonValue | undefined): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0);
}

function isJiraIssueWrite(action: JsonObject): boolean {
  return action.system === "jira" && (action.operation === "issue.create" || action.operation === "issue.update");
}

type HierarchyIssueType = "Epic" | "Story" | "Sub-task";

interface ValidHierarchyCreate {
  readonly index: number;
  readonly issueType: HierarchyIssueType;
  readonly ref: string;
  readonly parentRef: string | null;
}

function hierarchyIssueType(value: JsonValue | undefined): HierarchyIssueType | null {
  if (value === "Epic" || value === "Story" || value === "Sub-task") return value;
  return null;
}

function hierarchyFieldsValid(issueType: HierarchyIssueType, state: JsonObject, ref: string | null): boolean {
  switch (issueType) {
    case "Epic":
      return ref !== null && typeof state.summary === "string" && state.summary.length > 0;
    case "Story": {
      const deadlineEvidence = objectValue(state.target_completion_date_evidence);
      return typeof state.parent_ref === "string" && state.parent_ref.length > 0 &&
        typeof state.goal_name === "string" && state.goal_name.length > 0 && state.summary === state.goal_name &&
        typeof state.target_completion_date === "string" && validDate(state.target_completion_date) && state.due_date === state.target_completion_date &&
        deadlineEvidence !== null && ["sprint-end", "milestone", "specification", "explicit-user-decision"].includes(String(deadlineEvidence.source)) && typeof deadlineEvidence.reference === "string" && deadlineEvidence.reference.length > 0 && deadlineEvidence.verified === true &&
        nonEmptyStrings(state.definition_of_done) && typeof state.canonical_spec === "string" && state.canonical_spec.length > 0 &&
        nonEmptyStrings(state.requirements) && nonEmptyStrings(state.acceptance_criteria) && nonEmptyStrings(state.validation);
    }
    case "Sub-task":
      return typeof state.parent_ref === "string" && state.parent_ref.length > 0 &&
        typeof state.summary === "string" && state.summary.length > 0 && typeof state.outcome === "string" && state.outcome.length > 0 &&
        typeof state.validation === "string" && state.validation.length > 0 && typeof state.definition_of_done === "string" && state.definition_of_done.length > 0 &&
        typeof state.original_estimate_hours === "number" && state.original_estimate_hours > 0 && state.original_estimate_hours <= 4 &&
        nonEmptyStrings(state.requirements) && nonEmptyStrings(state.acceptance_criteria);
  }
}

export function goalActionSemanticErrors(value: JsonValue): ErrorObject[] {
  const group = objectValue(value);
  if (group === null || !Array.isArray(group.actions)) return [];
  const actions = group.actions.map(objectValue);
  const errors: ErrorObject[] = [];
  const refs: string[] = [];
  const validCreates: ValidHierarchyCreate[] = [];
  for (const [index, action] of actions.entries()) {
    if (action === null || !isJiraIssueWrite(action)) continue;
    const desired = objectValue(action.desired_state);
    if (desired === null) {
      errors.push(semanticError(index, "issueType", "Jira issue writes require an authoritative Epic, Story, or Sub-task type"));
      continue;
    }
    const before = objectValue(action.before_state);
    const isCreate = action.operation === "issue.create";
    const authoritative = isCreate ? desired : before;
    const issueType = hierarchyIssueType(authoritative?.issue_type);
    if (issueType === null) {
      errors.push(semanticError(index, "issueType", "Jira issue writes require an authoritative Epic, Story, or Sub-task type"));
      continue;
    }
    let authorityValid = true;
    if (!isCreate && desired.issue_type !== undefined && desired.issue_type !== issueType) {
      errors.push(semanticError(index, "issueTypeDrift", "an update cannot change the freshly read Jira issue type"));
      authorityValid = false;
    }
    const authoritativeProject = authoritative?.project;
    if (!isCreate && desired.project !== undefined && desired.project !== authoritativeProject) {
      errors.push(semanticError(index, "projectDrift", "an update cannot change the freshly read Jira project"));
      authorityValid = false;
    }
    const effective = isCreate ? desired : {...(before ?? {}), ...desired, issue_type: issueType, project: authoritativeProject ?? null};
    const projectValid = authoritativeProject === "AIPLATFORM";
    if (!projectValid) errors.push(semanticError(index, "project", "must target authoritative AIPLATFORM state"));
    const ref = typeof effective.draft_ref === "string" ? effective.draft_ref : typeof action.target_ref === "string" ? action.target_ref : null;
    const fieldsValid = hierarchyFieldsValid(issueType, effective, ref);
    if (!fieldsValid) {
      const keyword = issueType === "Epic" ? "epicFields" : issueType === "Story" ? "goalFields" : "subtaskFields";
      errors.push(semanticError(index, keyword, `${issueType} writes require the complete approved hierarchy contract`));
    }
    if (ref !== null) refs.push(ref);
    if (isCreate && authorityValid && projectValid && fieldsValid && ref !== null) {
      validCreates.push({index, issueType, ref, parentRef: typeof effective.parent_ref === "string" ? effective.parent_ref : null});
    }
  }
  if (new Set(refs).size !== refs.length) errors.push(semanticError(0, "uniqueDraftRefs", "hierarchy draft references must be unique"));
  for (const parent of validCreates) {
    if (parent.issueType === "Epic") {
      const goalCount = validCreates.filter((candidate) => candidate.issueType === "Story" && candidate.parentRef === parent.ref).length;
      if (goalCount < 2) errors.push(semanticError(parent.index, "minimumGoals", "an Epic create group requires at least two valid Goal Story writes"));
    }
    if (parent.issueType === "Story") {
      const subtaskCount = validCreates.filter((candidate) => candidate.issueType === "Sub-task" && candidate.parentRef === parent.ref).length;
      if (subtaskCount < 2) errors.push(semanticError(parent.index, "minimumSubtasks", "a Goal Story create group requires at least two valid Sub-task writes"));
    }
  }
  return errors;
}
