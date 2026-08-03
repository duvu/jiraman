import type { JsonObject, JsonValue } from "./contracts.js";

export interface IndexedGoalDocument {
  readonly path: string;
  readonly goalContractRequired: JsonValue | undefined;
  readonly goalContract: string | undefined;
}

const EXPECTED_FIELDS = ["goal_name", "target_completion_date", "definition_of_done"] as const;
const EXPECTED_KEYS = [
  "epic_parent_required",
  "jira_issue_type",
  "maximum_subtask_hours",
  "minimum_goal_stories_per_epic",
  "minimum_subtasks_per_goal",
  "required_fields",
  "traceability_required",
] as const;

export function goalContractMarker(contract: JsonObject): string | null {
  const fields = contract.required_fields;
  const keys = Object.keys(contract).sort();
  if (keys.length !== EXPECTED_KEYS.length || keys.some((key, index) => key !== EXPECTED_KEYS[index])) return null;
  if (!Array.isArray(fields) || fields.length !== EXPECTED_FIELDS.length || fields.some((field, index) => field !== EXPECTED_FIELDS[index])) return null;
  if (contract.jira_issue_type !== "Story" || contract.minimum_goal_stories_per_epic !== 2 ||
      contract.minimum_subtasks_per_goal !== 2 || contract.maximum_subtask_hours !== 4 ||
      contract.epic_parent_required !== true || contract.traceability_required !== true) return null;
  return "goal-name,target-completion-date,goal-dod,epic-parent,min-two-subtasks,max-four-hours,traceability";
}

export function goalContractMetadataViolations(contract: JsonObject, documents: readonly IndexedGoalDocument[]): string[] {
  const marker = goalContractMarker(contract);
  const violations: string[] = [];
  if (marker === null) violations.push("canonical-goal-contract");
  for (const document of documents) {
    if (typeof document.goalContractRequired !== "boolean") {
      violations.push(`${document.path}:goal-contract-required-flag`);
    } else if (document.goalContractRequired && (marker === null || document.goalContract !== marker)) {
      violations.push(`${document.path}:goal-contract-marker`);
    } else if (!document.goalContractRequired && document.goalContract !== undefined) {
      violations.push(`${document.path}:unexpected-goal-contract-marker`);
    }
  }
  return violations;
}
