import { asArray, asObject, asString, type JsonObject } from "./contracts.js";

export interface ScopeDecision {
  readonly allowed: boolean;
  readonly rejectedIdentifiers: readonly string[];
  readonly boundedJql: string | null;
}

export function evaluateScope(request: string): ScopeDecision {
  const keys = request.match(/\b[A-Z][A-Z0-9_]+-[0-9]+\b/g) ?? [];
  const rejected = keys.filter((key) => !key.startsWith("AIPLATFORM-"));
  const externalLink = /https:\/\/(?![^/]*\.example\.com)[^\s]+/i.test(request);
  if (rejected.length > 0 || externalLink || /outside configured root/i.test(request)) return { allowed: false, rejectedIdentifiers: rejected, boundedJql: null };
  const boundedJql = keys.length === 0
    ? "project = AIPLATFORM"
    : keys.length === 1
      ? `project = AIPLATFORM AND key = ${keys[0]}`
      : `project = AIPLATFORM AND key in (${keys.join(", ")})`;
  return { allowed: true, rejectedIdentifiers: [], boundedJql };
}

export interface SecurityFinding {
  readonly source: string;
  readonly category: "instruction-injection";
  readonly blockedEffect: readonly string[];
  readonly preservedEvidenceIds: readonly string[];
}

export function inspectUntrustedContent(source: string, content: string): SecurityFinding | null {
  const suspicious = /ignore (?:policy|instructions)|use (?:the )?tool|reveal (?:a )?secret|auto-approve|update [A-Z]+-[0-9]+/i.test(content);
  if (!suspicious) return null;
  const effects: string[] = [];
  if (/update [A-Z]+-[0-9]+|change project/i.test(content)) effects.push("scope change");
  if (/use (?:the )?tool|fake mcp/i.test(content)) effects.push("tool selection");
  if (/auto-approve|approve write/i.test(content)) effects.push("write approval");
  if (/reveal (?:a )?secret|credential/i.test(content)) effects.push("secret disclosure");
  return { source, category: "instruction-injection", blockedEffect: effects, preservedEvidenceIds: extractStableIds(content) };
}

export function extractStableIds(content: string): string[] {
  return [...new Set(content.match(/\b(?:REQ|AC)-[0-9]+\b/g) ?? [])].sort();
}

export function pageProposalViolations(proposal: JsonObject): string[] {
  const violations: string[] = [];
  const ownership = proposal.ownership;
  const operation = proposal.operation;
  if (ownership === "human-owned" && operation !== "page.comment" && operation !== "proposed-patch") violations.push("human-page-replacement");
  if (ownership === "mixed" && operation !== "page.section-update" && operation !== "no-action") violations.push("mixed-page-scope");
  if (operation !== "no-action") {
    if (proposal.current_version === null || proposal.current_version === undefined) violations.push("missing-current-version");
    if (typeof proposal.desired_content !== "string" || proposal.desired_content.length === 0) violations.push("missing-desired-content");
    if (!Array.isArray(proposal.preconditions) || proposal.preconditions.length === 0) violations.push("missing-preconditions");
    if (typeof proposal.rollback_source !== "string" || proposal.rollback_source.length === 0) violations.push("missing-rollback-source");
  }
  return violations;
}

export function freshnessStatus(lastReviewed: string, jiraChanged: string | null, historyVerified: boolean): "review required" | "current" | "not verified" {
  if (!historyVerified || jiraChanged === null) return "not verified";
  return Date.parse(jiraChanged) > Date.parse(lastReviewed) ? "review required" : "current";
}

export function distinctScenarioSelections(plan: JsonObject): boolean {
  const scenarios = asArray(plan.scenarios, "scenarios").map((item) => asObject(item, "scenario"));
  const signatures = scenarios.map((scenario) => {
    const selected = asArray(scenario.selected, "selected").map((item) => asString(item, "selected item")).sort();
    const displaced = asArray(scenario.displaced_work, "displaced work").map((item) => asString(item, "displaced item")).sort();
    return JSON.stringify({ selected, displaced });
  });
  return new Set(signatures).size === signatures.length;
}
