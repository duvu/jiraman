import type { ErrorObject } from "ajv";

import type { JsonObject, JsonValue } from "./contracts.js";

const VAGUE_TEXT = new Set([
  "đã kiểm tra",
  "đạt yêu cầu",
  "hoạt động đúng",
  "ổn định",
  "ok",
  "stable",
  "tested",
  "works correctly",
]);

const IMPLEMENTATION_PREFIXES = [
  "add ",
  "cập nhật ",
  "fix ",
  "implement ",
  "sửa ",
  "thêm ",
  "triển khai ",
  "update ",
] as const;

const ACCEPTANCE_CRITERION_ID = /^AC-[0-9]+$/;

export interface AcceptanceCriterionSnapshot {
  readonly id: string;
  readonly statement: string;
  readonly verification: string;
}

function objectValue(value: JsonValue | undefined): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizedText(value: string): string {
  return value.toLocaleLowerCase("vi").trim().replace(/\s+/g, " ").replace(/[.!?]+$/g, "");
}

function semanticError(instancePath: string, keyword: string, message: string): ErrorObject {
  return {
    instancePath,
    schemaPath: `#/x-acceptance-criteria/${keyword}`,
    keyword,
    params: {},
    message,
  };
}

function criterionObjects(value: JsonValue | undefined): readonly JsonObject[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const criteria = value.map(objectValue);
  return criteria.every((criterion) => criterion !== null)
    ? criteria.filter((criterion): criterion is JsonObject => criterion !== null)
    : null;
}

function stringIds(value: JsonValue | undefined): readonly string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.length === 0)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

export function acceptanceCriterionSnapshots(value: JsonValue | undefined): readonly AcceptanceCriterionSnapshot[] | null {
  const criteria = criterionObjects(value);
  if (criteria === null) return null;
  const snapshots: AcceptanceCriterionSnapshot[] = [];
  for (const criterion of criteria) {
    if (typeof criterion.id !== "string" || typeof criterion.statement !== "string" || typeof criterion.verification !== "string") return null;
    if (criterion.id.length === 0 || criterion.statement.trim().length === 0 || criterion.verification.trim().length === 0) return null;
    snapshots.push({id: criterion.id, statement: criterion.statement, verification: criterion.verification});
  }
  return new Set(snapshots.map((criterion) => criterion.id)).size === snapshots.length ? snapshots : null;
}

export function acceptanceCriteriaIds(value: JsonValue | undefined): readonly string[] | null {
  return acceptanceCriterionSnapshots(value)?.map((criterion) => criterion.id) ?? null;
}

export function acceptanceCriterionSemanticErrors(value: JsonValue | undefined, instancePath: string): ErrorObject[] {
  const criteria = criterionObjects(value);
  if (criteria === null) return [];
  const errors: ErrorObject[] = [];
  const ids = criteria.map((criterion) => criterion.id).filter((id): id is string => typeof id === "string");
  if (new Set(ids).size !== ids.length) {
    errors.push(semanticError(instancePath, "uniqueAcceptanceCriterionIds", "Acceptance Criterion IDs must be unique within the ticket"));
  }
  for (const [index, criterion] of criteria.entries()) {
    if (typeof criterion.id === "string" && !ACCEPTANCE_CRITERION_ID.test(criterion.id)) {
      errors.push(semanticError(`${instancePath}/${index}/id`, "acceptanceCriterionId", "must be an uppercase AC identifier"));
    }
    for (const field of ["statement", "verification"] as const) {
      const text = criterion[field];
      if (typeof text !== "string" || text.trim().length === 0) continue;
      const normalized = normalizedText(text);
      if (VAGUE_TEXT.has(normalized) || (field === "statement" && IMPLEMENTATION_PREFIXES.some((prefix) => normalized.startsWith(prefix)))) {
        errors.push(semanticError(`${instancePath}/${index}/${field}`, "testableAcceptanceCriterion", `${field} must describe a concrete observable outcome or verification method`));
      }
    }
  }
  return errors;
}

export function goalAcceptanceCriterionErrors(requirements: JsonValue | undefined, criteriaValue: JsonValue | undefined, instancePath: string): ErrorObject[] {
  const errors = acceptanceCriterionSemanticErrors(criteriaValue, instancePath);
  const criteria = criterionObjects(criteriaValue);
  const requirementIds = stringIds(requirements);
  if (criteria === null || requirementIds === null) return errors;
  const declared = new Set(requirementIds);
  const covered = new Set<string>();
  for (const [index, criterion] of criteria.entries()) {
    const refs = stringIds(criterion.requirement_refs);
    if (refs === null || refs.some((ref) => !declared.has(ref))) {
      errors.push(semanticError(`${instancePath}/${index}/requirement_refs`, "requirementAcceptanceCoverage", "must reference only declared requirements"));
      continue;
    }
    for (const ref of refs) covered.add(ref);
  }
  for (const requirementId of declared) {
    if (!covered.has(requirementId)) {
      errors.push(semanticError(instancePath, "requirementAcceptanceCoverage", `${requirementId} must be covered by at least one Acceptance Criterion`));
    }
  }
  return errors;
}

export function localAcceptanceCriterionErrors(criteriaValue: JsonValue | undefined, instancePath: string): ErrorObject[] {
  const errors = acceptanceCriterionSemanticErrors(criteriaValue, instancePath);
  const criteria = criterionObjects(criteriaValue);
  if (criteria === null) return errors;
  for (const [index, criterion] of criteria.entries()) {
    if (criterion.validation_ref !== "VAL-1" || criterion.definition_of_done_ref !== "DOD-1") {
      errors.push(semanticError(`${instancePath}/${index}`, "localAcceptanceTraceability", "must trace to the Sub-task validation and Definition of Done"));
    }
  }
  return errors;
}
