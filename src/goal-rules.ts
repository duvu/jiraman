import type { ErrorObject } from "ajv";

import {
  acceptanceCriteriaIds,
  acceptanceCriterionSemanticErrors,
  goalAcceptanceCriterionErrors,
  localAcceptanceCriterionErrors,
} from "./acceptance-criteria-rules.js";
import { validDate, type JsonObject, type JsonValue } from "./contracts.js";

function objectValue(value: JsonValue | undefined): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function semanticError(instancePath: string, keyword: string, message: string): ErrorObject {
  return {
    instancePath,
    schemaPath: `#/x-goal-contract/${keyword}`,
    keyword,
    params: {},
    message,
  };
}

function backlogErrors(value: JsonValue): ErrorObject[] {
  const backlog = objectValue(value);
  const epic = objectValue(backlog?.epic);
  if (backlog === null || epic === null || !Array.isArray(backlog.stories) || !Array.isArray(epic.story_map)) return [];
  const refs = backlog.stories
    .map((story) => objectValue(story)?.draft_ref)
    .filter((ref): ref is string => typeof ref === "string");
  const storyMap = epic.story_map.filter((ref): ref is string => typeof ref === "string");
  const errors = acceptanceCriterionSemanticErrors(epic.acceptance_criteria, "/epic/acceptance_criteria");
  for (const [index, value] of backlog.stories.entries()) {
    const story = objectValue(value);
    if (story !== null) errors.push(...goalAcceptanceCriterionErrors(story.requirements, story.acceptance_criteria, `/stories/${index}/acceptance_criteria`));
  }
  if (new Set(refs).size !== refs.length) errors.push(semanticError("/stories", "uniqueGoalRefs", "must contain unique Goal Story draft_ref values"));
  for (const ref of new Set([...refs, ...storyMap])) {
    const storyCount = refs.filter((candidate) => candidate === ref).length;
    const mapCount = storyMap.filter((candidate) => candidate === ref).length;
    if (storyCount !== 1 || mapCount !== 1) errors.push(semanticError("/epic/story_map", "exactGoalMap", `${ref} must resolve to exactly one Goal Story and appear once`));
  }
  return errors;
}

function traceabilityRelations(subtasks: readonly JsonValue[], field: "requirements" | "parent_acceptance_criteria_refs"): ReadonlyMap<string, ReadonlySet<string>> {
  const relations = new Map<string, Set<string>>();
  for (const value of subtasks) {
    const subtask = objectValue(value);
    const ref = subtask?.draft_ref;
    const entries = subtask?.[field];
    if (typeof ref !== "string" || !Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (typeof entry !== "string") continue;
      const refs = relations.get(entry) ?? new Set<string>();
      refs.add(ref);
      relations.set(entry, refs);
    }
  }
  return relations;
}

function subtaskErrors(value: JsonValue): ErrorObject[] {
  const packageValue = objectValue(value);
  if (packageValue === null || !Array.isArray(packageValue.subtasks)) return [];
  const refs = packageValue.subtasks
    .map((subtask) => objectValue(subtask)?.draft_ref)
    .filter((ref): ref is string => typeof ref === "string");
  const errors: ErrorObject[] = [];
  if (new Set(refs).size !== refs.length) errors.push(semanticError("/subtasks", "uniqueSubtaskRefs", "must contain unique Sub-task draft_ref values"));
  const goal = objectValue(packageValue.goal);
  if (goal !== null) errors.push(...goalAcceptanceCriterionErrors(goal.requirements, goal.acceptance_criteria, "/goal/acceptance_criteria"));
  const parentCriterionIds = new Set(acceptanceCriteriaIds(goal?.acceptance_criteria) ?? []);
  for (const [index, value] of packageValue.subtasks.entries()) {
    const subtask = objectValue(value);
    if (subtask === null) continue;
    errors.push(...localAcceptanceCriterionErrors(subtask.acceptance_criteria, `/subtasks/${index}/acceptance_criteria`));
    const parentRefs = Array.isArray(subtask.parent_acceptance_criteria_refs)
      ? subtask.parent_acceptance_criteria_refs.filter((ref): ref is string => typeof ref === "string")
      : [];
    if (parentRefs.some((ref) => !parentCriterionIds.has(ref))) {
      errors.push(semanticError(`/subtasks/${index}/parent_acceptance_criteria_refs`, "resolvedParentAcceptanceReference", "must reference only Acceptance Criteria declared by the parent Goal"));
    }
  }
  const traceability = objectValue(packageValue.traceability);
  if (traceability === null) return errors;
  const parentAcceptanceMap = objectValue(traceability.parent_acceptance_criteria);
  if (parentAcceptanceMap !== null && [...parentCriterionIds].some((id) => parentAcceptanceMap[id] === undefined)) {
    errors.push(semanticError("/traceability/parent_acceptance_criteria", "goalAcceptanceSubtaskCoverage", "must map every parent Goal Acceptance Criterion to at least one Sub-task"));
  }
  const expectedByField: Readonly<Record<"requirements" | "parent_acceptance_criteria", ReadonlyMap<string, ReadonlySet<string>>>> = {
    requirements: traceabilityRelations(packageValue.subtasks, "requirements"),
    parent_acceptance_criteria: traceabilityRelations(packageValue.subtasks, "parent_acceptance_criteria_refs"),
  };
  for (const field of ["requirements", "parent_acceptance_criteria"] as const) {
    const map = objectValue(traceability[field]);
    if (map === null) continue;
    const expected = expectedByField[field];
    const mappedIds = new Set(Object.keys(map));
    for (const id of new Set([...expected.keys(), ...mappedIds])) {
      const expectedRefs = expected.get(id);
      const mappedRefs = map[id];
      if (expectedRefs === undefined || !mappedIds.has(id)) {
        errors.push(semanticError(`/traceability/${field}`, "completeTraceability", `${id} must be declared by a Sub-task and mapped exactly once`));
        continue;
      }
      const mapped = Array.isArray(mappedRefs) ? mappedRefs.filter((ref): ref is string => typeof ref === "string") : [];
      const mappedSet = new Set(mapped);
      if (mapped.length !== mappedSet.size || mapped.some((ref) => !refs.includes(ref)) || mappedSet.size !== expectedRefs.size || [...expectedRefs].some((ref) => !mappedSet.has(ref))) {
        errors.push(semanticError(`/traceability/${field}/${id}`, "exactTraceability", "must reference exactly the Sub-tasks declaring this identifier"));
      }
    }
  }
  const goalDod = goal?.definition_of_done;
  const goalDodMap = objectValue(traceability.goal_definition_of_done);
  if (Array.isArray(goalDod) && goalDodMap !== null) {
    const expectedDodIds = goalDod.map((_, index) => `DOD-${index + 1}`);
    if (expectedDodIds.length !== Object.keys(goalDodMap).length || expectedDodIds.some((id) => goalDodMap[id] === undefined)) {
      errors.push(semanticError("/traceability/goal_definition_of_done", "completeGoalDodTraceability", "must map every Goal DoD condition"));
    }
    for (const [id, mappedRefs] of Object.entries(goalDodMap)) {
      if (!Array.isArray(mappedRefs) || mappedRefs.some((ref) => typeof ref !== "string" || !refs.includes(ref))) {
        errors.push(semanticError(`/traceability/goal_definition_of_done/${id}`, "resolvedTraceability", "must reference only declared Sub-tasks"));
      }
    }
  }
  return errors;
}

export function goalDraftSemanticErrors(schemaName: string, value: JsonValue): ErrorObject[] {
  if (schemaName === "backlog-draft.schema.json") return backlogErrors(value);
  if (schemaName === "subtask-draft.schema.json") return subtaskErrors(value);
  if (schemaName === "specification.schema.json") {
    const specification = objectValue(value);
    if (specification === null || !Array.isArray(specification.requirements)) return [];
    const requirementIds = specification.requirements
      .map((requirement) => objectValue(requirement)?.id)
      .filter((id): id is string => typeof id === "string");
    return goalAcceptanceCriterionErrors(requirementIds, specification.acceptance_criteria, "/acceptance_criteria");
  }
  return [];
}

export function goalPolicyMetadataValid(metadata: ReadonlyMap<string, string>): boolean {
  return metadata.get("goal_issue_type") === "Story" &&
    metadata.get("minimum_goal_stories_per_epic") === "2" &&
    metadata.get("minimum_subtasks_per_goal") === "2" &&
    metadata.get("maximum_subtask_hours") === "4" &&
    metadata.get("required_goal_fields") === "goal_name,target_completion_date,acceptance_criteria,definition_of_done";
}

export function confluenceGoalContractViolations(value: JsonObject): string[] {
  if (!Array.isArray(value.goal_register)) return ["missing-goal-register"];
  const violations: string[] = [];
  if (value.goal_register.length < 2) violations.push("minimum-goals");
  for (const [index, item] of value.goal_register.entries()) {
    const goal = objectValue(item);
    if (goal === null || typeof goal.goal_name !== "string" || goal.goal_name.length === 0) violations.push(`goal-${index}:name`);
    if (goal === null || typeof goal.target_completion_date !== "string" || !validDate(goal.target_completion_date)) violations.push(`goal-${index}:deadline`);
    if (goal === null || !Array.isArray(goal.definition_of_done) || goal.definition_of_done.length === 0) violations.push(`goal-${index}:dod`);
    if (goal === null || !Array.isArray(goal.subtasks) || goal.subtasks.length < 2) violations.push(`goal-${index}:subtasks`);
    if (goal !== null && Array.isArray(goal.subtasks) && goal.subtasks.some((item) => {
      const subtask = objectValue(item);
      return subtask === null || typeof subtask.estimate_hours !== "number" || subtask.estimate_hours <= 0 || subtask.estimate_hours > 4;
    })) violations.push(`goal-${index}:estimate`);
  }
  return violations;
}

export function goalPackageSetViolations(backlog: JsonObject, packages: readonly JsonObject[]): string[] {
  if (!Array.isArray(backlog.stories)) return ["missing-goal-stories"];
  const stories = backlog.stories.map(objectValue).filter((value): value is JsonObject => value !== null);
  const storyRefs = stories.map((story) => story.draft_ref).filter((ref): ref is string => typeof ref === "string");
  const packageRefs = packages.map((packageValue) => packageValue.story_ref).filter((ref): ref is string => typeof ref === "string");
  const violations: string[] = [];
  if (new Set(packageRefs).size !== packageRefs.length) violations.push("duplicate-goal-package");
  for (const ref of new Set([...storyRefs, ...packageRefs])) {
    const story = stories.find((candidate) => candidate.draft_ref === ref);
    const matchingPackages = packages.filter((candidate) => candidate.story_ref === ref);
    if (story === undefined || matchingPackages.length !== 1) {
      violations.push(`${ref}:package-count`);
      continue;
    }
    const packageValue = matchingPackages[0];
    const goal = objectValue(packageValue?.goal);
    if (goal === null || goal.goal_name !== story.goal_name || goal.target_completion_date !== story.target_completion_date || JSON.stringify(goal.definition_of_done) !== JSON.stringify(story.definition_of_done)) violations.push(`${ref}:goal-contract-mismatch`);
    if (goal === null || JSON.stringify(goal.acceptance_criteria) !== JSON.stringify(story.acceptance_criteria)) violations.push(`${ref}:acceptance-criteria-content-mismatch`);
    const traceability = objectValue(packageValue?.traceability);
    const requirementMap = objectValue(traceability?.requirements);
    const requirementIds = Array.isArray(story.requirements) ? story.requirements.filter((id): id is string => typeof id === "string") : [];
    const mappedRequirementIds = requirementMap === null ? [] : Object.keys(requirementMap);
    if (new Set(requirementIds).size !== requirementIds.length || requirementIds.length !== mappedRequirementIds.length || requirementIds.some((id) => !mappedRequirementIds.includes(id))) violations.push(`${ref}:requirements-traceability-mismatch`);
    const parentAcceptanceMap = objectValue(traceability?.parent_acceptance_criteria);
    const acceptanceIds = acceptanceCriteriaIds(story.acceptance_criteria) ?? [];
    const mappedAcceptanceIds = parentAcceptanceMap === null ? [] : Object.keys(parentAcceptanceMap);
    if (acceptanceIds.length !== mappedAcceptanceIds.length || acceptanceIds.some((id) => !mappedAcceptanceIds.includes(id))) violations.push(`${ref}:acceptance-criteria-traceability-mismatch`);
  }
  return violations;
}
