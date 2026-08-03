import type { ErrorObject } from "ajv";

import type { JsonObject, JsonValue } from "./contracts.js";

const GENERIC_ASSESSMENT_END = /(?:^|\s)(?:(?:all|everything|it|kết quả|mọi thứ)\s+)?(?:(?:is|are|looks?|seems?|feels?|là|trông|có vẻ|hoạt động|đã)\s+)?(?:good|fine|acceptable|satisfactory|stable|ok(?:ay)?|correct(?:ly)?|pass(?:ed)?|works?|đạt yêu cầu|tốt|đúng|ổn(?: định)?|được|chấp nhận được|kiểm tra)(?:\s+(?:as expected|enough|fully|completely|properly|hoàn toàn|đầy đủ|cơ bản|chung|mong đợi|như mong đợi|xong|hoàn tất))*$/u;

const VERIFICATION_METHOD = /(?:^|[^\p{L}\p{N}])(?:assert(?:ion)?|audit|benchmark|check(?:list)?|compar(?:e|ison)|demo(?:nstration)?|drill|evidence|inspect(?:ion)?|log|measure(?:ment)?|metric|query|report|review|run|scan|test|validat(?:e|ion)|verif(?:y|ication)|walkthrough|bằng chứng|chạy|đo|đối chiếu|duyệt|ghi nhận|kiểm tra|thử|truy vấn|xác minh)(?=$|[^\p{L}\p{N}])/gu;

const VERIFICATION_FILLER = /(?:^|[^\p{L}\p{N}])(?:a|all|an|and|after|anything|are|be|been|before|behavior|by|complete(?:d)?|details?|everything|features?|functionality|is|it|or|outcome|output|pass(?:ed|es)?|results?|something|stuff|that|the|them|then|thing|this|using|via|was|were|with|bằng|cái này|điều đó|được|hoàn tất|kết quả|là|mọi thứ|nó|qua|sau|sử dụng|tất cả|trước|và|xong)(?=$|[^\p{L}\p{N}])/gu;

const COMPLETE_LOCATOR = /^(?:https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]+)?(?:[/?#][^\s]*)?|\.{0,2}\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*(?:[?#][^\s]*)?)$/u;

const TECHNICAL_VERIFICATION = /(?:^|[^\p{L}\p{N}])(?:https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]+)?(?:\/[^\s)\]]*)?|\.{0,2}\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*)(?=$|[^\p{L}\p{N}._/-])/u;

const INCOMPLETE_TECHNICAL_LOCATOR = /(?:https?:\/\/(?=$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}:\/])\.{0,2}\/(?=$|[^\p{L}\p{N}]))/u;

const BRACKETED_SEGMENT = /\[[^\]\r\n]*\](?:\(([^()\s]*)\))?/gu;

const PLACEHOLDER_MARKER = /\b(?:placeholder|tbc|tbd|todo)\b/u;

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

function hasSpecificContentBeyondMethod(value: string): boolean {
  const remainder = value.replace(VERIFICATION_METHOD, " ").replace(VERIFICATION_FILLER, " ");
  return /[\p{L}\p{N}]/u.test(remainder);
}

function hasUnresolvedPlaceholder(value: string): boolean {
  if (PLACEHOLDER_MARKER.test(value)) return true;
  const segments = [...value.matchAll(BRACKETED_SEGMENT)];
  if (segments.some((match) => match[1] === undefined || !COMPLETE_LOCATOR.test(match[1]))) return true;
  return /[\[\]]/u.test(value.replace(BRACKETED_SEGMENT, ""));
}

function isConcreteStatement(value: string): boolean {
  return !hasUnresolvedPlaceholder(value) && !GENERIC_ASSESSMENT_END.test(value) && !IMPLEMENTATION_PREFIXES.some((prefix) => value.startsWith(prefix)) && hasSpecificContentBeyondMethod(value);
}

function isConcreteVerification(value: string): boolean {
  return !hasUnresolvedPlaceholder(value) && !INCOMPLETE_TECHNICAL_LOCATOR.test(value) && !GENERIC_ASSESSMENT_END.test(value) &&
    (TECHNICAL_VERIFICATION.test(value) || (value.match(VERIFICATION_METHOD) !== null && hasSpecificContentBeyondMethod(value)));
}

function canonicalCriterionValue(value: JsonValue): JsonValue {
  if (typeof value === "string") return value.replace(/\r\n/g, "\n");
  if (Array.isArray(value)) return value.map(canonicalCriterionValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalCriterionValue(item)]));
  }
  return value;
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

function acceptanceCriterionShapeErrors(value: JsonValue | undefined, instancePath: string, fields: readonly string[]): ErrorObject[] {
  const criteria = criterionObjects(value);
  if (criteria === null) return [];
  const expected = new Set(fields);
  return criteria.flatMap((criterion, index) => {
    const actual = Object.keys(criterion);
    return actual.length === expected.size && actual.every((field) => expected.has(field))
      ? []
      : [semanticError(`${instancePath}/${index}`, "acceptanceCriterionShape", `must contain exactly ${fields.join(", ")}`)];
  });
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

export function acceptanceCriteriaEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  const leftSnapshots = acceptanceCriterionSnapshots(left);
  const rightSnapshots = acceptanceCriterionSnapshots(right);
  if (leftSnapshots === null || rightSnapshots === null || leftSnapshots.length !== rightSnapshots.length || !Array.isArray(left) || !Array.isArray(right)) return false;
  const normalized = (criteria: readonly JsonValue[]): JsonValue => criteria.map(canonicalCriterionValue);
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
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
      const concrete = field === "statement" ? isConcreteStatement(normalized) : isConcreteVerification(normalized);
      if (!concrete) {
        errors.push(semanticError(`${instancePath}/${index}/${field}`, "testableAcceptanceCriterion", `${field} must describe a concrete observable outcome or verification method`));
      }
    }
  }
  return errors;
}

export function epicAcceptanceCriterionErrors(criteriaValue: JsonValue | undefined, instancePath: string): ErrorObject[] {
  return [
    ...acceptanceCriterionSemanticErrors(criteriaValue, instancePath),
    ...acceptanceCriterionShapeErrors(criteriaValue, instancePath, ["id", "statement", "verification"]),
  ];
}

function goalAcceptanceCriterionErrorsForFields(requirements: JsonValue | undefined, criteriaValue: JsonValue | undefined, instancePath: string, fields: readonly string[]): ErrorObject[] {
  const errors = [
    ...acceptanceCriterionSemanticErrors(criteriaValue, instancePath),
    ...acceptanceCriterionShapeErrors(criteriaValue, instancePath, fields),
  ];
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

export function goalAcceptanceCriterionErrors(requirements: JsonValue | undefined, criteriaValue: JsonValue | undefined, instancePath: string): ErrorObject[] {
  return goalAcceptanceCriterionErrorsForFields(requirements, criteriaValue, instancePath, ["id", "statement", "verification", "requirement_refs"]);
}

export function sourceAcceptanceCriterionErrors(requirements: JsonValue | undefined, criteriaValue: JsonValue | undefined, instancePath: string): ErrorObject[] {
  return goalAcceptanceCriterionErrorsForFields(requirements, criteriaValue, instancePath, ["id", "statement", "verification", "requirement_refs", "source_section"]);
}

export function localAcceptanceCriterionErrors(criteriaValue: JsonValue | undefined, instancePath: string): ErrorObject[] {
  const errors = acceptanceCriterionSemanticErrors(criteriaValue, instancePath);
  errors.push(...acceptanceCriterionShapeErrors(criteriaValue, instancePath, ["id", "statement", "verification", "validation_ref", "definition_of_done_ref"]));
  const criteria = criterionObjects(criteriaValue);
  if (criteria === null) return errors;
  for (const [index, criterion] of criteria.entries()) {
    if (criterion.validation_ref !== "VAL-1" || criterion.definition_of_done_ref !== "DOD-1") {
      errors.push(semanticError(`${instancePath}/${index}`, "localAcceptanceTraceability", "must trace to the Sub-task validation and Definition of Done"));
    }
  }
  return errors;
}
