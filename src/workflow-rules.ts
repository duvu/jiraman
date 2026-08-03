import { acceptanceCriteriaIds, goalAcceptanceCriterionErrors, localAcceptanceCriterionErrors } from "./acceptance-criteria-rules.js";
import { asArray, asObject, asString, invariant, validDate, type JsonObject, type JsonValue } from "./contracts.js";
import { internalDependencyGraphValid } from "./dependency-rules.js";

const ACTIONABLE_TEXT = /^(?![\s\S]*[\p{Default_Ignorable_Code_Point}\p{Cc}])(?=[\s\S]*[\p{L}\p{N}])/u;
const JIRA_ISSUE_KEY = /^AIPLATFORM-[0-9]+$/;

function objectValue(value: JsonValue | undefined): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function stringIds(value: JsonValue | undefined): readonly string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !ACTIONABLE_TEXT.test(item))) return null;
  const ids = value.filter((item): item is string => typeof item === "string");
  return new Set(ids).size === ids.length ? ids : null;
}

function stringList(value: JsonValue | undefined): readonly string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !ACTIONABLE_TEXT.test(item))) return null;
  const items = value.filter((item): item is string => typeof item === "string");
  return new Set(items).size === items.length ? items : null;
}

function stringArrayValid(value: JsonValue | undefined, minimumItems: number): boolean {
  return Array.isArray(value) && value.length >= minimumItems && value.every((item) => typeof item === "string" && ACTIONABLE_TEXT.test(item));
}

function childRelations(subtasks: JsonValue | undefined, field: "requirements" | "parent_acceptance_criteria_refs"): ReadonlyMap<string, ReadonlySet<string>> {
  const relations = new Map<string, Set<string>>();
  if (!Array.isArray(subtasks)) return relations;
  for (const value of subtasks) {
    const subtask = objectValue(value);
    if (typeof subtask?.ref !== "string" || !Array.isArray(subtask[field])) continue;
    for (const id of subtask[field]) {
      if (typeof id !== "string") continue;
      const refs = relations.get(id) ?? new Set<string>();
      refs.add(subtask.ref);
      relations.set(id, refs);
    }
  }
  return relations;
}

function traceabilityMapValid(value: JsonValue | undefined, expectedIds: readonly string[], subtaskRefs: ReadonlySet<string>, expectedRelations?: ReadonlyMap<string, ReadonlySet<string>>): boolean {
  const map = objectValue(value);
  if (map === null || Object.keys(map).length !== expectedIds.length || expectedIds.some((id) => map[id] === undefined)) return false;
  return expectedIds.every((id) => {
    const refs = stringIds(map[id]);
    if (refs === null || refs.some((ref) => !subtaskRefs.has(ref))) return false;
    if (expectedRelations === undefined) return true;
    const expected = expectedRelations.get(id);
    return expected !== undefined && refs.length === expected.size && refs.every((ref) => expected.has(ref));
  });
}

function goalChildTraceabilityValid(goal: JsonObject, requirementIds: readonly string[], criterionIds: readonly string[]): boolean {
  if (!Array.isArray(goal.subtasks) || goal.subtasks.length < 2) return false;
  const declaredRequirements = new Set(requirementIds);
  const declaredCriteria = new Set(criterionIds);
  const coveredRequirements = new Set<string>();
  const coveredCriteria = new Set<string>();
  const subtaskRefs = new Set<string>();
  const dependencyGraph = new Map<string, readonly string[]>();
  for (const value of goal.subtasks) {
    const subtask = objectValue(value);
    const requirements = stringIds(subtask?.requirements);
    const criteria = stringIds(subtask?.parent_acceptance_criteria_refs);
    const dependencies = stringList(subtask?.dependencies);
    if (subtask === null || typeof subtask.ref !== "string" || !JIRA_ISSUE_KEY.test(subtask.ref) || subtaskRefs.has(subtask.ref) || requirements === null || criteria === null || dependencies === null ||
      requirements.some((id) => !declaredRequirements.has(id)) || criteria.some((id) => !declaredCriteria.has(id)) || typeof subtask.summary !== "string" || !ACTIONABLE_TEXT.test(subtask.summary) ||
      typeof subtask.outcome !== "string" || !ACTIONABLE_TEXT.test(subtask.outcome) || !stringArrayValid(subtask.in_scope, 1) || !stringArrayValid(subtask.out_of_scope, 0) ||
      !stringArrayValid(subtask.steps, 1) || !stringArrayValid(subtask.affected_files, 0) || typeof subtask.validation !== "string" || !ACTIONABLE_TEXT.test(subtask.validation) ||
      typeof subtask.definition_of_done !== "string" || !ACTIONABLE_TEXT.test(subtask.definition_of_done) ||
      typeof subtask.estimate_hours !== "number" || subtask.estimate_hours <= 0 || subtask.estimate_hours > 4 ||
      subtask.content_language !== "vi-VN" || subtask.acceptance_criteria_storage !== "managed-description-section" || acceptanceCriteriaIds(subtask.acceptance_criteria) === null ||
      localAcceptanceCriterionErrors(subtask.acceptance_criteria, "").length > 0) return false;
    subtaskRefs.add(subtask.ref);
    dependencyGraph.set(subtask.ref, dependencies);
    for (const id of requirements) coveredRequirements.add(id);
    for (const id of criteria) coveredCriteria.add(id);
  }
  return internalDependencyGraphValid(dependencyGraph, subtaskRefs) && requirementIds.every((id) => coveredRequirements.has(id)) && criterionIds.every((id) => coveredCriteria.has(id));
}

export function sprintHealth(input: JsonObject): "Green" | "Amber" | "Red" | "Not verified" {
  if (input.active_sprint === null) return "Not verified";
  if (input.goal_blocked === true) return "Red";
  if (input.wip_breach === true || input.blocked === true) return "Amber";
  return input.evidence_complete === true ? "Green" : "Not verified";
}

export function dailyNextPriority(input: JsonObject, reviewLimit: number): string {
  const queues = asObject(input.queues ?? null, "queues");
  if (input.incident_or_security === true) return "incident or security response";
  if (input.blocked_work === true) return "unblock work";
  if (typeof queues.review === "number" && queues.review >= reviewLimit) return "clear review queue";
  if (typeof queues.validation === "number" && queues.validation >= reviewLimit) return "clear validation queue";
  if (input.wip_breach === true) return "finish active work";
  if (input.goal_deadline_risk === true) return "protect sprint goal";
  if (input.runway_gap === true) return "restore ready runway";
  return "consider new work";
}

export function runwayRecoveryViolations(input: JsonObject): string[] {
  const gaps = asArray(input.readiness_gaps, "readiness gaps").map((item) => asObject(item, "readiness gap"));
  const violations: string[] = [];
  for (const gap of gaps) {
    if (typeof gap.story !== "string" || !JIRA_ISSUE_KEY.test(gap.story)) violations.push("missing-story");
    if (typeof gap.goal_name !== "string" || gap.goal_name.length === 0) violations.push("missing-goal-name");
    if (typeof gap.goal_deadline !== "string" || !validDate(gap.goal_deadline)) violations.push("missing-goal-deadline");
    if (typeof gap.goal_dod_gap !== "string" || gap.goal_dod_gap.length === 0) violations.push("missing-goal-dod-gap");
    if (typeof gap.valid_subtask_count !== "number" || gap.valid_subtask_count < 2) violations.push("insufficient-subtasks");
    if (typeof gap.subtask !== "string" || !JIRA_ISSUE_KEY.test(gap.subtask)) violations.push("missing-subtask");
    if (typeof gap.gap !== "string" || gap.gap.length === 0) violations.push("missing-gap");
    if (typeof gap.recovery_action !== "string" || gap.recovery_action.length === 0) violations.push("missing-action");
    if (typeof gap.expected_readiness_effect !== "string" || gap.expected_readiness_effect.length === 0) violations.push("missing-effect");
  }
  return violations;
}

export function candidateCanCommit(candidate: JsonObject): boolean {
  if (candidate.class !== "Ready-backed" || candidate.readiness !== "ready" || candidate.capacity_fit !== "verified") return false;
  if (!Array.isArray(candidate.dependencies) || candidate.dependencies.length > 0 || typeof candidate.target_sprint_end !== "string" || !validDate(candidate.target_sprint_end)) return false;
  if (!Array.isArray(candidate.goals) || candidate.goals.length === 0) return false;
  const sprintEnd = candidate.target_sprint_end;
  return candidate.goals.every((value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    if (typeof value.goal_name !== "string" || !ACTIONABLE_TEXT.test(value.goal_name) || typeof value.target_completion_date !== "string" || !validDate(value.target_completion_date)) return false;
    const deadlineEvidence = objectValue(value.target_completion_date_evidence);
    if (deadlineEvidence === null || !["sprint-end", "milestone", "specification", "explicit-user-decision"].includes(String(deadlineEvidence.source)) || typeof deadlineEvidence.reference !== "string" || !ACTIONABLE_TEXT.test(deadlineEvidence.reference) || deadlineEvidence.verified !== true) return false;
    const deadlineFits = value.target_completion_date <= sprintEnd || value.deadline_exception_approved === true;
    const subtaskRefs = new Set<string>();
    const subtasksValid = Array.isArray(value.subtasks) && value.subtasks.length >= 2 && value.subtasks.every((subtask) => {
      if (subtask === null || typeof subtask !== "object" || Array.isArray(subtask)) return false;
      if (typeof subtask.ref !== "string" || subtask.ref.length === 0 || subtaskRefs.has(subtask.ref)) return false;
      subtaskRefs.add(subtask.ref);
      return typeof subtask.estimate_hours === "number" && subtask.estimate_hours > 0 && subtask.estimate_hours <= 4;
    });
    const requirements = stringIds(value.requirements);
    const acceptanceCriteria = acceptanceCriteriaIds(value.acceptance_criteria);
    const definitionOfDone = stringIds(value.definition_of_done);
    const traceability = objectValue(value.traceability);
    const requirementRelations = childRelations(value.subtasks, "requirements");
    const acceptanceRelations = childRelations(value.subtasks, "parent_acceptance_criteria_refs");
    const dodIds = definitionOfDone?.map((_, index) => `DOD-${index + 1}`) ?? [];
    const traceabilityValid = requirements !== null && acceptanceCriteria !== null && definitionOfDone !== null && traceability !== null &&
      goalAcceptanceCriterionErrors(value.requirements, value.acceptance_criteria, "/acceptance_criteria").length === 0 &&
      traceabilityMapValid(traceability.requirements, requirements, subtaskRefs, requirementRelations) &&
      traceabilityMapValid(traceability.acceptance_criteria, acceptanceCriteria, subtaskRefs, acceptanceRelations) &&
      traceabilityMapValid(traceability.goal_definition_of_done, dodIds, subtaskRefs);
    const childTraceabilityValid = requirements !== null && acceptanceCriteria !== null && goalChildTraceabilityValid(value, requirements, acceptanceCriteria);
    return deadlineFits && typeof value.story_ref === "string" && JIRA_ISSUE_KEY.test(value.story_ref) && typeof value.canonical_spec === "string" && ACTIONABLE_TEXT.test(value.canonical_spec) && typeof value.epic_parent === "string" && JIRA_ISSUE_KEY.test(value.epic_parent) && value.traceability_complete === true && traceabilityValid && childTraceabilityValid && value.readiness === "ready" && subtasksValid;
  });
}

export function sprintReviewAccepted(review: JsonObject): boolean {
  if (review.jira_status !== "Done" || review.validation_evidence === "missing" || review.accepted_outcome !== true) return false;
  if (review.acceptance_criteria_satisfied !== true || review.subtasks_satisfied !== true || !Array.isArray(review.goal_definition_of_done_evidence) || review.goal_definition_of_done_evidence.length === 0) return false;
  return review.goal_definition_of_done_evidence.every((value) => value !== null && typeof value === "object" && !Array.isArray(value) && value.satisfied === true && typeof value.evidence === "string" && value.evidence.length > 0);
}

export type GoalHealthState = "on track" | "at risk" | "overdue" | "DoD incomplete" | "completed with evidence" | "not verified";

export function goalHealthState(goal: JsonObject): GoalHealthState {
  if (typeof goal.goal_name !== "string" || goal.goal_name.length === 0 || typeof goal.target_completion_date !== "string" || !validDate(goal.target_completion_date) || typeof goal.as_of !== "string" || !validDate(goal.as_of)) return "not verified";
  if (!Array.isArray(goal.definition_of_done_evidence) || goal.definition_of_done_evidence.length === 0) return "not verified";
  const dodComplete = goal.definition_of_done_evidence.every((value) => value !== null && typeof value === "object" && !Array.isArray(value) && value.satisfied === true && typeof value.evidence === "string" && value.evidence.length > 0 && value.evidence !== "not verified");
  if (goal.completion_evidence === true && dodComplete) return "completed with evidence";
  if (goal.jira_status === "Done" && !dodComplete) return "DoD incomplete";
  if (goal.target_completion_date < goal.as_of) return "overdue";
  return goal.at_risk === true ? "at risk" : "on track";
}

export function goalReadinessViolations(goal: JsonObject): string[] {
  const violations: string[] = [];
  if (typeof goal.goal_name !== "string" || !ACTIONABLE_TEXT.test(goal.goal_name)) violations.push("missing-goal-name");
  if (typeof goal.target_completion_date !== "string" || !validDate(goal.target_completion_date) || goal.deadline_evidence_verified !== true) violations.push("unverified-goal-deadline");
  if (stringIds(goal.definition_of_done) === null) violations.push("missing-goal-dod");
  const requirementIds = stringIds(goal.requirements);
  const criterionIds = acceptanceCriteriaIds(goal.acceptance_criteria);
  const criteriaValid = requirementIds !== null && criterionIds !== null && goalAcceptanceCriterionErrors(goal.requirements, goal.acceptance_criteria, "/acceptance_criteria").length === 0;
  const childTraceabilityValid = criteriaValid && goalChildTraceabilityValid(goal, requirementIds, criterionIds);
  if (!criteriaValid || !childTraceabilityValid) violations.push("incomplete-acceptance-criteria");
  if (typeof goal.epic_parent !== "string" || !JIRA_ISSUE_KEY.test(goal.epic_parent)) violations.push("unverified-epic-parent");
  if (!Array.isArray(goal.subtasks) || goal.subtasks.length < 2) violations.push("insufficient-subtasks");
  if (Array.isArray(goal.subtasks) && goal.subtasks.some((value) => value === null || typeof value !== "object" || Array.isArray(value) || typeof value.estimate_hours !== "number" || value.estimate_hours <= 0 || value.estimate_hours > 4)) violations.push("invalid-subtask-estimate");
  if (typeof goal.estimate_hours === "number" && Array.isArray(goal.subtasks) && goal.subtasks.length > 0) violations.push("story-subtask-estimate-double-count");
  if (goal.traceability_complete !== true || !childTraceabilityValid) violations.push("incomplete-traceability");
  if (!Array.isArray(goal.dependencies) || goal.dependencies.length > 0) violations.push("unresolved-dependencies");
  return violations;
}

export function governanceDisposition(data: JsonObject): "update-link" | "create-proposal" | "review" {
  const duplicate = asObject(data.duplicate_search ?? null, "duplicate search");
  const result = asString(duplicate.result, "duplicate result");
  switch (result) {
    case "existing": return "update-link";
    case "none": return "create-proposal";
    case "ambiguous": return "review";
    default:
      invariant(false, `unknown duplicate result: ${result}`);
  }
}

export function reconciliationDisposition(input: JsonObject): "reuse" | "split" | "review" | "link" {
  if (input.status === "Done") return "link";
  if (Array.isArray(input.uncovered) && input.uncovered.length > 0) return "split";
  if (Array.isArray(input.ids) && input.ids.length > 0) return "reuse";
  return "review";
}
