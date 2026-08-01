import { describe, expect, test } from "vitest";
import { capabilityHealth, missingCapabilityCoverage, resolveCapability } from "../../src/capability-rules.js";
import { asArray, asObject, asString, readJson } from "../../src/contracts.js";
import { evaluateScope, inspectUntrustedContent } from "../../src/security-rules.js";

describe("mcp-contract and mcp-profiles", () => {
  test("renamed tools resolve only when unambiguous and writes require ask", () => {
    const renamed = asObject(readJson("tests/fixtures/mcp/renamed.json"), "renamed");
    const ambiguous = asObject(readJson("tests/fixtures/mcp/ambiguous.json"), "ambiguous");
    const malformed = asObject(readJson("tests/fixtures/mcp/malformed.json"), "malformed");
    const permission = asObject(readJson("tests/fixtures/mcp/permission_error.json"), "permission");
    expect(resolveCapability("jira.issue.search", "read", renamed, "fallback").verdict).toBe("resolved");
    expect(resolveCapability("jira.issue.search", "read", ambiguous, "fallback").verdict).toBe("ambiguous");
    expect(resolveCapability("jira.issue.search", "read", malformed, "fallback").verdict).toBe("malformed");
    expect(resolveCapability("jira.issue.update", "write", permission, "fallback").verdict).toBe("permission-blocked");
    const contract = asObject(readJson("template/.kilo/config/mcp-atlassian.json"), "contract");
    for (const item of asArray(contract.capabilities, "capabilities").map((value) => asObject(value, "capability")).filter((value) => value.access === "write")) expect(item.permission).toBe("ask");
    const coverage = asObject(readJson("tests/fixtures/mcp/capability_coverage.json"), "coverage");
    expect(missingCapabilityCoverage(contract, coverage.data ?? null)).toEqual([]);
    const health = asObject(readJson("tests/fixtures/mcp/health.json"), "health");
    const healthData = asObject(health.data ?? null, "health data");
    const requested = asArray(healthData.requested, "requested").map((value) => asString(value, "requested capability"));
    expect(capabilityHealth(contract, health, requested).map((result) => [result.semantic, result.verdict, result.permissionExpectation])).toEqual([
      ["jira.sprint.read", "missing", "allow"],
      ["jira.issue.search", "resolved", "allow"],
      ["jira.issue.update", "missing", "ask"],
    ]);
  });
});

describe("scope-guards and untrusted-content", () => {
  test("cross-scope and embedded instructions remain blocked", () => {
    const scope = asArray(asObject(readJson("tests/fixtures/scope/cases.json"), "scope").data, "cases").map((value) => asObject(value, "case"));
    for (const item of scope) expect(evaluateScope(asString(item.request, "request")).allowed).toBe(item.allowed);
    expect(evaluateScope("inspect AIPLATFORM-101").boundedJql).toBe("project = AIPLATFORM AND key = AIPLATFORM-101");
    expect(evaluateScope("inspect OTHER-1").rejectedIdentifiers).toEqual(["OTHER-1"]);
    const injection = asObject(asObject(readJson("tests/fixtures/security/untrusted-content.json"), "injection").data ?? null, "data");
    const finding = inspectUntrustedContent(asString(injection.source, "source"), asString(injection.content, "content"));
    expect(finding?.preservedEvidenceIds).toEqual(["REQ-1"]);
    expect(finding?.blockedEffect).toEqual(["scope change", "tool selection", "write approval", "secret disclosure"]);
    expect(inspectUntrustedContent(asString(injection.source, "source"), asString(injection.baseline_content, "baseline"))).toBeNull();
  });
});
