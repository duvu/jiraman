import type { ErrorObject } from "ajv";

import type { JsonObject, JsonValue } from "./contracts.js";

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

function validDate(value: JsonValue | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isJiraIssueWrite(action: JsonObject): boolean {
  return action.system === "jira" && (action.operation === "issue.create" || action.operation === "issue.update");
}

export function goalActionSemanticErrors(value: JsonValue): ErrorObject[] {
  const group = objectValue(value);
  if (group === null || !Array.isArray(group.actions)) return [];
  const actions = group.actions.map(objectValue);
  const errors: ErrorObject[] = [];
  const hierarchyActions = actions.filter((action) => action !== null && isJiraIssueWrite(action) && ["Epic", "Story", "Sub-task"].includes(String(objectValue(action.desired_state)?.issue_type)));
  if (hierarchyActions.length === 0) return [];
  const refs: string[] = [];
  for (const [index, action] of actions.entries()) {
    if (action === null || !isJiraIssueWrite(action)) continue;
    const desired = objectValue(action.desired_state);
    if (desired === null || !["Epic", "Story", "Sub-task"].includes(String(desired.issue_type))) continue;
    const ref = typeof desired.draft_ref === "string" ? desired.draft_ref : typeof action.target_ref === "string" ? action.target_ref : null;
    if (ref !== null) refs.push(ref);
    if (desired.project !== "AIPLATFORM") errors.push(semanticError(index, "project", "must target AIPLATFORM"));
    if (desired.issue_type === "Story") {
      const deadlineEvidence = objectValue(desired.target_completion_date_evidence);
      const fieldsValid = typeof desired.parent_ref === "string" && desired.parent_ref.length > 0 &&
        typeof desired.goal_name === "string" && desired.goal_name.length > 0 && desired.summary === desired.goal_name &&
        validDate(desired.target_completion_date) && desired.due_date === desired.target_completion_date &&
        deadlineEvidence !== null && ["sprint-end", "milestone", "specification", "explicit-user-decision"].includes(String(deadlineEvidence.source)) && typeof deadlineEvidence.reference === "string" && deadlineEvidence.reference.length > 0 && deadlineEvidence.verified === true &&
        nonEmptyStrings(desired.definition_of_done) && typeof desired.canonical_spec === "string" && desired.canonical_spec.length > 0 &&
        nonEmptyStrings(desired.requirements) && nonEmptyStrings(desired.acceptance_criteria) && nonEmptyStrings(desired.validation);
      if (!fieldsValid) errors.push(semanticError(index, "goalFields", "Story writes require exact Goal name, Epic parent, verified deadline/due date, Goal DoD, specification, REQ/AC, and validation"));
    }
    if (desired.issue_type === "Sub-task") {
      const fieldsValid = typeof desired.parent_ref === "string" && desired.parent_ref.length > 0 &&
        typeof desired.summary === "string" && desired.summary.length > 0 && typeof desired.outcome === "string" && desired.outcome.length > 0 &&
        typeof desired.validation === "string" && desired.validation.length > 0 && typeof desired.definition_of_done === "string" && desired.definition_of_done.length > 0 &&
        typeof desired.original_estimate_hours === "number" && desired.original_estimate_hours > 0 && desired.original_estimate_hours <= 4 &&
        nonEmptyStrings(desired.requirements) && nonEmptyStrings(desired.acceptance_criteria);
      if (!fieldsValid) errors.push(semanticError(index, "subtaskFields", "Sub-task writes require a Goal parent, outcome, validation, DoD, REQ/AC, and an estimate in (0, 4]"));
    }
  }
  if (new Set(refs).size !== refs.length) errors.push(semanticError(0, "uniqueDraftRefs", "hierarchy draft references must be unique"));
  for (const [index, action] of actions.entries()) {
    if (action === null || action.operation !== "issue.create") continue;
    const desired = objectValue(action.desired_state);
    const parentRef = typeof desired?.draft_ref === "string" ? desired.draft_ref : typeof action.target_ref === "string" ? action.target_ref : null;
    if (parentRef === null) continue;
    if (desired?.issue_type === "Epic") {
      const goalCount = actions.filter((candidate) => objectValue(candidate?.desired_state)?.issue_type === "Story" && objectValue(candidate?.desired_state)?.parent_ref === parentRef).length;
      if (goalCount < 2) errors.push(semanticError(index, "minimumGoals", "an Epic create group requires at least two Goal Story writes"));
    }
    if (desired?.issue_type === "Story") {
      const subtaskCount = actions.filter((candidate) => objectValue(candidate?.desired_state)?.issue_type === "Sub-task" && objectValue(candidate?.desired_state)?.parent_ref === parentRef).length;
      if (subtaskCount < 2) errors.push(semanticError(index, "minimumSubtasks", "a Goal Story create group requires at least two Sub-task writes"));
    }
  }
  return errors;
}
