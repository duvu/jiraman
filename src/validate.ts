import { existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

import { missingCapabilityCoverage } from "./capability-rules.js";
import {
  asArray,
  asObject,
  asString,
  fixtureFiles,
  invariant,
  listSkillFiles,
  parseFrontmatter,
  ROOT,
  readJson,
  readText,
  requireInvalid,
  requireValid,
  validateJson,
  walkFiles,
} from "./contracts.js";
import { missingChecklistGates } from "./release-rules.js";
import { commandTableRoutes } from "./routing-rules.js";

const REQUIRED_SKILL_SECTIONS = ["Purpose", "Triggers", "Required Evidence", "Output Contract", "Semantic Capabilities", "Workflow", "Side Effects", "Degraded Mode", "Shared Policy"] as const;
const FIXTURE_DOMAINS: Readonly<Record<string, readonly string[]>> = {
  "mcp-contract": ["tests/fixtures/mcp"],
  "mcp-profiles": ["tests/fixtures/mcp"],
  "mcp-fixtures": ["tests/fixtures/mcp"],
  "security-fixtures": ["tests/fixtures/security", "tests/fixtures/scope"],
  "confluence-fixtures": ["tests/fixtures/confluence"],
  "report-contracts": ["tests/fixtures/confluence"],
  "governance-fixtures": ["tests/fixtures/governance"],
  "spec-fixtures": ["tests/fixtures/specs"],
  "reconciliation-fixtures": ["tests/fixtures/reconciliation"],
  "backlog-drafts": ["tests/fixtures/drafts"],
  "subtask-drafts": ["tests/fixtures/drafts"],
  "workflow-fixtures": ["tests/fixtures/workflows"],
  "deliverable-fixtures": ["tests/fixtures/deliverables"],
};

function validateSchemas(): void {
  requireValid("config.schema.json", "examples/config.valid.json");
  requireInvalid("config.schema.json", "examples/config.invalid.json");
  requireValid("state.schema.json", "examples/state.valid.json");
  requireInvalid("state.schema.json", "examples/state.invalid.json");
  requireValid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.valid.json");
  requireInvalid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.invalid.json");
  requireInvalid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.invalid-date.json");
  requireValid("action-group.schema.json", "examples/action-group.valid.json");
  requireInvalid("action-group.schema.json", "examples/action-group.invalid.json");
  requireInvalid("action-group.schema.json", "examples/action-group.invalid-date.json");
  requireValid("state.schema.json", "template/.kilo/state/jiraman.json");
  requireValid("config.schema.json", "template/.kilo/config/jiraman.json");
}

function validateSkills(): void {
  const names = new Set<string>();
  const files = listSkillFiles();
  const expected = new Set(["jiraman-apply-actions", "jiraman-confluence-publish", "jiraman-confluence-reporting", "jiraman-daily", "jiraman-decision-management", "jiraman-meeting-actions", "jiraman-next-two-weeks", "jiraman-refinement", "jiraman-risk-management", "jiraman-sprint-cadence", "jiraman-sprint-health"]);
  invariant(files.length === expected.size, `expected ${expected.size} skills, found ${files.length}`);
  for (const path of files) {
    const text = readText(path);
    const frontmatter = parseFrontmatter(text);
    const name = frontmatter.get("name");
    invariant(name !== undefined && name.length > 0, `${path} missing skill name`);
    invariant(!names.has(name), `duplicate skill name: ${name}`);
    names.add(name);
    invariant(frontmatter.get("version") === "5", `${path} must be version 5`);
    invariant(expected.has(name), `unexpected skill contract: ${name}`);
    for (const section of REQUIRED_SKILL_SECTIONS) {
      invariant(text.includes(`## ${section}`), `${path} missing ${section}`);
    }
    invariant(text.includes(".kilo/policies/jiraman-safety.md"), `${path} missing shared policy reference`);
    invariant(frontmatter.get("side_effects") === (name === "jiraman-apply-actions" ? "approved-write" : "none"), `${path} has invalid side-effect metadata`);
  }
  const index = asObject(readJson("template/.kilo/skills/index.json"), "skills index");
  for (const item of asArray(index.skills, "skills index skills")) {
    const entry = asObject(item, "skill entry");
    invariant(names.has(asString(entry.name, "skill entry name")), "skill index has unresolved name");
    invariant(existsSync(asString(entry.path, "skill entry path").replace(/^\.kilo\//, "template/.kilo/")), "skill index has unresolved path");
  }
}

function validateCommands(): void {
  const router = asObject(readJson("template/.kilo/config/command-router.json"), "router");
  const canonical = asObject(router.canonical ?? null, "canonical");
  const aliases = asObject(router.aliases ?? null, "aliases");
  const skillNames = new Set(listSkillFiles().map((path) => parseFrontmatter(readText(path)).get("name")));
  for (const skill of Object.values(canonical)) {
    invariant(typeof skill === "string" && skillNames.has(skill), `unresolved command skill: ${String(skill)}`);
  }
  for (const target of Object.values(aliases)) {
    invariant(typeof target === "string" && canonical[target] !== undefined, `unresolved alias target: ${String(target)}`);
  }
  invariant(canonical.apply === "jiraman-apply-actions" && canonical.reject === "jiraman-apply-actions", "write modes must route to apply skill");
  invariant(router.precedence === "longest-exact-prefix", "router must define deterministic precedence");
  const documented = commandTableRoutes(readText("template/.kilo/commands/jiraman.md"));
  for (const [mode, skill] of Object.entries(canonical)) invariant(documented.get(mode) === skill, `command Markdown route mismatch: ${mode}`);
  requireValid("fixture.schema.json", "tests/fixtures/router/cases.json");
}

function validateMcp(): void {
  const contract = asObject(readJson("template/.kilo/config/mcp-atlassian.json"), "MCP contract");
  invariant(contract.server_ownership === "external-user-owned", "MCP ownership must remain external");
  const capabilities = asArray(contract.capabilities, "capabilities");
  const semantics = capabilities.map((item) => asString(asObject(item, "capability").semantic, "semantic"));
  invariant(new Set(semantics).size === semantics.length, "duplicate semantic capability");
  for (const item of capabilities) {
    const capability = asObject(item, "capability");
    invariant(["required", "optional", "operation-required"].includes(asString(capability.availability, "availability")), "invalid capability availability");
    invariant(asString(capability.degraded_behavior, "degraded behavior").length > 0, "missing degraded behavior");
  }
  invariant(
    asArray(contract.denied, "denied").every((item) => {
      const denied = asObject(item, "denied capability");
      return denied.access === "destructive" && denied.availability === "forbidden";
    }),
    "denied operations must be forbidden destructive capabilities",
  );
  const coverage = asObject(readJson("tests/fixtures/mcp/capability_coverage.json"), "coverage");
  invariant(missingCapabilityCoverage(contract, coverage.data ?? null).length === 0, "semantic capability fixture coverage is incomplete");
}

function validateConfig(): void {
  requireValid("config.schema.json", "template/.kilo/config/jiraman.json");
  const policy = parseFrontmatter(readText("template/.kilo/policies/jiraman-safety.md"));
  invariant(policy.get("policy_version") === "5" && policy.get("project") === "AIPLATFORM" && policy.get("write_mode") === "exact-apply-only", "invalid structured policy metadata");
}

function validateConfluenceMetadata(): void {
  requireValid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.valid.json");
  requireInvalid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.invalid.json");
}

function validateConfluenceTemplates(): void {
  const index = asObject(readJson("template/docs/project-management/templates/confluence/index.json"), "template index");
  const pages = asArray(index.page_types, "page types");
  invariant(pages.length === 12, `expected 12 page templates, found ${pages.length}`);
  for (const item of pages) {
    const page = asObject(item, "page type");
    const path = `template/docs/project-management/templates/confluence/${asString(page.file, "template file")}`;
    const text = readText(path);
    for (const field of ["page_type", "owner", "status", "created", "last_reviewed", "review_due", "jira_project", "related_epics", "related_stories", "deliverable_id", "confidentiality", "managed_by", "ownership"]) {
      invariant(text.includes(`${field}:`), `${path} missing metadata ${field}`);
    }
    invariant(text.includes("JIRAMAN:BEGIN") && text.includes("JIRAMAN:END") && text.includes("HUMAN:BEGIN") && text.includes("HUMAN:END"), `${path} missing ownership markers`);
  }
}

function validateFixtures(domain: string): void {
  const directories = FIXTURE_DOMAINS[domain];
  invariant(directories !== undefined, `unknown fixture domain: ${domain}`);
  for (const directory of directories) {
    for (const path of fixtureFiles(directory)) {
      requireValid("fixture.schema.json", path);
    }
  }
  const nested: Readonly<Record<string, readonly [string, string][]>> = {
    "spec-fixtures": [["specification.schema.json", "tests/fixtures/specs/complete.json"]],
    "backlog-drafts": [["backlog-draft.schema.json", "tests/fixtures/drafts/backlog.json"]],
    "subtask-drafts": [["subtask-draft.schema.json", "tests/fixtures/drafts/subtasks.json"]],
    "deliverable-fixtures": [["deliverable-plan.schema.json", "tests/fixtures/deliverables/cases.json"]],
    "governance-fixtures": [["governance.schema.json", "tests/fixtures/governance/meeting-risk-decision.json"]],
  };
  for (const [schema, path] of nested[domain] ?? []) {
    const wrapper = asObject(readJson(path), path);
    const result = validateJson(schema, wrapper.data ?? null);
    invariant(result.valid, `${path} failed ${schema}: ${JSON.stringify(result.errors)}`);
  }
  if (domain === "spec-fixtures") {
    const incomplete = asObject(readJson("tests/fixtures/specs/incomplete.json"), "incomplete spec");
    invariant(!validateJson("specification.schema.json", incomplete.data ?? null).valid, "incomplete specification unexpectedly passed");
  }
  if (domain === "subtask-drafts") {
    for (const path of ["tests/fixtures/drafts/subtasks.oversized.json", "tests/fixtures/drafts/subtasks.untraced.json", "tests/fixtures/drafts/subtasks.unverifiable.json"]) {
      const wrapper = asObject(readJson(path), path);
      invariant(!validateJson("subtask-draft.schema.json", wrapper.data ?? null).valid, `${path} unexpectedly passed`);
    }
  }
  if (domain === "backlog-drafts") {
    const matrix = asArray(asObject(asObject(readJson("tests/fixtures/drafts/backlog-matrix.json"), "backlog matrix").data ?? null, "matrix data").cases, "matrix cases");
    for (const value of matrix) {
      const entry = asObject(value, "backlog matrix case");
      const result = validateJson("backlog-draft.schema.json", entry.draft ?? null);
      invariant(result.valid, `backlog matrix case ${asString(entry.case, "case name")} failed: ${JSON.stringify(result.errors)}`);
    }
  }
}

function validateActions(): void {
  requireValid("action-group.schema.json", "examples/action-group.valid.json");
  requireInvalid("action-group.schema.json", "examples/action-group.invalid.json");
  requireValid("action-group.schema.json", "tests/fixtures/actions/valid.json");
  requireValid("action-group.schema.json", "tests/fixtures/actions/high-risk-approved.json");
  requireValid("fixture.schema.json", "tests/fixtures/actions/lifecycle.json");
  requireValid("audit-record.schema.json", "tests/fixtures/actions/audit-record.valid.json");
}

function validateDocs(): void {
  const paths = ["README.md", "UPGRADE.md", "CHANGELOG.md", "docs/architecture/jiraman-v5.md", "docs/command-reference.md", "docs/configuration-reference.md", "docs/security-model.md", "docs/manual-smoke-tests.md", "docs/release-checklist.md", "docs/rollback.md", "docs/troubleshooting.md", "docs/run-records.md"] as const;
  for (const path of paths) {
    invariant(existsSync(path), `missing documentation: ${path}`);
    for (const match of readText(path).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1];
      invariant(target !== undefined, `${path} has an empty link`);
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const localTarget = target.split(/[?#]/, 1)[0] ?? "";
      invariant(localTarget.length > 0, `${path} has an empty local link`);
      const absolute = resolve(ROOT, dirname(path), localTarget);
      invariant(absolute.startsWith(`${ROOT}${sep}`) && existsSync(absolute), `${path} has a broken local link: ${target}`);
    }
  }
  const readme = readText("README.md");
  for (const mode of ["daily", "health", "runway", "plan next-2-weeks", "brainstorm", "refine", "meeting", "risks", "decision", "status", "retrospective", "propose", "apply", "reject"]) {
    invariant(readme.includes(mode), `README missing command: ${mode}`);
  }
  invariant(missingChecklistGates().length === 0, `release checklist missing gates: ${missingChecklistGates().join(", ")}`);
  const workflow = readText(".github/workflows/ci.yml");
  invariant(workflow.includes("GITHUB_STEP_SUMMARY") && workflow.includes("actions/upload-artifact@v4") && workflow.includes("sanitized-ci-failure"), "CI summary or sanitized failure artifact retention is missing");
}

function validateNoRuntimeLanguage(): void {
  const checked = ["template", "scripts", "src", "tests"].flatMap((directory) => walkFiles(directory));
  const forbidden = checked.filter((path) => /\.(?:py|pyc|pyo)$/i.test(path) && !path.startsWith("tests/install/fixtures/"));
  invariant(forbidden.length === 0, `application runtime files are forbidden: ${forbidden.join(", ")}`);
}

const domain = process.argv[2] ?? "all";
const run = (name: string): void => {
  switch (name) {
    case "schemas": validateSchemas(); break;
    case "skills": validateSkills(); break;
    case "commands": validateCommands(); break;
    case "mcp-contract": case "mcp-profiles": validateMcp(); validateFixtures(name); break;
    case "config": validateConfig(); break;
    case "confluence-metadata": validateConfluenceMetadata(); break;
    case "confluence-templates": validateConfluenceTemplates(); break;
    case "actions": validateActions(); break;
    case "audit-fixtures": requireValid("audit-record.schema.json", "tests/fixtures/actions/audit-record.valid.json"); break;
    case "docs": validateDocs(); break;
    default: validateFixtures(name);
  }
};
if (domain === "all") {
  validateSchemas(); validateSkills(); validateCommands(); validateMcp(); validateConfig(); validateConfluenceMetadata(); validateConfluenceTemplates(); validateActions(); validateDocs(); validateNoRuntimeLanguage();
  for (const name of Object.keys(FIXTURE_DOMAINS)) validateFixtures(name);
} else {
  run(domain);
  validateNoRuntimeLanguage();
}
console.log(`VALID ${domain}`);
