import { asArray, asObject, asString, invariant, type JsonObject, type JsonValue } from "./contracts.js";

export type CapabilityVerdict = "resolved" | "missing" | "ambiguous" | "malformed" | "permission-blocked";
export interface CapabilityResolution {
  readonly semantic: string;
  readonly verdict: CapabilityVerdict;
  readonly exposedTool: string | null;
  readonly permissionExpectation: "allow" | "ask";
  readonly remediation: string;
}

function toolsFromManifest(manifest: JsonObject): JsonObject[] {
  const data = asObject(manifest.data ?? null, "MCP fixture data");
  return asArray(data.tools, "MCP tools").map((item) => asObject(item, "MCP tool"));
}

export function resolveCapability(semantic: string, access: string, manifest: JsonObject, degradedBehavior: string): CapabilityResolution {
  const matches = toolsFromManifest(manifest).filter((tool) => tool.semantic_capability === semantic);
  const expectation = access === "write" ? "ask" : "allow";
  if (matches.length === 0) return { semantic, verdict: "missing", exposedTool: null, permissionExpectation: expectation, remediation: degradedBehavior };
  if (matches.length > 1) return { semantic, verdict: "ambiguous", exposedTool: null, permissionExpectation: expectation, remediation: "Remove ambiguity or expose one schema-compatible tool." };
  const tool = matches[0];
  invariant(tool !== undefined, "one matching tool is required");
  const name = asString(tool.name, "tool name");
  if (tool.schema === null || typeof tool.schema !== "object" || Array.isArray(tool.schema)) return { semantic, verdict: "malformed", exposedTool: name, permissionExpectation: expectation, remediation: "Expose a valid input schema." };
  if (access === "write" && tool.permission !== "ask") return { semantic, verdict: "permission-blocked", exposedTool: name, permissionExpectation: "ask", remediation: "Set the exposed write tool permission to ask." };
  return { semantic, verdict: "resolved", exposedTool: name, permissionExpectation: expectation, remediation: "none" };
}

export function capabilityHealth(contract: JsonObject, manifest: JsonObject, semantics: readonly string[]): CapabilityResolution[] {
  const capabilities = asArray(contract.capabilities, "capabilities").map((item) => asObject(item, "capability"));
  return semantics.map((semantic) => {
    const capability = capabilities.find((candidate) => candidate.semantic === semantic);
    invariant(capability !== undefined, `unknown semantic capability: ${semantic}`);
    return resolveCapability(semantic, asString(capability.access, "capability access"), manifest, asString(capability.degraded_behavior, "degraded behavior"));
  });
}

export function missingCapabilityCoverage(contract: JsonObject, coverage: JsonValue): string[] {
  const covered = new Set(asArray(coverage, "capability coverage").map((item) => asString(asObject(item, "coverage item").semantic, "coverage semantic")));
  return asArray(contract.capabilities, "capabilities")
    .map((item) => asString(asObject(item, "capability").semantic, "capability semantic"))
    .filter((semantic) => !covered.has(semantic));
}
