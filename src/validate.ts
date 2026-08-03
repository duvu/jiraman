import { existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

import { goalSchemaExpectationViolations, missingCapabilityCoverage } from "./capability-rules.js";
import { canonicalPayloadHash } from "./action-rules.js";
import {
  asArray,
  asObject,
  asString,
  invariant,
  listSkillFiles,
  parseFrontmatter,
  ROOT,
  readJson,
  readText,
  requireInvalid,
  requireValid,
  walkFiles,
} from "./contracts.js";
import { FIXTURE_DOMAINS, validateFixtures } from "./fixture-validation.js";
import { goalContractMetadataViolations, goalTemplateSectionViolations, type IndexedGoalDocument, type IndexedGoalTemplate } from "./goal-contract-metadata-rules.js";
import { missingChecklistGates } from "./release-rules.js";
import { goalPolicyMetadataValid } from "./goal-rules.js";
import { commandTableRoutes } from "./routing-rules.js";

const REQUIRED_SKILL_SECTIONS = ["Purpose", "Triggers", "Required Evidence", "Output Contract", "Semantic Capabilities", "Workflow", "Side Effects", "Degraded Mode", "Shared Policy"] as const;

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
  const entries = asArray(index.skills, "skills index skills");
  const documents: IndexedGoalDocument[] = [];
  invariant(entries.length === files.length, "skill index must cover every installed skill exactly once");
  for (const item of entries) {
    const entry = asObject(item, "skill entry");
    invariant(names.has(asString(entry.name, "skill entry name")), "skill index has unresolved name");
    const path = asString(entry.path, "skill entry path").replace(/^\.kilo\//, "template/.kilo/");
    invariant(existsSync(path), "skill index has unresolved path");
    documents.push({path, goalContractRequired: entry.goal_contract_required, goalContract: parseFrontmatter(readText(path)).get("goal_contract")});
  }
  const contractIndex = asObject(readJson("template/docs/project-management/templates/confluence/index.json"), "template index");
  const contract = asObject(contractIndex.goal_contract ?? null, "Goal contract");
  const violations = goalContractMetadataViolations(contract, documents);
  invariant(violations.length === 0, `skill Goal contract metadata violations: ${violations.join(", ")}`);
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
  invariant(goalSchemaExpectationViolations(contract).length === 0, "Goal field schema expectations are incomplete");
}

function validateConfig(): void {
  requireValid("config.schema.json", "template/.kilo/config/jiraman.json");
  const policy = parseFrontmatter(readText("template/.kilo/policies/jiraman-safety.md"));
  invariant(policy.get("policy_version") === "5" && policy.get("project") === "AIPLATFORM" && policy.get("write_mode") === "exact-apply-only", "invalid structured policy metadata");
  invariant(goalPolicyMetadataValid(policy), "invalid Goal delivery policy metadata");
}

function validateConfluenceMetadata(): void {
  requireValid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.valid.json");
  requireInvalid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.invalid.json");
}

function validateConfluenceTemplates(): void {
  const index = asObject(readJson("template/docs/project-management/templates/confluence/index.json"), "template index");
  const pages = asArray(index.page_types, "page types");
  const documents: IndexedGoalDocument[] = [];
  const templates: IndexedGoalTemplate[] = [];
  invariant(pages.length === 12, `expected 12 page templates, found ${pages.length}`);
  for (const item of pages) {
    const page = asObject(item, "page type");
    const path = `template/docs/project-management/templates/confluence/${asString(page.file, "template file")}`;
    const text = readText(path);
    documents.push({path, goalContractRequired: page.goal_contract_required, goalContract: parseFrontmatter(text).get("goal_contract")});
    templates.push({path, goalContractRequired: page.goal_contract_required, requiredGoalSections: page.required_goal_sections, text});
    for (const field of ["page_type", "owner", "status", "created", "last_reviewed", "review_due", "jira_project", "related_epics", "related_stories", "deliverable_id", "confidentiality", "managed_by", "ownership"]) {
      invariant(text.includes(`${field}:`), `${path} missing metadata ${field}`);
    }
    invariant(text.includes("JIRAMAN:BEGIN") && text.includes("JIRAMAN:END") && text.includes("HUMAN:BEGIN") && text.includes("HUMAN:END"), `${path} missing ownership markers`);
  }
  const contract = asObject(index.goal_contract ?? null, "Goal contract");
  const violations = goalContractMetadataViolations(contract, documents);
  invariant(violations.length === 0, `template Goal contract metadata violations: ${violations.join(", ")}`);
  const sectionViolations = goalTemplateSectionViolations(templates);
  invariant(sectionViolations.length === 0, `template Goal section violations: ${sectionViolations.join(", ")}`);
}

function validateActions(): void {
  requireValid("action-group.schema.json", "examples/action-group.valid.json");
  requireInvalid("action-group.schema.json", "examples/action-group.invalid.json");
  requireValid("action-group.schema.json", "tests/fixtures/actions/valid.json");
  requireValid("action-group.schema.json", "tests/fixtures/actions/high-risk-approved.json");
  for (const path of ["examples/action-group.valid.json", "tests/fixtures/actions/valid.json", "tests/fixtures/actions/high-risk-approved.json"]) {
    const group = asObject(readJson(path), path);
    invariant(group.payload_hash === canonicalPayloadHash(asArray(group.actions, path + " actions")), path + " has a non-canonical payload hash");
    const approval = asObject(group.approval ?? null, path + " approval");
    if (group.status === "approved") invariant(approval.payload_hash === group.payload_hash, path + " approval hash does not bind the payload");
  }
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
  invariant(workflow.includes("GITHUB_STEP_SUMMARY") && workflow.includes("actions/upload-artifact@") && workflow.includes("sanitized-ci-failure") && workflow.includes("sanitize_ci_log.sh"), "CI summary or sanitized failure artifact retention is missing");
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
