#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "--validate-state-file" ]]; then
  [[ "$#" -eq 2 ]] || { echo "usage: ./verify.sh --validate-state-file PATH" >&2; exit 2; }
  node - "$2" <<'NODE' || exit $?
const fs = require("fs");
const crypto = require("crypto");
let state;
try { state = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); } catch { process.exit(4); }
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => object(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const nonEmpty = (value) => typeof value === "string" && value.length > 0;
const stringArray = (value, nonempty = false) => Array.isArray(value) && (!nonempty || value.length > 0) && value.every(nonEmpty);
const unique = (value) => Array.isArray(value) && new Set(value).size === value.length;
const validDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
};
const validDateTime = (value) => {
  if (typeof value !== "string") return false;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  return match !== null && validDate(match[1]) && Number(match[2]) <= 23 && Number(match[3]) <= 59 && Number(match[4]) <= 59 && Number(match[5] ?? 0) <= 23 && Number(match[6] ?? 0) <= 59;
};
const groupId = (value) => typeof value === "string" && /^PMG-[0-9]{8}-[0-9]{2}$/.test(value);
const actionId = (value) => typeof value === "string" && /^PMA-[0-9]{8}-[0-9]{2}$/.test(value);
const stateId = (value) => typeof value === "string" && /^PM[AG]-[0-9]{8}-[0-9]{2}$/.test(value);
const statuses = new Set(["proposed", "approved", "rejected", "stale", "applying", "applied", "failed", "verification-failed"]);
const operations = new Set(["issue.create", "issue.update", "issue.reuse", "issue.comment", "issue.link", "issue.transition", "page.create", "page.update", "page.section-update", "page.comment"]);
const updateOperations = new Set(["issue.update", "page.update", "page.section-update"]);
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const compareCodeUnits = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.entries(value).sort(([left], [right]) => compareCodeUnits(left, right)).map(([key, item]) => [key, canonical(item)]));
  return value;
};
const canonicalPayloadHash = (actions) => {
  const immutable = actions
    .map((action) => Object.fromEntries(Object.entries(action).filter(([key]) => key !== "status")))
    .sort((left, right) => compareCodeUnits(left.id, right.id));
  return crypto.createHash("sha256").update(JSON.stringify(canonical(immutable))).digest("hex");
};
const literalPreservation = (value) => exact(value, ["policy_ref", "mode"]) &&
  value.policy_ref === ".kilo/config/jiraman.json#/language/preserved_literal_kinds" && value.mode === "exact";
const languageTag = (value) => {
  if (typeof value !== "string" || !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value)) return false;
  try { Intl.getCanonicalLocales(value); return true; } catch (error) { if (error instanceof RangeError) return false; throw error; }
};
const onlyFields = (value, fields) => Object.keys(value).every((field) => fields.has(field));
const managedFields = new Set(["acceptance_criteria", "content_language", "description_update_mode", "existing_content_mode", "language_override", "literal_preservation", "managed_content", "managed_section"]);
const commentFields = new Set(["acceptance_criteria", "body", "comment", "content_language", "existing_content_mode", "language_override", "literal_preservation", "managed_content_only", "purpose"]);
const genericAssessmentEnd = /(?:^|\s)(?:(?:all|everything|it|kết quả|mọi thứ)\s+)?(?:(?:is|are|looks?|seems?|feels?|là|trông|có vẻ|hoạt động|đã)\s+)?(?:good|fine|acceptable|satisfactory|stable|ok(?:ay)?|correct(?:ly)?|pass(?:ed)?|works?|đạt yêu cầu|tốt|đúng|ổn(?: định)?|được|chấp nhận được|kiểm tra)(?:\s+(?:as expected|enough|fully|completely|properly|hoàn toàn|đầy đủ|cơ bản|chung|mong đợi|như mong đợi|xong|hoàn tất))*$/u;
const verificationMethod = /(?:^|[^\p{L}\p{N}])(?:assert(?:ion)?|audit|benchmark|check(?:list)?|compar(?:e|ison)|demo(?:nstration)?|drill|evidence|inspect(?:ion)?|log|measure(?:ment)?|metric|query|report|review|run|scan|test|validat(?:e|ion)|verif(?:y|ication)|walkthrough|bằng chứng|chạy|đo|đối chiếu|duyệt|ghi nhận|kiểm tra|so sánh|thử|truy vấn|xác minh)(?=$|[^\p{L}\p{N}])/gu;
const verificationFiller = /(?:^|[^\p{L}\p{N}])(?:a|all|an|and|after|anything|are|be|been|before|behavior|by|complete(?:d)?|details?|everything|features?|functionality|is|it|or|outcome|output|pass(?:ed|es)?|results?|something|stuff|that|the|them|then|thing|this|using|via|was|were|with|bằng|cái này|điều đó|được|hoàn tất|kết quả|là|mọi thứ|nó|qua|sau|sử dụng|tất cả|trước|và|xong)(?=$|[^\p{L}\p{N}])/gu;
const completeLocator = /^(?:https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]+)?(?:[/?#][^\s]*)?|\.{0,2}\/[a-z0-9_.-][^\s]*)$/u;
const technicalVerification = /(?:^|[^\p{L}\p{N}])(?:https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]+)?(?:\/[^\s)\]]*)?|\.{0,2}\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*)(?=$|[^\p{L}\p{N}._\/-])/u;
const incompleteTechnicalLocator = /(?:https?:\/\/(?=$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}:\/])\.{0,2}\/(?=$|[^\p{L}\p{N}]))/u;
const placeholderMarker = /\b(?:placeholder|tbc|tbd|todo)\b/u;
const implementationPrefixes = ["add ", "cập nhật ", "fix ", "implement ", "sửa ", "thêm ", "triển khai ", "update "];
const normalizedText = (value) => value.toLocaleLowerCase("vi").trim().replace(/\s+/g, " ").replace(/[.!?]+$/g, "");
const specificBeyondMethod = (value) => /[\p{L}\p{N}]/u.test(value.replace(verificationMethod, " ").replace(verificationFiller, " "));
const markdownLinksValid = (value) => {
  let index = 0;
  while (index < value.length) {
    if (value[index] === "]") return false;
    if (value[index] !== "[") { index += 1; continue; }
    const labelEnd = value.indexOf("]", index + 1);
    if (labelEnd < 0 || labelEnd === index + 1 || value.slice(index + 1, labelEnd).includes("[") || value[labelEnd + 1] !== "(") return false;
    let destinationEnd = labelEnd + 2, depth = 1;
    while (destinationEnd < value.length && depth > 0) {
      if (value[destinationEnd] === "(") depth += 1;
      if (value[destinationEnd] === ")") depth -= 1;
      destinationEnd += 1;
    }
    if (depth !== 0 || !completeLocator.test(value.slice(labelEnd + 2, destinationEnd - 1))) return false;
    index = destinationEnd;
  }
  return true;
};
const unresolvedPlaceholder = (value) => placeholderMarker.test(value) || !markdownLinksValid(value);
const concreteStatement = (raw) => {
  const value = normalizedText(raw);
  return !unresolvedPlaceholder(value) && !genericAssessmentEnd.test(value) && !implementationPrefixes.some((prefix) => value.startsWith(prefix)) && specificBeyondMethod(value);
};
const concreteVerification = (raw) => {
  const value = normalizedText(raw);
  return !unresolvedPlaceholder(value) && !incompleteTechnicalLocator.test(value) && !genericAssessmentEnd.test(value) &&
    (technicalVerification.test(value) || (value.match(verificationMethod) !== null && specificBeyondMethod(value)));
};
const validJiraLanguageAction = (action) => {
  if (action.system !== "jira" || !["issue.create", "issue.update", "issue.comment"].includes(action.operation)) return true;
  const desired = action.desired_state;
  if (!languageTag(desired.content_language) || !literalPreservation(desired.literal_preservation)) return false;
  if (desired.content_language !== "vi-VN" || desired.language_override !== undefined || desired.translation_authorization !== undefined) return false;
  if (!["issue.update", "issue.comment"].includes(action.operation)) return true;
  const before = action.before_state;
  if (before.issue_key !== action.target_ref || !nonEmpty(before.human_content_language)) return false;
  if (action.operation === "issue.comment") {
    return onlyFields(desired, commentFields) && (before.human_content_language === "vi-VN" || desired.existing_content_mode === "preserve-human-content");
  }
  if (before.human_content_language === "vi-VN") return true;
  if (desired.existing_content_mode === "managed-section-only") {
    return desired.description_update_mode === "managed-section" && nonEmpty(desired.managed_section) &&
      desired.description === undefined && desired.summary === undefined && onlyFields(desired, managedFields);
  }
  return false;
};
const hierarchyType = (value) => ["Epic", "Story", "Sub-task"].includes(value) ? value : null;
const criterionIds = (criteria, kind, requirements = []) => {
  if (!Array.isArray(criteria) || criteria.length === 0) return null;
  const shapes = {
    Epic: ["id", "statement", "verification"],
    Story: ["id", "statement", "verification", "requirement_refs"],
    "Sub-task": ["id", "statement", "verification", "validation_ref", "definition_of_done_ref"],
  };
  const ids = [], covered = new Set(), declared = new Set(requirements);
  for (const criterion of criteria) {
    if (!exact(criterion, shapes[kind]) || !/^AC-[0-9]+$/.test(criterion.id) || !nonEmpty(criterion.statement) || !nonEmpty(criterion.verification) ||
        !concreteStatement(criterion.statement) || !concreteVerification(criterion.verification)) return null;
    if (kind === "Story") {
      if (!stringArray(criterion.requirement_refs, true) || !unique(criterion.requirement_refs) || criterion.requirement_refs.some((ref) => !declared.has(ref))) return null;
      for (const ref of criterion.requirement_refs) covered.add(ref);
    }
    if (kind === "Sub-task" && (criterion.validation_ref !== "VAL-1" || criterion.definition_of_done_ref !== "DOD-1")) return null;
    ids.push(criterion.id);
  }
  if (!unique(ids) || (kind === "Story" && requirements.some((ref) => !covered.has(ref)))) return null;
  return ids;
};
const hierarchyState = (kind, value, ref) => {
  if (kind === "Epic") return nonEmpty(ref) && nonEmpty(value.summary) && languageTag(value.content_language) && value.acceptance_criteria_storage === "managed-description-section" && criterionIds(value.acceptance_criteria, kind) !== null;
  if (kind === "Story") {
    const deadline = value.target_completion_date_evidence;
    return nonEmpty(value.parent_ref) && nonEmpty(value.goal_name) && value.summary === value.goal_name && validDate(value.target_completion_date) && value.due_date === value.target_completion_date &&
      object(deadline) && ["sprint-end", "milestone", "specification", "explicit-user-decision"].includes(deadline.source) && nonEmpty(deadline.reference) && deadline.verified === true &&
      stringArray(value.definition_of_done, true) && nonEmpty(value.canonical_spec) && stringArray(value.requirements, true) && unique(value.requirements) &&
      languageTag(value.content_language) && value.acceptance_criteria_storage === "managed-description-section" && stringArray(value.validation, true) && criterionIds(value.acceptance_criteria, kind, value.requirements) !== null;
  }
  return nonEmpty(value.parent_ref) && nonEmpty(value.summary) && nonEmpty(value.outcome) && nonEmpty(value.validation) && nonEmpty(value.definition_of_done) &&
    typeof value.original_estimate_hours === "number" && value.original_estimate_hours > 0 && value.original_estimate_hours <= 4 &&
    stringArray(value.requirements, true) && unique(value.requirements) && stringArray(value.parent_acceptance_criteria_refs, true) && unique(value.parent_acceptance_criteria_refs) &&
    languageTag(value.content_language) && value.acceptance_criteria_storage === "managed-description-section" && criterionIds(value.acceptance_criteria, kind) !== null;
};
const validHierarchyActions = (actions) => {
  const candidates = [];
  for (const [index, action] of actions.entries()) {
    if (action.system === "jira" && action.operation === "issue.comment") {
      const before = action.before_state, desired = action.desired_state, kind = hierarchyType(before.issue_type);
      const requirements = kind === "Story" && Array.isArray(before.requirements) ? before.requirements : [];
      const targetMissingAcceptance = kind !== null && criterionIds(before.acceptance_criteria, kind, requirements) === null;
      if (targetMissingAcceptance || desired.purpose === "acceptance-criteria-gap") {
        const targetValid = kind !== null && before.project === "AIPLATFORM" && before.issue_key === action.target_ref && /^AIPLATFORM-[0-9]+$/.test(action.target_ref) &&
          (kind !== "Story" || (stringArray(before.requirements, true) && unique(before.requirements)));
        const commentValid = targetMissingAcceptance && desired.purpose === "acceptance-criteria-gap" && desired.content_language === "vi-VN" &&
          desired.managed_content_only === true && targetValid && criterionIds(desired.acceptance_criteria, kind, requirements) !== null;
        if (!commentValid) return false;
        if (kind === "Story") candidates.push({index, create: false, validatesParentage: false, kind, ref: action.target_ref, parentRef: null, parentState: null, state: {...before, acceptance_criteria: desired.acceptance_criteria}});
      }
      continue;
    }
    if (action.system !== "jira" || !["issue.create", "issue.update", "issue.reuse"].includes(action.operation)) continue;
    const create = action.operation === "issue.create", reuse = action.operation === "issue.reuse";
    const authoritative = create ? action.desired_state : action.before_state;
    const kind = hierarchyType(authoritative.issue_type);
    if (kind === null || authoritative.project !== "AIPLATFORM") return false;
    if (["parent_state", "parent_issue_type", "parent_project", "parent_requirement_ids", "parent_acceptance_criteria_ids"].some((field) => action.desired_state[field] !== undefined)) return false;
    if (reuse && (!exact(action.desired_state, ["reuse"]) || action.desired_state.reuse !== true)) return false;
    if (!create && !reuse && ((action.desired_state.issue_type !== undefined && action.desired_state.issue_type !== kind) ||
        (action.desired_state.project !== undefined && action.desired_state.project !== authoritative.project))) return false;
    if (action.operation === "issue.update") {
      const desired = action.desired_state;
      if (desired.description !== undefined && (desired.description_update_mode !== "approved-full-translation" || desired.existing_content_mode !== "approved-full-translation")) return false;
      if (desired.description === undefined && desired.acceptance_criteria !== undefined && (desired.description_update_mode !== "managed-section" || desired.managed_section !== "acceptance-criteria")) return false;
    }
    const effective = create ? action.desired_state : reuse ? action.before_state : {...action.before_state, ...action.desired_state, issue_type: kind, project: authoritative.project};
    const ref = nonEmpty(effective.draft_ref) ? effective.draft_ref : action.target_ref;
    if (!hierarchyState(kind, effective, ref)) return false;
    candidates.push({index, create, validatesParentage: true, kind, ref, parentRef: nonEmpty(effective.parent_ref) ? effective.parent_ref : null, parentState: object(action.before_state.parent_state) ? action.before_state.parent_state : null, state: effective});
  }
  if (!unique(candidates.map((candidate) => candidate.ref))) return false;
  const byRef = new Map(candidates.map((candidate) => [candidate.ref, candidate]));
  for (const candidate of candidates.filter((item) => item.kind !== "Epic" && item.validatesParentage)) {
    const expected = candidate.kind === "Story" ? "Epic" : "Story";
    const parent = candidate.parentRef === null ? null : byRef.get(candidate.parentRef) ?? null;
    if (parent !== null ? parent.kind !== expected : candidate.parentState?.issue_key !== candidate.parentRef || candidate.parentState?.issue_type !== expected || candidate.parentState?.project !== "AIPLATFORM") return false;
    if (candidate.kind === "Sub-task") {
      const contract = parent?.state ?? candidate.parentState;
      if (!object(contract) || !stringArray(contract.requirements, true) || !unique(contract.requirements)) return false;
      const parentIds = criterionIds(contract.acceptance_criteria, "Story", contract.requirements);
      if (parentIds === null || candidate.state.requirements.some((ref) => !contract.requirements.includes(ref)) || candidate.state.parent_acceptance_criteria_refs.some((ref) => !parentIds.includes(ref))) return false;
    }
  }
  for (const epic of candidates.filter((candidate) => candidate.create && candidate.kind === "Epic")) {
    if (candidates.filter((candidate) => candidate.kind === "Story" && candidate.parentRef === epic.ref).length < 2) return false;
  }
  for (const story of candidates.filter((candidate) => candidate.kind === "Story")) {
    const children = candidates.filter((candidate) => candidate.kind === "Sub-task" && candidate.parentRef === story.ref);
    if (story.create && children.length < 2) return false;
    const implemented = new Set(children.flatMap((child) => child.state.parent_acceptance_criteria_refs));
    const storyIds = criterionIds(story.state.acceptance_criteria, "Story", story.state.requirements);
    if (storyIds === null || storyIds.some((id) => !implemented.has(id))) return false;
  }
  return true;
};
const validAction = (value) => {
  const keys = ["id", "system", "operation", "target_ref", "target_version", "before_state", "desired_state", "evidence", "reason", "preconditions", "dependencies", "risk", "approval_required", "expires_at", "rollback_guidance", "status"];
  if (!exact(value, keys)) return false;
  const targetVersion = value.target_version;
  const validTargetVersion = targetVersion === null || typeof targetVersion === "string" || Number.isInteger(targetVersion);
  const updateTarget = !updateOperations.has(value.operation) || (targetVersion !== null || (object(value.before_state) && Object.keys(value.before_state).length > 0));
  const reuseTarget = value.operation !== "issue.reuse" || (value.system === "jira" && targetVersion !== null && object(value.before_state) && Object.keys(value.before_state).length > 0 && exact(value.desired_state, ["reuse"]) && value.desired_state.reuse === true);
  const systemOperation = value.operation.startsWith("issue.") ? value.system === "jira" : value.operation.startsWith("page.") && value.system === "confluence";
  return actionId(value.id) && ["jira", "confluence"].includes(value.system) && operations.has(value.operation) && nonEmpty(value.target_ref) && validTargetVersion &&
    object(value.before_state) && object(value.desired_state) && Object.keys(value.desired_state).length > 0 && stringArray(value.evidence, true) && nonEmpty(value.reason) &&
    stringArray(value.preconditions, true) && stringArray(value.dependencies) && unique(value.dependencies) && value.dependencies.every(actionId) &&
    ["low", "medium", "high"].includes(value.risk) && ["group", "per-action"].includes(value.approval_required) &&
    (value.risk !== "high" || value.approval_required === "per-action") && validDateTime(value.expires_at) && nonEmpty(value.rollback_guidance) && statuses.has(value.status) && updateTarget && reuseTarget && systemOperation;
};
const validApproval = (value) => exact(value, ["group_approved_by", "approved_action_ids", "approved_at", "payload_hash"]) &&
  (value.group_approved_by === null || nonEmpty(value.group_approved_by)) && Array.isArray(value.approved_action_ids) && unique(value.approved_action_ids) && value.approved_action_ids.every(actionId) &&
  (value.approved_at === null || validDateTime(value.approved_at)) && (value.payload_hash === null || hash(value.payload_hash));
const sameSet = (left, right) => left.length === right.length && left.every((item) => right.includes(item));
const acyclic = (actions) => {
  const byId = new Map(actions.map((action) => [action.id, action]));
  const visiting = new Set(), visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const dependency of byId.get(id).dependencies) if (!visit(dependency)) return false;
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  return actions.every((action) => visit(action.id));
};
const validGroup = (value) => {
  if (!exact(value, ["schema_version", "id", "project", "summary", "created_at", "expires_at", "status", "payload_hash", "approval", "actions"]) ||
      value.schema_version !== 5 || !groupId(value.id) || value.project !== "AIPLATFORM" || !nonEmpty(value.summary) ||
      !validDateTime(value.created_at) || !validDateTime(value.expires_at) || Date.parse(value.created_at) >= Date.parse(value.expires_at) ||
      !statuses.has(value.status) || !hash(value.payload_hash) || !validApproval(value.approval) ||
      !Array.isArray(value.actions) || value.actions.length === 0 || !value.actions.every(validAction)) return false;
  if (!value.actions.every(validJiraLanguageAction) || !validHierarchyActions(value.actions)) return false;
  const ids = value.actions.map((action) => action.id);
  if (!unique(ids) || value.actions.some((action) => action.dependencies.includes(action.id) || action.dependencies.some((dependency) => !ids.includes(dependency))) || !acyclic(value.actions)) return false;
  if (value.actions.some((action) => Date.parse(action.expires_at) > Date.parse(value.expires_at))) return false;
  if (value.payload_hash !== canonicalPayloadHash(value.actions)) return false;
  const approval = value.approval;
  const emptyApproval = approval.group_approved_by === null && approval.approved_at === null && approval.payload_hash === null && approval.approved_action_ids.length === 0;
  const completeApproval = nonEmpty(approval.group_approved_by) && validDateTime(approval.approved_at) && approval.payload_hash === value.payload_hash && sameSet(approval.approved_action_ids, ids);
  if (!emptyApproval && !completeApproval) return false;
  if (approval.approved_action_ids.some((id) => !ids.includes(id))) return false;
  const executable = ["approved", "applying", "applied", "failed", "verification-failed"].includes(value.status);
  if (executable && !completeApproval) return false;
  if (value.status === "proposed" && !emptyApproval) return false;
  const actionStatuses = value.actions.map((action) => action.status);
  const lifecycleValid =
    (value.status === "proposed" && actionStatuses.every((status) => status === "proposed")) ||
    (value.status === "approved" && actionStatuses.every((status) => status === "approved")) ||
    (value.status === "rejected" && actionStatuses.includes("rejected") && actionStatuses.every((status) => ["proposed", "approved", "rejected"].includes(status))) ||
    (value.status === "stale" && actionStatuses.every((status) => status === "stale")) ||
    (value.status === "applying" && actionStatuses.includes("applying") && actionStatuses.every((status) => ["approved", "applying", "applied", "failed", "verification-failed"].includes(status))) ||
    (value.status === "applied" && actionStatuses.every((status) => status === "applied")) ||
    (value.status === "failed" && actionStatuses.includes("failed") && actionStatuses.every((status) => ["approved", "applied", "failed"].includes(status))) ||
    (value.status === "verification-failed" && actionStatuses.includes("verification-failed") && actionStatuses.every((status) => ["approved", "applied", "verification-failed"].includes(status)));
  if (!lifecycleValid) return false;
  return true;
};
const validRun = (value) => exact(value, ["workflow_id", "command_mode", "started_at", "ended_at", "capability_health", "tool_results", "action_ids", "verification_result", "artifact_refs"]) &&
  nonEmpty(value.workflow_id) && nonEmpty(value.command_mode) && validDateTime(value.started_at) && validDateTime(value.ended_at) && ["healthy", "degraded", "blocked"].includes(value.capability_health) &&
  Array.isArray(value.tool_results) && value.tool_results.every((item) => ["success", "tool-failure", "missing-evidence", "policy-rejection", "stale-action", "verification-failure"].includes(item)) &&
  Array.isArray(value.action_ids) && unique(value.action_ids) && value.action_ids.every(stateId) && ["passed", "failed", "not-applicable", "not-verified"].includes(value.verification_result) && stringArray(value.artifact_refs);
const stateKeys = ["schema_version", "project", "pending_action_groups", "deliverable_candidates", "run_records", "migration"];
const looksV5 = exact(state, stateKeys);
const validMigration = exact(state?.migration, ["legacy_state_file", "reapproval_required_ids"]) && (state.migration.legacy_state_file === null || typeof state.migration.legacy_state_file === "string") &&
  Array.isArray(state.migration.reapproval_required_ids) && unique(state.migration.reapproval_required_ids) && state.migration.reapproval_required_ids.every(stateId);
const valid = looksV5 && state.schema_version === 5 && state.project === "AIPLATFORM" && object(state.pending_action_groups) && Object.entries(state.pending_action_groups).every(([key, value]) => validGroup(value) && key === value.id) &&
  object(state.deliverable_candidates) && Object.entries(state.deliverable_candidates).every(([key, value]) => /^DLV-[0-9]{8}-[0-9]{2}$/.test(key) && object(value)) &&
  Array.isArray(state.run_records) && state.run_records.length <= 100 && state.run_records.every(validRun) && validMigration;
const recognizableLegacy = object(state) && Object.prototype.hasOwnProperty.call(state, "pending_actions");
const declaresV5 = object(state) && state.schema_version === 5;
process.exit(valid ? 0 : recognizableLegacy ? 3 : declaresV5 ? 5 : 3);
NODE
  exit 0
fi
SOURCE=0
if [[ "${1:-}" == "--source-tree" ]]; then SOURCE=1; ROOT="$SCRIPT_DIR"; else ROOT="${1:-$PWD}"; fi
ROOT="$(cd "$ROOT" && pwd)"
if [[ "$SOURCE" -eq 0 && "$ROOT" == "$SCRIPT_DIR/template" ]]; then SOURCE=1; ROOT="$SCRIPT_DIR"; fi
MANIFEST="$SCRIPT_DIR/packaging/managed-files.txt"
failed=0
while IFS= read -r relative; do
  path="$ROOT/$relative"
  if [[ "$SOURCE" -eq 1 ]]; then path="$ROOT/template/$relative"; fi
  if [[ -f "$path" ]]; then
    if [[ "$SOURCE" -eq 0 && "$relative" != ".kilo/state/jiraman.json" && ! "$SCRIPT_DIR/template/$relative" -ef "$path" ]] && ! cmp -s "$SCRIPT_DIR/template/$relative" "$path"; then
      echo "FAIL managed content drift: $relative"
      failed=1
    else
      echo "OK   $relative"
    fi
  else
    echo "MISS $relative"
    failed=1
  fi
done < "$MANIFEST"

agent="$ROOT/.kilo/agents/jiraman.md"
command="$ROOT/.kilo/commands/jiraman.md"
config_root="$ROOT/.kilo/config"
state="$ROOT/.kilo/state/jiraman.json"
if [[ "$SOURCE" -eq 1 ]]; then
  agent="$ROOT/template/.kilo/agents/jiraman.md"; command="$ROOT/template/.kilo/commands/jiraman.md"; config_root="$ROOT/template/.kilo/config"; state="$ROOT/template/.kilo/state/jiraman.json"
fi
if grep -q '^agent: jiraman$' "$command" && grep -q '^write_mode: exact-apply-only$' "$agent"; then echo "OK   canonical agent routing"; else echo "FAIL canonical agent routing"; failed=1; fi
if grep -q '^project: AIPLATFORM$' "$agent" && grep -q '^mcp_server: mcp-atlassian$' "$agent" && grep -q '^untrusted_content: evidence-only$' "$agent"; then echo "OK   primary safety metadata"; else echo "FAIL primary safety metadata"; failed=1; fi
if ! command -v node >/dev/null 2>&1; then echo "FAIL Node is required for verification tooling"; exit 1; fi
if ! node - "$config_root" "$state" <<'NODE'
const fs=require("fs"), path=require("path");
const [configRoot]=process.argv.slice(2);
const object=(value)=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const config=JSON.parse(fs.readFileSync(path.join(configRoot,"jiraman.json"),"utf8"));
const router=JSON.parse(fs.readFileSync(path.join(configRoot,"command-router.json"),"utf8"));
const mcp=JSON.parse(fs.readFileSync(path.join(configRoot,"mcp-atlassian.json"),"utf8"));
const literalKinds=["jira-key","req-id","ac-id","pmg-id","pma-id","dlv-id","issue-type","status","custom-field","source-excerpt","jql","json-key","mcp-tool","mcp-schema","technical-term","code-symbol","path","command","url","code-block","stack-trace","log"];
const technicalTerms=["API","CI/CD","Kubernetes","OAuth","OpenID Connect"];
const language=config.language;
if(config.schema_version!==5||config.project?.key!=="AIPLATFORM"||!object(language)||language.jira_ticket_content!=="vi-VN"||language.user_response!=="vi-VN"||language.mcp_schema_and_query!=="preserve"||language.explicit_override_allowed!==true||language.existing_ticket_mode!=="preserve-human-content"||JSON.stringify(language.preserved_literal_kinds)!==JSON.stringify(literalKinds)||JSON.stringify(language.preserved_technical_terms)!==JSON.stringify(technicalTerms)||!object(config.confluence)||!object(config.delivery)||!object(config.actions)||!object(config.state)) throw new Error("invalid config contract");
if(router.schema_version!==5||router.default_mode!=="daily"||!object(router.canonical)||!object(router.aliases)||router.canonical.apply!=="jiraman-apply-actions") throw new Error("invalid router contract");
if(mcp.schema_version!==5||mcp.server_ownership!=="external-user-owned"||!Array.isArray(mcp.capabilities)||!object(mcp.profiles)||!Array.isArray(mcp.denied)) throw new Error("invalid MCP contract");
NODE
then echo "FAIL JSON contract validation"; failed=1; else echo "OK   JSON contracts"; fi
if "$SCRIPT_DIR/verify.sh" --validate-state-file "$state"; then echo "OK   state schema contract"; else echo "FAIL state schema contract"; failed=1; fi
if ! node - "$ROOT" "$SOURCE" <<'NODE'
const fs=require("fs"), path=require("path");
const [root,source]=process.argv.slice(2);
const prefix=source==="1"?path.join(root,"template"):root;
const index=JSON.parse(fs.readFileSync(path.join(prefix,".kilo/skills/index.json"),"utf8"));
for(const skill of index.skills){if(!fs.existsSync(path.join(prefix,skill.path))) throw new Error(`missing ${skill.path}`)}
NODE
then echo "FAIL broken skill index"; failed=1; else echo "OK   skill references"; fi
if [[ "$SOURCE" -eq 0 ]]; then
  for pattern in ".kilo/state/" ".jiraman-backup-*/"; do if ! grep -qxF "$pattern" "$ROOT/.gitignore"; then echo "FAIL missing gitignore: $pattern"; failed=1; fi; done
  for obsolete in ".kilo/agent/jiraman.md" ".kilo/config/jiraman.yaml" ".kilo/config/jiraman-deliverables.md"; do if [[ -e "$ROOT/$obsolete" ]]; then echo "FAIL obsolete v4 path: $obsolete"; failed=1; fi; done
fi
scan_root="$ROOT/.kilo"
if [[ "$SOURCE" -eq 1 ]]; then scan_root="$ROOT/template/.kilo"; fi
while IFS= read -r path; do
  extension="${path##*.}"
  if [[ "$extension" == "p""y" || "$extension" == "p""yc" ]]; then echo "FAIL application runtime file: $path"; failed=1; fi
done < <(find "$scan_root" -type f -print)
if [[ "$SOURCE" -eq 1 ]]; then
  for executable in install.sh verify.sh scripts/ci.sh scripts/package.sh scripts/sanitize_ci_log.sh scripts/scan_package_sensitive.sh scripts/verify_package.sh tests/install/run-clean-install.sh tests/install/run-v4-upgrade.sh; do if [[ ! -x "$ROOT/$executable" ]]; then echo "FAIL not executable: $executable"; failed=1; fi; done
fi
if [[ "$failed" -eq 0 ]]; then echo "Jiraman verification: PASS"; fi
exit "$failed"
