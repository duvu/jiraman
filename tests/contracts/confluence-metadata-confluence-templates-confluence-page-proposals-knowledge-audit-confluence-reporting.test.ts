import { describe, expect, test } from "vitest";
import { asArray, asObject, asString, invariant, readJson, readText, requireInvalid, requireValid } from "../../src/contracts.js";
import { goalTemplateSectionViolations, type IndexedGoalTemplate } from "../../src/goal-contract-metadata-rules.js";
import { freshnessStatus, pageProposalViolations } from "../../src/security-rules.js";

describe("confluence-metadata and confluence-templates", () => {
  test("metadata schema and all governed page types are complete", () => {
    requireValid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.valid.json");
    requireInvalid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.invalid.json");
    requireInvalid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.invalid-date.json");
    expect(asArray(asObject(readJson("template/docs/project-management/templates/confluence/index.json"), "index").page_types, "pages")).toHaveLength(12);
  });

  test("indexed Goal templates require non-empty structural section regions", () => {
    // Given
    const index = asObject(readJson("template/docs/project-management/templates/confluence/index.json"), "index");
    const templates = asArray(index.page_types, "pages").map((value): IndexedGoalTemplate => {
      const page = asObject(value, "page");
      const path = `template/docs/project-management/templates/confluence/${asString(page.file, "template file")}`;
      return {path, goalContractRequired: page.goal_contract_required, requiredGoalSections: page.required_goal_sections, text: readText(path)};
    });
    const required = templates.find((template) => Array.isArray(template.requiredGoalSections) && template.requiredGoalSections.length > 0);
    invariant(required !== undefined, "a Goal-aware template is required");
    const section = asString(asArray(required.requiredGoalSections, "required sections")[0], "required section");
    const begin = `<!-- JIRAMAN:GOAL-SECTION:${section}:BEGIN -->`;
    const end = `<!-- JIRAMAN:GOAL-SECTION:${section}:END -->`;
    const start = required.text.indexOf(begin);
    const finish = required.text.indexOf(end);
    invariant(start >= 0 && finish > start, "Goal section markers are required");
    const missingMarker = templates.map((template) => template === required ? {...template, text: template.text.replace(begin, "")} : template);
    const emptySection = templates.map((template) => template === required ? {...template, text: template.text.slice(0, start + begin.length) + "\n\n" + template.text.slice(finish)} : template);
    const missingInventory = templates.map((template) => template === required ? {...template, requiredGoalSections: undefined} : template);

    // When / Then
    expect(goalTemplateSectionViolations(templates)).toEqual([]);
    expect(goalTemplateSectionViolations(missingMarker)).toContain(`${required.path}:${section}:markers`);
    expect(goalTemplateSectionViolations(emptySection)).toContain(`${required.path}:${section}:content`);
    expect(goalTemplateSectionViolations(missingInventory)).toContain(`${required.path}:required-goal-sections`);
  });
});
describe("confluence-page-proposals knowledge-audit confluence-reporting", () => {
  test("ownership, ambiguity, freshness, and report evidence are explicit", () => {
    const proposals = asArray(asObject(readJson("tests/fixtures/confluence/page-proposals.json"), "proposals").data, "data").map((value) => asObject(value, "proposal"));
    for (const proposal of proposals.filter((item) => item.case !== "ambiguous-title")) expect(pageProposalViolations(proposal)).toEqual([]);
    const human = proposals.find((item) => item.case === "human");
    expect(pageProposalViolations({ ...(human ?? {}), operation: "page.update" })).toContain("human-page-replacement");
    const audit = asArray(asObject(readJson("tests/fixtures/confluence/knowledge-audit.json"), "audit").data, "data").map((value) => asObject(value, "finding"));
    expect(audit.find((item) => item.entity === "page-archived")?.rule).toBe("excluded-from-active-review");
    const changed = asObject(audit.find((item) => item.rule === "material-change-after-review") ?? null, "changed finding");
    expect(freshnessStatus(asString(changed.last_reviewed, "last reviewed"), asString(changed.jira_changed_at, "Jira changed"), changed.history_verified === true)).toBe("review required");
    expect(freshnessStatus("2026-08-01T00:00:00Z", null, false)).toBe("not verified");
    const report = asObject(asObject(readJson("tests/fixtures/confluence/report-contract.json"), "report").data ?? null, "data");
    expect(report.history).toBe("not verified");
    expect(asArray(report.sources, "sources").length).toBeGreaterThan(0);
  });

  test("Goal-aware page proposals preserve every required structural section", () => {
    const content = readText("template/docs/project-management/templates/confluence/story-specification.md");
    const proposal = {
      ownership: "jiraman-managed",
      current_version: 4,
      operation: "page.update",
      desired_content: content,
      page_type: "story-specification",
      preconditions: ["version remains current"],
      rollback_source: "version-4",
    };

    expect(pageProposalViolations(proposal)).toEqual([]);
    expect(pageProposalViolations({...proposal, desired_content: "replacement without Goal regions"}))
      .toContain("proposal:story-specification:goal-identity:markers");
  });
});
