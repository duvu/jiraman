import { createHash } from "node:crypto";

import { acceptanceCriteriaEqual } from "./acceptance-criteria-rules.js";
import { compareCodeUnits } from "./canonical-order.js";
import { type JsonValue } from "./contracts.js";

export interface PreflightInput {
  readonly status: "proposed" | "approved" | "rejected" | "stale" | "applied";
  readonly expired: boolean;
  readonly payloadHashMatches: boolean;
  readonly scopeAllowed: boolean;
  readonly approvalComplete: boolean;
  readonly targetFresh: boolean;
  readonly hierarchyValid: boolean;
  readonly subtaskHours: number | null;
  readonly ownershipAllowed: boolean;
  readonly fieldsExact: boolean;
  readonly dependenciesResolved: boolean;
}

export interface PreflightResult {
  readonly allowed: boolean;
  readonly violations: readonly string[];
}

export interface GoalPreflightInput {
  readonly goalFieldsPresent: boolean;
  readonly parentageVerified: boolean;
  readonly minimumChildrenPresent: boolean;
  readonly dueDateWrite: "resolved" | "missing" | "ambiguous";
  readonly dueDateRead: "resolved" | "missing" | "ambiguous";
  readonly estimatesValid: boolean;
  readonly acceptanceCriteriaComplete: boolean;
  readonly duplicatesAbsent: boolean;
  readonly payloadUnchanged: boolean;
  readonly acceptanceCriteriaReadBackMatches: boolean;
  readonly readBackMatches: boolean;
}

export function goalPreflightBlockers(input: GoalPreflightInput): string[] {
  const blockers: string[] = [];
  if (!input.goalFieldsPresent) blockers.push("missing-goal-fields");
  if (!input.parentageVerified) blockers.push("unverified-goal-parentage");
  if (!input.minimumChildrenPresent) blockers.push("insufficient-goal-decomposition");
  if (input.dueDateWrite !== "resolved") blockers.push(`jira-due-date-write-${input.dueDateWrite}`);
  if (input.dueDateRead !== "resolved") blockers.push(`jira-due-date-read-${input.dueDateRead}`);
  if (!input.estimatesValid) blockers.push("invalid-subtask-estimate");
  if (!input.acceptanceCriteriaComplete) blockers.push("incomplete-acceptance-criteria");
  if (!input.duplicatesAbsent) blockers.push("duplicate-target");
  if (!input.payloadUnchanged) blockers.push("modified");
  if (!input.acceptanceCriteriaReadBackMatches) blockers.push("acceptance-criteria-read-back-mismatch");
  if (!input.readBackMatches) blockers.push("goal-read-after-write-mismatch");
  return blockers;
}

export function evaluatePreflight(input: PreflightInput): PreflightResult {
  const violations: string[] = [];
  if (input.status !== "approved") violations.push(`status-${input.status}`);
  if (input.expired) violations.push("expired");
  if (!input.payloadHashMatches) violations.push("modified");
  if (!input.scopeAllowed) violations.push("scope");
  if (!input.approvalComplete) violations.push("partial-approval");
  if (!input.targetFresh) violations.push("stale-target");
  if (!input.hierarchyValid) violations.push("invalid-hierarchy");
  if (input.subtaskHours !== null && (input.subtaskHours <= 0 || input.subtaskHours > 4)) violations.push("invalid-subtask-estimate");
  if (!input.ownershipAllowed) violations.push("ownership");
  if (!input.fieldsExact) violations.push("field-expansion");
  if (!input.dependenciesResolved) violations.push("dependency");
  return { allowed: violations.length === 0, violations };
}

export function canTransition(from: string, to: string): boolean {
  const allowed: Readonly<Record<string, readonly string[]>> = {
    proposed: ["approved", "rejected", "stale"], approved: ["applying", "rejected", "stale"], applying: ["applied", "failed", "verification-failed"],
    rejected: [], stale: [], applied: [], failed: [], "verification-failed": [],
  };
  return allowed[from]?.includes(to) ?? false;
}

export function dependentWritesAllowed(preflightAllowed: boolean, priorWriteResult: "not-started" | "success" | "failure"): boolean {
  return preflightAllowed && priorWriteResult === "success";
}

export function verificationOutcome(writeResult: "success" | "failure", readAfterWriteMatches: boolean): "applied" | "failed" | "verification-failed" {
  if (writeResult === "failure") return "failed";
  return readAfterWriteMatches ? "applied" : "verification-failed";
}

export function acceptanceCriteriaReadBackMatches(approved: JsonValue, readBack: JsonValue): boolean {
  return acceptanceCriteriaEqual(approved, readBack);
}

export interface TargetPreflightInput {
  readonly kind: "existing" | "create";
  readonly targetReadable: boolean;
  readonly containerReadable: boolean;
  readonly duplicateAbsent: boolean;
  readonly draftReferenceUnique: boolean;
  readonly dependenciesResolvable: boolean;
}

export function targetPreflightBlockers(input: TargetPreflightInput): string[] {
  const blockers: string[] = [];
  if (input.kind === "existing" && !input.targetReadable) blockers.push("missing-target-read");
  if (input.kind === "create") {
    if (!input.containerReadable) blockers.push("missing-container-read");
    if (!input.duplicateAbsent) blockers.push("duplicate-target");
    if (!input.draftReferenceUnique) blockers.push("ambiguous-draft-reference");
  }
  if (!input.dependenciesResolvable) blockers.push("unresolved-dependency");
  return blockers;
}

export interface DependencyAction {
  readonly id: string;
  readonly dependencies: readonly string[];
}

export function dependencyOrder(actions: readonly DependencyAction[]): string[] | null {
  const byId = new Map(actions.map((action) => [action.id, action]));
  if (byId.size !== actions.length || actions.some((action) => action.dependencies.some((dependency) => !byId.has(dependency)))) return null;
  const remaining = new Set(byId.keys());
  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => byId.get(id)?.dependencies.every((dependency) => !remaining.has(dependency)) === true).sort();
    if (ready.length === 0) return null;
    for (const id of ready) {
      ordered.push(id);
      remaining.delete(id);
    }
  }
  return ordered;
}

export function approvalSelectionAllowed(groupActionIds: readonly string[], selectedActionIds: readonly string[], groupSelected: boolean, containsHighRisk: boolean): boolean {
  if (new Set(groupActionIds).size !== groupActionIds.length || new Set(selectedActionIds).size !== selectedActionIds.length) return false;
  if (groupSelected) return !containsHighRisk && selectedActionIds.length === 0;
  return groupActionIds.length === selectedActionIds.length && groupActionIds.every((id) => selectedActionIds.includes(id));
}

function canonicalPayloadValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalPayloadValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .map(([key, item]) => [key, canonicalPayloadValue(item)]),
    );
  }
  return value;
}

function immutableAction(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "status"));
}

function actionId(value: JsonValue): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return "";
  return typeof value.id === "string" ? value.id : "";
}

export function canonicalPayloadHash(actions: readonly JsonValue[]): string {
  const immutable = actions.map(immutableAction).sort((left, right) => compareCodeUnits(actionId(left), actionId(right)));
  return createHash("sha256").update(JSON.stringify(canonicalPayloadValue(immutable))).digest("hex");
}

function canonical(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonical).sort((left, right) => compareCodeUnits(JSON.stringify(left), JSON.stringify(right)));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => compareCodeUnits(left, right)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

export function semanticallyEqual(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function canonicalJiraReadBack(value: JsonValue): JsonValue {
  if (typeof value === "string") return value.replace(/\r\n/g, "\n");
  if (Array.isArray(value)) return value.map(canonicalJiraReadBack);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => compareCodeUnits(left, right)).map(([key, item]) => [key, canonicalJiraReadBack(item)]));
  }
  return value;
}

export function jiraReadBackMatches(approved: JsonValue, observed: JsonValue): boolean {
  return JSON.stringify(canonicalJiraReadBack(approved)) === JSON.stringify(canonicalJiraReadBack(observed));
}

export interface ProposalReadiness {
  readonly hierarchyValid: boolean;
  readonly uncoveredIds: readonly string[];
  readonly oversizedSubtasks: boolean;
  readonly ambiguousDuplicates: boolean;
  readonly unresolvedDecisions: boolean;
  readonly hypothesisReady: boolean;
}

export function proposalBlockers(input: ProposalReadiness): string[] {
  const blockers: string[] = [];
  if (!input.hierarchyValid) blockers.push("invalid-hierarchy");
  if (input.uncoveredIds.length > 0) blockers.push("uncovered-requirements");
  if (input.oversizedSubtasks) blockers.push("oversized-subtask");
  if (input.ambiguousDuplicates) blockers.push("ambiguous-duplicate");
  if (input.unresolvedDecisions) blockers.push("unresolved-decision");
  if (!input.hypothesisReady) blockers.push("unready-hypothesis");
  return blockers;
}
