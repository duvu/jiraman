import { asArray, asObject, asString, invariant, validDate, type JsonObject } from "./contracts.js";

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
    if (typeof gap.story !== "string" || !gap.story.startsWith("AIPLATFORM-")) violations.push("missing-story");
    if (typeof gap.goal_name !== "string" || gap.goal_name.length === 0) violations.push("missing-goal-name");
    if (typeof gap.goal_deadline !== "string" || !validDate(gap.goal_deadline)) violations.push("missing-goal-deadline");
    if (typeof gap.goal_dod_gap !== "string" || gap.goal_dod_gap.length === 0) violations.push("missing-goal-dod-gap");
    if (typeof gap.valid_subtask_count !== "number" || gap.valid_subtask_count < 2) violations.push("insufficient-subtasks");
    if (typeof gap.subtask !== "string" || !gap.subtask.startsWith("AIPLATFORM-")) violations.push("missing-subtask");
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
    if (typeof value.goal_name !== "string" || value.goal_name.length === 0 || typeof value.target_completion_date !== "string" || !validDate(value.target_completion_date)) return false;
    const deadlineFits = value.target_completion_date <= sprintEnd || value.deadline_exception_approved === true;
    const subtasksValid = Array.isArray(value.subtasks) && value.subtasks.length >= 2 && value.subtasks.every((subtask) => {
      if (subtask === null || typeof subtask !== "object" || Array.isArray(subtask)) return false;
      return typeof subtask.estimate_hours === "number" && subtask.estimate_hours > 0 && subtask.estimate_hours <= 4;
    });
    return deadlineFits && Array.isArray(value.definition_of_done) && value.definition_of_done.length > 0 && typeof value.epic_parent === "string" && value.epic_parent.startsWith("AIPLATFORM-") && value.traceability_complete === true && value.readiness === "ready" && subtasksValid;
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
  if (typeof goal.goal_name !== "string" || goal.goal_name.length === 0) violations.push("missing-goal-name");
  if (typeof goal.target_completion_date !== "string" || !validDate(goal.target_completion_date) || goal.deadline_evidence_verified !== true) violations.push("unverified-goal-deadline");
  if (!Array.isArray(goal.definition_of_done) || goal.definition_of_done.length === 0) violations.push("missing-goal-dod");
  if (typeof goal.epic_parent !== "string" || !goal.epic_parent.startsWith("AIPLATFORM-")) violations.push("unverified-epic-parent");
  if (!Array.isArray(goal.subtasks) || goal.subtasks.length < 2) violations.push("insufficient-subtasks");
  if (Array.isArray(goal.subtasks) && goal.subtasks.some((value) => value === null || typeof value !== "object" || Array.isArray(value) || typeof value.estimate_hours !== "number" || value.estimate_hours <= 0 || value.estimate_hours > 4)) violations.push("invalid-subtask-estimate");
  if (typeof goal.estimate_hours === "number" && Array.isArray(goal.subtasks) && goal.subtasks.length > 0) violations.push("story-subtask-estimate-double-count");
  if (goal.traceability_complete !== true) violations.push("incomplete-traceability");
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
