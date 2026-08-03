import type { ErrorObject } from "ajv";

import {
  acceptanceCriteriaIds,
  acceptanceCriterionSemanticErrors,
  epicAcceptanceCriterionErrors,
  goalAcceptanceCriterionErrors,
  localAcceptanceCriterionErrors,
} from "./acceptance-criteria-rules.js";
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

function stringSet(value: JsonValue | undefined): ReadonlySet<string> | null {
  if (!nonEmptyStrings(value) || !Array.isArray(value)) return null;
  const values = value.filter((item): item is string => typeof item === "string");
  return new Set(values).size === values.length ? new Set(values) : null;
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function isJiraHierarchyAction(action: JsonObject): boolean {
  return action.system === "jira" && (action.operation === "issue.create" || action.operation === "issue.update" || action.operation === "issue.reuse");
}

type HierarchyIssueType = "Epic" | "Story" | "Sub-task";

interface ValidHierarchyAction {
  readonly index: number;
  readonly isCreate: boolean;
  readonly issueType: HierarchyIssueType;
  readonly ref: string;
  readonly parentRef: string | null;
  readonly parentIssueType: JsonValue | undefined;
  readonly parentProject: JsonValue | undefined;
  readonly state: JsonObject;
}

function hierarchyIssueType(value: JsonValue | undefined): HierarchyIssueType | null {
  if (value === "Epic" || value === "Story" || value === "Sub-task") return value;
  return null;
}

function hierarchyFieldsValid(issueType: HierarchyIssueType, state: JsonObject, ref: string | null): boolean {
  switch (issueType) {
    case "Epic":
      return ref !== null && typeof state.summary === "string" && state.summary.length > 0 && state.content_language === "vi-VN" &&
        state.acceptance_criteria_storage === "managed-description-section" && epicAcceptanceCriterionErrors(state.acceptance_criteria, "").length === 0 && acceptanceCriteriaIds(state.acceptance_criteria) !== null;
    case "Story": {
      const deadlineEvidence = objectValue(state.target_completion_date_evidence);
      return typeof state.parent_ref === "string" && state.parent_ref.length > 0 &&
        typeof state.goal_name === "string" && state.goal_name.length > 0 && state.summary === state.goal_name &&
        typeof state.target_completion_date === "string" && validDate(state.target_completion_date) && state.due_date === state.target_completion_date &&
        deadlineEvidence !== null && ["sprint-end", "milestone", "specification", "explicit-user-decision"].includes(String(deadlineEvidence.source)) && typeof deadlineEvidence.reference === "string" && deadlineEvidence.reference.length > 0 && deadlineEvidence.verified === true &&
        nonEmptyStrings(state.definition_of_done) && typeof state.canonical_spec === "string" && state.canonical_spec.length > 0 &&
        nonEmptyStrings(state.requirements) && acceptanceCriteriaIds(state.acceptance_criteria) !== null && goalAcceptanceCriterionErrors(state.requirements, state.acceptance_criteria, "").length === 0 &&
        state.content_language === "vi-VN" && state.acceptance_criteria_storage === "managed-description-section" && nonEmptyStrings(state.validation);
    }
    case "Sub-task":
      return typeof state.parent_ref === "string" && state.parent_ref.length > 0 &&
        typeof state.summary === "string" && state.summary.length > 0 && typeof state.outcome === "string" && state.outcome.length > 0 &&
        typeof state.validation === "string" && state.validation.length > 0 && typeof state.definition_of_done === "string" && state.definition_of_done.length > 0 &&
        typeof state.original_estimate_hours === "number" && state.original_estimate_hours > 0 && state.original_estimate_hours <= 4 &&
        stringSet(state.requirements) !== null && stringSet(state.parent_acceptance_criteria_refs) !== null &&
        stringSet(state.parent_requirement_ids) !== null && stringSet(state.parent_acceptance_criteria_ids) !== null &&
        state.content_language === "vi-VN" && state.acceptance_criteria_storage === "managed-description-section" &&
        localAcceptanceCriterionErrors(state.acceptance_criteria, "").length === 0 && acceptanceCriteriaIds(state.acceptance_criteria) !== null;
  }
}

function hierarchyAcceptanceErrors(issueType: HierarchyIssueType, state: JsonObject): ErrorObject[] {
  switch (issueType) {
    case "Epic": return epicAcceptanceCriterionErrors(state.acceptance_criteria, "");
    case "Story": return goalAcceptanceCriterionErrors(state.requirements, state.acceptance_criteria, "");
    case "Sub-task": return localAcceptanceCriterionErrors(state.acceptance_criteria, "");
  }
}

function acceptanceUpdateModeValid(operation: JsonValue | undefined, desired: JsonObject): boolean {
  if (operation !== "issue.update") return true;
  if (desired.description !== undefined) return false;
  if (desired.acceptance_criteria === undefined) return true;
  return desired.description_update_mode === "managed-section" && desired.managed_section === "acceptance-criteria" && desired.description === undefined;
}

export function goalActionSemanticErrors(value: JsonValue): ErrorObject[] {
  const group = objectValue(value);
  if (group === null || !Array.isArray(group.actions)) return [];
  const actions = group.actions.map(objectValue);
  const errors: ErrorObject[] = [];
  const refs: string[] = [];
  const validActions: ValidHierarchyAction[] = [];
  for (const [index, action] of actions.entries()) {
    if (action === null) continue;
    if (action.system === "jira" && action.operation === "issue.comment") {
      const comment = objectValue(action.desired_state);
      const before = objectValue(action.before_state);
      const targetMissingAcceptance = hierarchyIssueType(before?.issue_type) !== null && acceptanceCriteriaIds(before?.acceptance_criteria) === null;
      if (targetMissingAcceptance || comment?.purpose === "acceptance-criteria-gap") {
        const commentErrors = acceptanceCriterionSemanticErrors(comment?.acceptance_criteria, "");
        if (comment === null || comment.purpose !== "acceptance-criteria-gap" || comment.content_language !== "vi-VN" || comment.managed_content_only !== true || acceptanceCriteriaIds(comment.acceptance_criteria) === null || commentErrors.length > 0) {
          errors.push(semanticError(index, "acceptanceCriteriaComment", "Acceptance Criteria gap comments require complete approved Vietnamese managed content"));
        }
      }
      continue;
    }
    if (!isJiraHierarchyAction(action)) continue;
    const desired = objectValue(action.desired_state);
    if (desired === null) {
      errors.push(semanticError(index, "issueType", "Jira hierarchy actions require an authoritative Epic, Story, or Sub-task type"));
      continue;
    }
    const before = objectValue(action.before_state);
    const isCreate = action.operation === "issue.create";
    const isReuse = action.operation === "issue.reuse";
    const authoritative = isCreate ? desired : before;
    const issueType = hierarchyIssueType(authoritative?.issue_type);
    if (issueType === null) {
      errors.push(semanticError(index, "issueType", "Jira hierarchy actions require an authoritative Epic, Story, or Sub-task type"));
      continue;
    }
    let authorityValid = true;
    if (isReuse && (desired.reuse !== true || Object.keys(desired).length !== 1)) {
      errors.push(semanticError(index, "reuseMutation", "a reuse action must be an evidence-only reference with no desired Jira mutation"));
      authorityValid = false;
    }
    if (!isCreate && !isReuse && desired.issue_type !== undefined && desired.issue_type !== issueType) {
      errors.push(semanticError(index, "issueTypeDrift", "an update cannot change the freshly read Jira issue type"));
      authorityValid = false;
    }
    const authoritativeProject = authoritative?.project;
    if (!isCreate && !isReuse && desired.project !== undefined && desired.project !== authoritativeProject) {
      errors.push(semanticError(index, "projectDrift", "an update cannot change the freshly read Jira project"));
      authorityValid = false;
    }
    const effective = isCreate ? desired : isReuse ? (before ?? {}) : {...(before ?? {}), ...desired, issue_type: issueType, project: authoritativeProject ?? null};
    const projectValid = authoritativeProject === "AIPLATFORM";
    if (!projectValid) errors.push(semanticError(index, "project", "must target authoritative AIPLATFORM state"));
    const ref = typeof effective.draft_ref === "string" ? effective.draft_ref : typeof action.target_ref === "string" ? action.target_ref : null;
    const acceptanceErrors = hierarchyAcceptanceErrors(issueType, effective);
    for (const error of acceptanceErrors) errors.push(semanticError(index, error.keyword, error.message ?? "invalid Acceptance Criteria"));
    if (!acceptanceUpdateModeValid(action.operation, desired)) {
      errors.push(semanticError(index, "managedAcceptanceSection", "existing Jira content may update only the approved Acceptance Criteria managed section"));
      authorityValid = false;
    }
    const fieldsValid = hierarchyFieldsValid(issueType, effective, ref);
    if (!fieldsValid) {
      const keyword = issueType === "Epic" ? "epicFields" : issueType === "Story" ? "goalFields" : "subtaskFields";
      errors.push(semanticError(index, keyword, `${issueType} writes require the complete approved hierarchy contract`));
    }
    if (ref !== null) refs.push(ref);
    if (authorityValid && projectValid && fieldsValid && ref !== null) {
      validActions.push({
        index,
        isCreate,
        issueType,
        ref,
        parentRef: typeof effective.parent_ref === "string" ? effective.parent_ref : null,
        parentIssueType: effective.parent_issue_type,
        parentProject: effective.parent_project,
        state: effective,
      });
    }
  }
  if (new Set(refs).size !== refs.length) errors.push(semanticError(0, "uniqueDraftRefs", "hierarchy draft references must be unique"));
  const invalidParentage = new Set<number>();
  const byRef = new Map(validActions.map((action) => [action.ref, action]));
  for (const action of validActions.filter((candidate) => candidate.issueType !== "Epic")) {
    const parent = action.parentRef === null ? undefined : byRef.get(action.parentRef);
    const expected = action.issueType === "Story" ? "Epic" : "Story";
    if (parent !== undefined && parent.issueType !== expected) {
      errors.push(semanticError(action.index, "parentType", `${action.issueType} parent must resolve to ${expected}`));
      invalidParentage.add(action.index);
    } else if (parent === undefined && (action.parentIssueType !== expected || action.parentProject !== "AIPLATFORM")) {
      errors.push(semanticError(action.index, "parentAuthority", `${action.issueType} external parent requires authoritative AIPLATFORM ${expected} state`));
      invalidParentage.add(action.index);
    }
    if (action.issueType === "Sub-task") {
      const parentRequirementIds = stringSet(action.state.parent_requirement_ids);
      const parentCriterionIds = stringSet(action.state.parent_acceptance_criteria_ids);
      const requirementRefs = stringSet(action.state.requirements);
      const criterionRefs = stringSet(action.state.parent_acceptance_criteria_refs);
      if (parentRequirementIds === null || requirementRefs === null || [...requirementRefs].some((ref) => !parentRequirementIds.has(ref))) {
        errors.push(semanticError(action.index, "resolvedParentRequirementReference", "Sub-task requirements must resolve to the authoritative parent Goal requirements"));
        invalidParentage.add(action.index);
      }
      if (parentCriterionIds === null || criterionRefs === null || [...criterionRefs].some((ref) => !parentCriterionIds.has(ref))) {
        errors.push(semanticError(action.index, "resolvedParentAcceptanceReference", "Sub-task parent Acceptance Criteria references must resolve to the authoritative parent Goal criteria"));
        invalidParentage.add(action.index);
      }
      if (parent?.issueType === "Story" && parentRequirementIds !== null && parentCriterionIds !== null) {
        const actualRequirementIds = stringSet(parent.state.requirements);
        const actualCriterionIds = new Set(acceptanceCriteriaIds(parent.state.acceptance_criteria) ?? []);
        if (actualRequirementIds === null || !sameSet(parentRequirementIds, actualRequirementIds) || !sameSet(parentCriterionIds, actualCriterionIds)) {
          errors.push(semanticError(action.index, "parentContractAuthority", "Sub-task parent contract IDs must match the resolved Goal Story"));
          invalidParentage.add(action.index);
        }
      }
    }
  }
  const countable = validActions.filter((candidate) => !invalidParentage.has(candidate.index));
  for (const parent of countable.filter((candidate) => candidate.isCreate && candidate.issueType === "Epic")) {
    const goalCount = countable.filter((candidate) => candidate.issueType === "Story" && candidate.parentRef === parent.ref).length;
    if (goalCount < 2) errors.push(semanticError(parent.index, "minimumGoals", "an Epic create group requires at least two valid Goal Story writes"));
  }
  for (const parent of countable.filter((candidate) => candidate.issueType === "Story")) {
    const children = countable.filter((candidate) => candidate.issueType === "Sub-task" && candidate.parentRef === parent.ref);
    if (parent.isCreate && children.length < 2) errors.push(semanticError(parent.index, "minimumSubtasks", "a Goal Story create group requires at least two valid Sub-task writes"));
    const goalRequirementIds = new Set(Array.isArray(parent.state.requirements) ? parent.state.requirements.filter((ref): ref is string => typeof ref === "string") : []);
    const goalCriterionIds = new Set(acceptanceCriteriaIds(parent.state.acceptance_criteria) ?? []);
    const implemented = new Set<string>();
    for (const child of children) {
      const requirementRefs = Array.isArray(child.state.requirements)
        ? child.state.requirements.filter((ref): ref is string => typeof ref === "string")
        : [];
      if (requirementRefs.some((ref) => !goalRequirementIds.has(ref))) {
        errors.push(semanticError(child.index, "resolvedParentRequirementReference", "Sub-task requirements must resolve to its Goal Story"));
      }
      const parentRefs = Array.isArray(child.state.parent_acceptance_criteria_refs)
        ? child.state.parent_acceptance_criteria_refs.filter((ref): ref is string => typeof ref === "string")
        : [];
      if (parentRefs.some((ref) => !goalCriterionIds.has(ref))) {
        errors.push(semanticError(child.index, "resolvedParentAcceptanceReference", "Sub-task parent Acceptance Criteria references must resolve to its Goal Story"));
      }
      for (const ref of parentRefs) implemented.add(ref);
    }
    if ([...goalCriterionIds].some((id) => !implemented.has(id))) {
      errors.push(semanticError(parent.index, "goalAcceptanceSubtaskCoverage", "every Goal Acceptance Criterion must be implemented or verified by at least one Sub-task"));
    }
  }
  return errors;
}
