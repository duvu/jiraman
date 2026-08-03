import type { JsonObject, JsonValue } from "./contracts.js";

export interface IndexedGoalDocument {
  readonly path: string;
  readonly goalContractRequired: JsonValue | undefined;
  readonly goalContract: string | undefined;
}

export interface IndexedGoalTemplate {
  readonly path: string;
  readonly goalContractRequired: JsonValue | undefined;
  readonly requiredGoalSections: JsonValue | undefined;
  readonly text: string;
}

const EXPECTED_FIELDS = ["goal_name", "target_completion_date", "acceptance_criteria", "definition_of_done"] as const;
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
  return "goal-name,target-completion-date,structured-ac,goal-dod,epic-parent,min-two-subtasks,max-four-hours,traceability";
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

function markerCount(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

export function goalTemplateSectionViolations(templates: readonly IndexedGoalTemplate[]): string[] {
  const violations: string[] = [];
  for (const template of templates) {
    const rawSections = template.requiredGoalSections;
    if (!Array.isArray(rawSections) || rawSections.some((section) => typeof section !== "string" || !/^[a-z0-9-]+$/.test(section))) {
      violations.push(`${template.path}:required-goal-sections`);
      continue;
    }
    const sections = rawSections.filter((section): section is string => typeof section === "string");
    if (new Set(sections).size !== sections.length) violations.push(`${template.path}:duplicate-goal-section`);
    if (template.goalContractRequired === true && sections.length === 0) violations.push(`${template.path}:missing-goal-sections`);
    if (template.goalContractRequired === false && sections.length > 0) violations.push(`${template.path}:unexpected-goal-sections`);
    const declared = new Set(sections);
    const discovered = [...template.text.matchAll(/<!-- JIRAMAN:GOAL-SECTION:([a-z0-9-]+):(?:BEGIN|END) -->/g)]
      .map((match) => match[1]).filter((section): section is string => section !== undefined);
    if (discovered.some((section) => !declared.has(section))) violations.push(`${template.path}:undeclared-goal-section-marker`);
    for (const section of sections) {
      const begin = `<!-- JIRAMAN:GOAL-SECTION:${section}:BEGIN -->`;
      const end = `<!-- JIRAMAN:GOAL-SECTION:${section}:END -->`;
      if (markerCount(template.text, begin) !== 1 || markerCount(template.text, end) !== 1) {
        violations.push(`${template.path}:${section}:markers`);
        continue;
      }
      const start = template.text.indexOf(begin) + begin.length;
      const finish = template.text.indexOf(end, start);
      const content = finish < start ? "" : template.text.slice(start, finish).trim();
      if (content.length === 0 || !/^##\s+\S/m.test(content)) violations.push(`${template.path}:${section}:content`);
    }
  }
  return violations;
}
