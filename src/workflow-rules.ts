import { asArray, asObject, asString, invariant, type JsonObject } from "./contracts.js";

export function sprintHealth(input: JsonObject): "Green" | "Amber" | "Red" | "Not verified" {
  if (input.active_sprint === null) return "Not verified";
  if (input.goal_blocked === true) return "Red";
  if (input.wip_breach === true || input.blocked === true) return "Amber";
  return input.evidence_complete === true ? "Green" : "Not verified";
}

export function dailyNextPriority(input: JsonObject, reviewLimit: number): string {
  const queues = asObject(input.queues ?? null, "queues");
  if (typeof queues.review === "number" && queues.review >= reviewLimit) return "clear review queue";
  if (input.wip_breach === true) return "finish active work";
  return "protect sprint goal";
}

export function runwayRecoveryViolations(input: JsonObject): string[] {
  const gaps = asArray(input.readiness_gaps, "readiness gaps").map((item) => asObject(item, "readiness gap"));
  const violations: string[] = [];
  for (const gap of gaps) {
    if (typeof gap.story !== "string" || !gap.story.startsWith("AIPLATFORM-")) violations.push("missing-story");
    if (typeof gap.subtask !== "string" || !gap.subtask.startsWith("AIPLATFORM-")) violations.push("missing-subtask");
    if (typeof gap.gap !== "string" || gap.gap.length === 0) violations.push("missing-gap");
    if (typeof gap.recovery_action !== "string" || gap.recovery_action.length === 0) violations.push("missing-action");
    if (typeof gap.expected_readiness_effect !== "string" || gap.expected_readiness_effect.length === 0) violations.push("missing-effect");
  }
  return violations;
}

export function candidateCanCommit(candidate: JsonObject): boolean {
  return candidate.class === "Ready-backed" && candidate.readiness === "ready" && candidate.capacity_fit === "verified" && asArray(candidate.dependencies, "dependencies").length === 0;
}

export function sprintReviewAccepted(review: JsonObject): boolean {
  return review.jira_status === "Done" && review.validation_evidence !== "missing" && review.accepted_outcome === true;
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
