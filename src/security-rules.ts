import { asArray, asObject, asString, type JsonObject, type JsonValue } from "./contracts.js";

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

const SCOPE_OVERRIDE_PATTERNS = [
  /\b(?:update|edit|modify|move)\s+[A-Z][A-Z0-9_]+-[0-9]+\b/i,
  /\bchange\s+(?:the\s+)?(?:project|scope)\b/i,
  /\b(?:work|operate|write|create|move|switch)\s+(?:in|to)\s+(?:project\s+)?[A-Z][A-Z0-9_]{2,}\b/,
  /\b(?:outside|another|different)\s+(?:the\s+)?(?:configured\s+)?(?:project|scope)\b/i,
] as const;
const TOOL_OVERRIDE_PATTERNS = [
  /\b(?:switch|use|call|invoke|select)\s+(?:to\s+)?(?:(?:the|another|different)\s+)?(?:[\w.-]*(?:tool|mcp|connector)|jira_[a-z_]+|confluence_[a-z_]+)\b/i,
  /\bfake\s+mcp\b/i,
] as const;
const APPROVAL_OVERRIDE_PATTERNS = [
  /\bauto-?approve\b/i,
  /\bapprove\s+(?:the\s+)?write\b/i,
  /\b(?:consider|treat|mark)\s+(?:this|it)\s+(?:as\s+)?approved\b/i,
  /\b(?:skip|bypass|ignore)\s+(?:the\s+)?approval\b/i,
  /\bself-?approve\b|\bwrite\s+without\s+(?:an?\s+)?ask\b/i,
] as const;
const SECRET_DISCLOSURE_PATTERNS = [
  /\b(?:reveal|expose|print|show|send)\b.{0,32}\b(?:secret|credential|password|token|api[- ]?key)\b/i,
] as const;
const GOAL_OVERRIDE_PATTERNS = [
  /\b(?:ignore|bypass|override|disregard)\s+(?:the\s+)?(?:goal\s+)?(?:policy|instructions?)\b/i,
  /\b(?:set|lower|reduce|change|override)\b.{0,40}\b(?:minimum|goal count|child count|sub-?tasks?)\b.{0,24}\b(?:0|1|zero|one)\b/i,
  /\b(?:make|treat)\b.{0,32}\b(?:children|sub-?tasks?)\b.{0,20}\boptional\b/i,
  /\b(?:keep|use|create)\b.{0,32}\b(?:single|one|fewer)\b.{0,20}\b(?:child|sub-?task)\b/i,
  /\b(?:allow|permit|raise|increase|set)\b.{0,40}\b(?:[5-9]|[1-9][0-9]+|five|six|seven|eight|nine|ten|eleven|twelve)(?:-|\s*)hours?\b.{0,20}\b(?:tasks?|sub-?tasks?)\b/i,
  /\b(?:allow|permit|raise|increase|set)\b.{0,40}\b(?:tasks?|sub-?tasks?)\b.{0,24}\b(?:[5-9]|[1-9][0-9]+|five|six|seven|eight|nine|ten|eleven|twelve)(?:-|\s*)hours?\b/i,
  /\b(?:allow|permit)\b.{0,32}\bestimates?\b.{0,24}\b(?:over|above|greater than)\s+(?:4|four)\s*hours?\b/i,
  /\b(?:omit|remove|drop|skip)\b.{0,32}\b(?:goal\s+)?(?:name|deadline|target completion date|dod|definition of done)\b/i,
  /\b(?:make|treat)\b.{0,32}\b(?:goal\s+)?(?:dod|definition of done|deadline)\b.{0,20}\boptional\b/i,
  /\b(?:invent|guess|assume|fabricate)\b.{0,48}\b(?:due date|deadline|target completion date)\b/i,
  /\b(?:invent|guess|assume|use|set)\b.{0,32}\b(?:tomorrow|next week|soon|asap)\b.{0,24}\b(?:due date|deadline|target completion date)\b/i,
] as const;

function matchesAny(content: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

export function inspectUntrustedContent(source: string, content: string): SecurityFinding | null {
  const effects: string[] = [];
  if (matchesAny(content, SCOPE_OVERRIDE_PATTERNS)) effects.push("scope change");
  if (matchesAny(content, TOOL_OVERRIDE_PATTERNS)) effects.push("tool selection");
  if (matchesAny(content, APPROVAL_OVERRIDE_PATTERNS)) effects.push("write approval");
  if (matchesAny(content, SECRET_DISCLOSURE_PATTERNS)) effects.push("secret disclosure");
  if (matchesAny(content, GOAL_OVERRIDE_PATTERNS)) effects.push("goal policy override");
  if (effects.length === 0) return null;
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

export function sensitiveKeyViolations(value: JsonValue): string[] {
  const forbidden = /^(?:remote_body|authorization|cookie|set-cookie|password|access_token|refresh_token|client_secret|productivity)$/i;
  const violations: string[] = [];
  const visit = (item: JsonValue, path: string): void => {
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (item !== null && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        const childPath = path === "" ? key : `${path}.${key}`;
        if (forbidden.test(key)) violations.push(childPath);
        visit(child, childPath);
      }
    }
  };
  visit(value, "");
  return violations;
}
