import {
  asArray,
  asObject,
  asString,
  fixtureFiles,
  invariant,
  readJson,
  requireValid,
  validateJson,
} from "./contracts.js";
import { goalPackageFixtureViolations } from "./goal-release-rules.js";

export const FIXTURE_DOMAINS: Readonly<Record<string, readonly string[]>> = {
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

export function validateFixtures(domain: string): void {
  const directories = FIXTURE_DOMAINS[domain];
  invariant(directories !== undefined, `unknown fixture domain: ${domain}`);
  for (const directory of directories) {
    for (const path of fixtureFiles(directory)) requireValid("fixture.schema.json", path);
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
    const goalViolations = goalPackageFixtureViolations();
    invariant(goalViolations.length === 0, `Goal package fixture violations: ${goalViolations.join(", ")}`);
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
      invariant(result.valid === (entry.expected_valid === true), `backlog matrix case ${asString(entry.case, "case name")} had unexpected validity: ${JSON.stringify(result.errors)}`);
    }
  }
}
