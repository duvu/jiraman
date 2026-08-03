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

function contentWords(content: string): ReadonlySet<string> {
  return new Set(content.toLowerCase().replace(/sub[- ]tasks?/g, "subtask").match(/[a-z0-9_]+/g) ?? []);
}

function hasAny(words: ReadonlySet<string>, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => words.has(candidate));
}

function hasPrefix(words: ReadonlySet<string>, prefixes: readonly string[]): boolean {
  return [...words].some((word) => prefixes.some((prefix) => word.startsWith(prefix)));
}

function scopeOverride(content: string, words: ReadonlySet<string>): boolean {
  const movement = hasAny(words, ["change", "create", "move", "operate", "put", "reassign", "switch", "transfer", "update", "work", "write"]);
  const external = hasAny(words, ["alternate", "another", "different", "other", "outside"]);
  const context = hasAny(words, ["in", "portfolio", "project", "scope", "team", "to", "under", "workspace"]);
  const foreignIssue = /\b(?!AIPLATFORM-)[A-Z][A-Z0-9_]+-[0-9]+\b/.test(content);
  const foreignProject = /\b(?!AIPLATFORM\b)[A-Z][A-Z0-9_]{2,}\b/.test(content) && hasAny(words, ["portfolio", "project", "workspace"]);
  return movement && (external || foreignIssue || foreignProject) && (context || foreignIssue);
}

function toolOverride(words: ReadonlySet<string>): boolean {
  const selection = hasAny(words, ["call", "choose", "direct", "invoke", "pick", "route", "select", "switch", "use"]);
  const tool = hasAny(words, ["adapter", "client", "connector", "integration", "mcp", "provider", "tool"]) || hasPrefix(words, ["jira_", "confluence_"]);
  return (selection && tool) || (words.has("fake") && words.has("mcp"));
}

function approvalOverride(words: ReadonlySet<string>): boolean {
  const approval = hasPrefix(words, ["approv", "authoriz", "confirm", "consent", "permiss", "request"]) || hasAny(words, ["ask", "okay"]);
  const write = hasAny(words, ["apply", "change", "commit", "create", "deploy", "execute", "proceed", "publish", "save", "submit", "update", "write"]);
  const bypass = hasAny(words, ["auto", "avoid", "bypass", "forgo", "ignore", "omit", "self", "skip", "unnecessary", "waive", "without"]);
  const directive = hasAny(words, ["approve", "consider", "mark", "treat"]);
  return (approval && bypass) || (approval && directive && (write || words.has("this") || words.has("it")));
}

function secretDisclosure(words: ReadonlySet<string>): boolean {
  const disclosure = hasAny(words, ["copy", "echo", "expose", "include", "place", "print", "publish", "put", "reveal", "send", "show", "write"]);
  const secret = hasAny(words, ["api", "auth", "bearer", "cookie", "credential", "header", "key", "password", "secret", "token"]);
  return disclosure && secret;
}

function goalPolicyOverride(words: ReadonlySet<string>): boolean {
  if (hasAny(words, ["bypass", "disregard", "ignore", "override"]) && hasPrefix(words, ["instruction", "policy"])) return true;
  const work = hasPrefix(words, ["child", "implementation", "item", "subtask", "task", "work"]) || words.has("goal");
  const lowCount = hasAny(words, ["0", "1", "fewer", "lone", "one", "only", "optional", "single", "zero"]);
  const cardinalityChange = hasAny(words, ["allow", "create", "keep", "lower", "make", "necessary", "permit", "reduce", "set", "suffice", "suffices", "treat", "unnecessary", "use"]);
  if (work && lowCount && cardinalityChange) return true;
  const numericHours = [...words].some((word) => /^\d+$/.test(word) && Number(word) > 4);
  const oversized = numericHours || hasAny(words, ["day", "eight", "eleven", "entire", "five", "full", "nine", "seven", "six", "ten", "twelve"]);
  const durationChange = hasAny(words, ["allow", "can", "increase", "last", "may", "permit", "raise", "set", "span", "take"]);
  if (work && oversized && durationChange) return true;
  const dod = words.has("dod") || (words.has("definition") && words.has("done")) || (words.has("completion") && words.has("criteria"));
  const dodWeakening = hasAny(words, ["drop", "make", "omit", "optional", "remove", "treat", "unnecessary"]) || hasPrefix(words, ["skip"]);
  if (dod && dodWeakening) return true;
  const deadline = words.has("deadline") || (words.has("date") && hasAny(words, ["completion", "due", "finish", "target"]));
  const invented = hasPrefix(words, ["assum", "fabricat", "guess", "invent"]);
  const selected = hasAny(words, ["assign", "choose", "make", "pick", "set", "use"]);
  const relative = hasAny(words, ["asap", "soon", "tomorrow"]);
  const missingEvidence = hasAny(words, ["no", "unverified", "without"]) && hasPrefix(words, ["confirm", "evidence", "source", "verif"]);
  return deadline && (invented || (selected && (relative || missingEvidence || words.has("any") || (words.has("make") && words.has("up")))));
}

export function inspectUntrustedContent(source: string, content: string): SecurityFinding | null {
  const words = contentWords(content);
  const effects: string[] = [];
  if (scopeOverride(content, words)) effects.push("scope change");
  if (toolOverride(words)) effects.push("tool selection");
  if (approvalOverride(words)) effects.push("write approval");
  if (secretDisclosure(words)) effects.push("secret disclosure");
  if (goalPolicyOverride(words)) effects.push("goal policy override");
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
