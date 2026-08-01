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
  return preflightAllowed && priorWriteResult !== "failure";
}

export function verificationOutcome(writeResult: "success" | "failure", readAfterWriteMatches: boolean): "applied" | "failed" | "verification-failed" {
  if (writeResult === "failure") return "failed";
  return readAfterWriteMatches ? "applied" : "verification-failed";
}

function canonical(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonical).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

export function semanticallyEqual(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
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
