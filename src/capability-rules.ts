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

export function responseFixtureViolations(contract: JsonObject, fixture: JsonObject): string[] {
  const responses = asArray(asObject(fixture.data ?? null, "response fixture data").responses, "responses").map((item) => asObject(item, "response"));
  const violations: string[] = [];
  for (const item of asArray(contract.capabilities, "capabilities").map((value) => asObject(value, "capability"))) {
    const semantic = asString(item.semantic, "capability semantic");
    const access = asString(item.access, "capability access");
    const matches = responses.filter((response) => response.semantic === semantic);
    if (matches.length !== 1) {
      violations.push(`${semantic}:response-count`);
      continue;
    }
    const response = matches[0];
    invariant(response !== undefined, "one response is required");
    if (response.access !== access) violations.push(`${semantic}:access`);
    if (response.sanitized !== true) violations.push(`${semantic}:sanitization`);
    if (response.expected_compatibility !== "resolved") violations.push(`${semantic}:compatibility`);
    if (response.response === null || typeof response.response !== "object" || Array.isArray(response.response)) violations.push(`${semantic}:payload`);
    if (access === "write") {
      const approval = response.approval;
      const readAfterWrite = response.read_after_write;
      if (approval === null || typeof approval !== "object" || Array.isArray(approval) || approval.status !== "approved" || typeof approval.action_id !== "string") violations.push(`${semantic}:approval`);
      if (readAfterWrite === null || typeof readAfterWrite !== "object" || Array.isArray(readAfterWrite) || readAfterWrite.verified !== true) violations.push(`${semantic}:verification`);
    }
  }
  return violations;
}

export function goalSchemaExpectationViolations(contract: JsonObject): string[] {
  const expectations = asObject(contract.schema_expectations ?? null, "schema expectations");
  const required: Readonly<Record<string, readonly string[]>> = {
    "jira.issue.create": ["project", "issue_type", "parent", "summary", "description", "due_date", "definition_of_done", "original_estimate"],
    "jira.issue.update": ["parent", "summary", "description", "due_date", "definition_of_done", "original_estimate"],
    "jira.issue.read": ["issue_type", "parent", "summary", "due_date", "description", "original_estimate"],
  };
  const violations: string[] = [];
  const acceptanceMapping = asObject(contract.acceptance_criteria_mapping ?? null, "Acceptance Criteria mapping");
  if (acceptanceMapping.mode !== "managed-description-section" || acceptanceMapping.section_id !== "acceptance-criteria" || acceptanceMapping.heading !== "## Tiêu chí nghiệm thu" || acceptanceMapping.read_back_field !== "description" || acceptanceMapping.custom_field !== null || acceptanceMapping.comparison !== "all-approved-criterion-fields-exact") violations.push("acceptance-criteria-mapping");
  for (const [semantic, fields] of Object.entries(required)) {
    const expectation = asObject(expectations[semantic] ?? null, semantic);
    const configured = semantic === "jira.issue.read"
      ? asArray(expectation.read_back_fields, `${semantic} read-back fields`).map((value) => asString(value, "read-back field"))
      : [
          ...asArray(expectation.story_required_fields, `${semantic} Story fields`).map((value) => asString(value, "Story field")),
          ...asArray(expectation.subtask_required_fields, `${semantic} Sub-task fields`).map((value) => asString(value, "Sub-task field")),
        ];
    for (const field of fields) if (!configured.includes(field)) violations.push(`${semantic}:${field}`);
    if (expectation.due_date_mapping !== "required-unambiguous") violations.push(`${semantic}:due-date-mapping`);
    if (typeof expectation.degraded_behavior !== "string" || expectation.degraded_behavior.length === 0) violations.push(`${semantic}:degraded-behavior`);
  }
  return violations;
}
