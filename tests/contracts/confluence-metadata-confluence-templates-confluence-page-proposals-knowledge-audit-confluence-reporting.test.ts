import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson, requireInvalid, requireValid } from "../../src/contracts.js";

describe("confluence-metadata and confluence-templates", () => {
  test("metadata schema and all governed page types are complete", () => {
    requireValid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.valid.json");
    requireInvalid("confluence-page-metadata.schema.json", "examples/confluence-page-metadata.invalid.json");
    expect(asArray(asObject(readJson("template/docs/project-management/templates/confluence/index.json"), "index").page_types, "pages")).toHaveLength(12);
  });
});
describe("confluence-page-proposals knowledge-audit confluence-reporting", () => {
  test("ownership, ambiguity, freshness, and report evidence are explicit", () => {
    const proposals = asArray(asObject(readJson("tests/fixtures/confluence/page-proposals.json"), "proposals").data, "data").map((value) => asObject(value, "proposal"));
    expect(proposals.find((item) => item.case === "human")?.operation).toBe("page.comment");
    expect(proposals.find((item) => item.case === "ambiguous-title")?.operation).toBe("blocked");
    const audit = asArray(asObject(readJson("tests/fixtures/confluence/knowledge-audit.json"), "audit").data, "data").map((value) => asObject(value, "finding"));
    expect(audit.find((item) => item.entity === "page-archived")?.rule).toBe("excluded-from-active-review");
    const report = asObject(asObject(readJson("tests/fixtures/confluence/report-contract.json"), "report").data ?? null, "data");
    expect(report.history).toBe("not verified");
    expect(asArray(report.sources, "sources").length).toBeGreaterThan(0);
  });
});
