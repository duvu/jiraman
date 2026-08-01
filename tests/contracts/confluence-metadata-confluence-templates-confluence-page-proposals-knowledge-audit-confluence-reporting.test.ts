import { describe, expect, test } from "vitest";
import { asArray, asObject, asString, readJson, requireInvalid, requireValid } from "../../src/contracts.js";
import { freshnessStatus, pageProposalViolations } from "../../src/security-rules.js";

describe("confluence-metadata and confluence-templates", () => {
  test("metadata schema and all governed page types are complete", () => {
    requireValid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.valid.json");
    requireInvalid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.invalid.json");
    requireInvalid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.invalid-date.json");
    expect(asArray(asObject(readJson("template/docs/project-management/templates/confluence/index.json"), "index").page_types, "pages")).toHaveLength(12);
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
});
