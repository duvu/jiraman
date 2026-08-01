import { describe, expect, test } from "vitest";
import { asArray, asObject, readJson, readText } from "../../src/contracts.js";

describe("mcp-contract and mcp-profiles", () => {
  test("renamed tools resolve only when unambiguous and writes require ask", () => {
    const renamed = asObject(asObject(readJson("tests/fixtures/mcp/renamed.json"), "renamed").data ?? null, "data");
    const ambiguous = asObject(asObject(readJson("tests/fixtures/mcp/ambiguous.json"), "ambiguous").data ?? null, "data");
    expect(renamed.result).toBe("compatible-unambiguous");
    expect(ambiguous.result).toBe("blocked-ambiguous");
    const contract = asObject(readJson("template/.kilo/config/mcp-atlassian.json"), "contract");
    for (const item of asArray(contract.capabilities, "capabilities").map((value) => asObject(value, "capability")).filter((value) => value.access === "write")) expect(item.permission).toBe("ask");
  });
});

describe("scope-guards and untrusted-content", () => {
  test("cross-scope and embedded instructions remain blocked", () => {
    const policy = readText("template/.kilo/policies/jiraman-safety.md");
    expect(policy).toContain("project = AIPLATFORM");
    expect(policy).toContain("instruction injection");
    const scope = asArray(asObject(readJson("tests/fixtures/scope/cases.json"), "scope").data, "cases").map((value) => asObject(value, "case"));
    expect(scope.find((item) => item.request === "inspect OTHER-1")?.allowed).toBe(false);
    const injection = asObject(asObject(readJson("tests/fixtures/security/untrusted-content.json"), "injection").data ?? null, "data");
    expect(injection.preserved_requirement).toBe("REQ-1");
    expect(JSON.stringify(injection)).not.toContain("CANARY_SECRET");
  });
});
