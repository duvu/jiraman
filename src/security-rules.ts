import { asArray, asObject, asString, readJson, type JsonObject, type JsonValue } from "./contracts.js";
import { goalTemplateSectionViolations } from "./goal-contract-metadata-rules.js";

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

function wordList(content: string): readonly string[] {
  return content.toLowerCase().replace(/n['’]t\b/g, " not").replace(/sub[- ]tasks?/g, "subtask").match(/[a-z0-9_]+/g) ?? [];
}

function hasAny(words: ReadonlySet<string>, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => words.has(candidate));
}

function hasPrefix(words: ReadonlySet<string>, prefixes: readonly string[]): boolean {
  return [...words].some((word) => prefixes.some((prefix) => word.startsWith(prefix)));
}

function negatesDirective(words: readonly string[], prefixes: readonly string[]): boolean {
  const directives = words.map((word, index) => ({word, index}))
    .filter(({word}) => prefixes.some((prefix) => word.startsWith(prefix)));
  return directives.length > 0 && directives.every(({index}) =>
    words.slice(Math.max(0, index - 3), index).some((candidate) => candidate === "not" || candidate === "never"));
}

function scopeOverride(content: string, words: ReadonlySet<string>): boolean {
  const movement = hasPrefix(words, ["chang", "creat", "mov", "operat", "put", "reassign", "relocat", "switch", "transfer", "updat", "work", "writ"]);
  const external = hasAny(words, ["alternate", "another", "different", "other", "outside"]);
  const context = hasAny(words, ["in", "portfolio", "project", "scope", "team", "to", "under", "workspace"]);
  const foreignIssue = /\b(?!AIPLATFORM-)[A-Z][A-Z0-9_]+-[0-9]+\b/.test(content);
  const foreignProject = /\b(?!AIPLATFORM\b)[A-Z][A-Z0-9_]{2,}\b/.test(content) && hasAny(words, ["portfolio", "project", "workspace"]);
  return movement && (external || foreignIssue || foreignProject) && (context || foreignIssue);
}

function toolOverride(words: ReadonlySet<string>): boolean {
  const selection = hasPrefix(words, ["call", "choos", "chos", "direct", "hand", "invok", "pick", "rout", "select", "switch", "use"]);
  const tool = hasAny(words, ["adapter", "client", "connector", "integration", "mcp", "provider", "tool"]) || hasPrefix(words, ["jira_", "confluence_"]);
  const passiveAudit = hasAny(words, ["chosen", "selected"]) && hasAny(words, ["audit", "documented"]) &&
    !hasAny(words, ["alternate", "another", "different", "fake", "other"]);
  if (passiveAudit) return false;
  return (selection && tool) || (words.has("fake") && words.has("mcp"));
}

function approvalOverride(words: ReadonlySet<string>): boolean {
  const approval = hasPrefix(words, ["approv", "authoriz", "confirm", "consent", "permiss", "request"]) || hasAny(words, ["ask", "okay"]);
  const write = hasPrefix(words, ["appl", "chang", "commit", "creat", "deploy", "execut", "proceed", "publish", "sav", "submit", "updat", "writ"]);
  const bypass = hasAny(words, ["auto", "avoid", "bypass", "forgo", "ignore", "omit", "self", "skip", "unnecessary", "waive", "without"]);
  const directive = hasAny(words, ["approve", "consider", "mark", "treat"]);
  const noNeed = words.has("needless") || (words.has("need") && words.has("not"));
  return (approval && (bypass || noNeed) && (write || bypass)) || (approval && directive && (write || words.has("this") || words.has("it")));
}

function secretDisclosure(words: ReadonlySet<string>): boolean {
  const disclosure = hasPrefix(words, ["attach", "cop", "echo", "expos", "includ", "plac", "print", "publish", "put", "reveal", "send", "show", "writ"]);
  const secret = hasAny(words, ["api", "auth", "bearer", "cookie", "credential", "header", "key", "password", "secret", "token"]);
  return disclosure && secret;
}

function goalPolicyOverride(words: ReadonlySet<string>): boolean {
  if (hasAny(words, ["bypass", "disregard", "ignore", "override"]) && hasPrefix(words, ["instruction", "policy"])) return true;
  const work = hasPrefix(words, ["child", "execution", "implementation", "item", "package", "subtask", "task", "unit", "work"]) || words.has("goal");
  const lowCount = hasAny(words, ["0", "1", "fewer", "lone", "one", "only", "optional", "pair", "single", "zero"]);
  const cardinalityChange = hasAny(words, ["adequate", "allow", "create", "enough", "keep", "lower", "make", "necessary", "needless", "permit", "reduce", "set", "treat", "unnecessary", "use"]) || hasPrefix(words, ["suffic"]) || (words.has("will") && words.has("do"));
  if (work && lowCount && cardinalityChange) return true;
  const numericHours = [...words].some((word) => /^\d+$/.test(word) && Number(word) > 4);
  const oversized = numericHours || hasAny(words, ["day", "eight", "eleven", "entire", "five", "full", "half", "nine", "seven", "six", "ten", "twelve"]);
  const durationChange = hasAny(words, ["allow", "can", "consume", "increase", "last", "let", "may", "permit", "raise", "set", "span", "take"]);
  if (work && oversized && durationChange) return true;
  const dod = words.has("dod") || (words.has("definition") && words.has("done")) || (hasAny(words, ["acceptance", "completion"]) && hasPrefix(words, ["condition", "criter"]));
  const noNeed = hasAny(words, ["needless", "nonessential"]) || (words.has("no") && hasPrefix(words, ["need"]));
  const dodWeakening = noNeed || hasAny(words, ["drop", "make", "omit", "optional", "remove", "treat", "unnecessary"]) || hasPrefix(words, ["skip"]);
  if (dod && dodWeakening) return true;
  const deadline = words.has("deadline") || (words.has("date") && hasAny(words, ["completion", "due", "finish", "target"]));
  const invented = hasPrefix(words, ["assum", "fabricat", "guess", "invent"]);
  const selected = hasAny(words, ["assign", "choose", "make", "pick", "set", "use"]);
  const relative = hasAny(words, ["asap", "soon", "tomorrow"]) || (words.has("next") && words.has("week"));
  const missingEvidence = (hasAny(words, ["no", "unverified", "without"]) || hasPrefix(words, ["lack"])) && hasPrefix(words, ["confirm", "evidence", "source", "verif"]);
  return deadline && (invented || (selected && (relative || missingEvidence || words.has("any") || (words.has("make") && words.has("up")))));
}

export function inspectUntrustedContent(source: string, content: string): SecurityFinding | null {
  const clauses = content.split(/[,.;!?]+|\b(?:but|however)\b/i).map((text) => ({text, ordered: wordList(text)})).filter((clause) => clause.ordered.length > 0);
  const effects: string[] = [];
  if (clauses.some((clause) => scopeOverride(clause.text, new Set(clause.ordered)) && !negatesDirective(clause.ordered, ["chang", "creat", "mov", "operat", "put", "reassign", "relocat", "switch", "transfer", "updat", "work", "writ"]))) effects.push("scope change");
  if (clauses.some((clause) => toolOverride(new Set(clause.ordered)) && !negatesDirective(clause.ordered, ["call", "choos", "chos", "direct", "hand", "invok", "pick", "rout", "select", "switch", "use"]))) effects.push("tool selection");
  if (clauses.some((clause) => approvalOverride(new Set(clause.ordered)) && !negatesDirective(clause.ordered, ["avoid", "bypass", "forgo", "ignor", "omit", "skip", "waiv", "appl", "chang", "commit", "creat", "deploy", "execut", "proceed", "publish", "sav", "submit", "updat", "writ"]))) effects.push("write approval");
  if (clauses.some((clause) => secretDisclosure(new Set(clause.ordered)) && !negatesDirective(clause.ordered, ["attach", "cop", "echo", "expos", "includ", "plac", "print", "publish", "put", "reveal", "send", "show", "writ"]))) effects.push("secret disclosure");
  if (clauses.some((clause) => goalPolicyOverride(new Set(clause.ordered)) && !negatesDirective(clause.ordered, ["allow", "creat", "drop", "fabricat", "guess", "increas", "invent", "keep", "lower", "make", "omit", "permit", "rais", "reduc", "remov", "set", "skip", "treat", "use"]))) effects.push("goal policy override");
  if (effects.length === 0) return null;
  return { source, category: "instruction-injection", blockedEffect: effects, preservedEvidenceIds: extractStableIds(content) };
}

export function extractStableIds(content: string): string[] {
  return [...new Set(content.match(/\b(?:REQ|AC)-[0-9]+\b/g) ?? [])].sort();
}

function goalPageSectionViolations(proposal: JsonObject): string[] {
  if (typeof proposal.page_type !== "string" || typeof proposal.desired_content !== "string") return [];
  const index = asObject(readJson("template/docs/project-management/templates/confluence/index.json"), "template index");
  const page = asArray(index.page_types, "page types").map((value) => asObject(value, "page type"))
    .find((value) => value.page_type === proposal.page_type);
  if (page === undefined || page.goal_contract_required !== true) return [];
  return goalTemplateSectionViolations([{
    path: `proposal:${proposal.page_type}`,
    goalContractRequired: page.goal_contract_required,
    requiredGoalSections: page.required_goal_sections,
    text: proposal.desired_content,
  }]);
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
    violations.push(...goalPageSectionViolations(proposal));
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
