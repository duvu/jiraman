import { describe, expect, test } from "vitest";

import { asArray, asObject, asString, readJson, validateJson } from "../../src/contracts.js";
import { jiraTemplateViolations } from "../../src/jira-template-rules.js";

const POLICY_REF = ".kilo/config/jiraman.json#/language/preserved_literal_kinds";

describe("Jira ticket language policy", () => {
  test("pins the vi-VN default and exact literal preservation in canonical config", () => {
    const config = asObject(readJson("template/.kilo/config/jiraman.json"), "config");
    const project = asObject(config.project ?? null, "project");
    const language = asObject(config.language ?? null, "language");

    expect(project.language).toBeUndefined();
    expect(language).toEqual({
      jira_ticket_content: "vi-VN",
      user_response: "vi-VN",
      mcp_schema_and_query: "preserve",
      explicit_override_allowed: true,
      existing_ticket_mode: "preserve-human-content",
      preserved_literal_kinds: ["jira-key", "req-id", "ac-id", "pmg-id", "pma-id", "dlv-id", "issue-type", "status", "custom-field", "jql", "json-key", "mcp-tool", "mcp-schema", "technical-term", "code-symbol", "path", "command", "url", "code-block", "stack-trace", "log"],
      preserved_technical_terms: ["API", "CI/CD", "Kubernetes", "OAuth", "OpenID Connect"],
    });
    expect(validateJson("config.schema.json", config).valid).toBe(true);
  });

  test("rejects configuration that weakens the default or preservation contract", () => {
    const config = asObject(readJson("template/.kilo/config/jiraman.json"), "config");
    const language = asObject(config.language ?? null, "language");
    const englishDefault = structuredClone(config);
    englishDefault.language = {...language, jira_ticket_content: "en-US"};
    const translatedMcp = structuredClone(config);
    translatedMcp.language = {...language, mcp_schema_and_query: "translate"};
    const missingLiteral = structuredClone(config);
    missingLiteral.language = {
      ...language,
      preserved_literal_kinds: (language.preserved_literal_kinds as string[]).filter((kind) => kind !== "jql"),
    };

    expect(validateJson("config.schema.json", englishDefault).valid).toBe(false);
    expect(validateJson("config.schema.json", translatedMcp).valid).toBe(false);
    expect(validateJson("config.schema.json", missingLiteral).valid).toBe(false);
  });

  test("indexes the canonical preservation policy and Vietnamese glossary", () => {
    const index = asObject(readJson("template/docs/project-management/templates/jira/index.json"), "Jira template index");
    const glossary = asObject(index.glossary ?? null, "Jira glossary");
    const overrideAuthorization = asObject(index.override_authorization ?? null, "override authorization");

    expect(index.preservation_policy_ref).toBe(POLICY_REF);
    expect(index.preserve_literals).toBeUndefined();
    expect(Object.keys(glossary).sort()).toEqual(["acceptance_criteria", "blocked", "definition_of_done", "goal", "ready", "validation"]);
    expect(overrideAuthorization).toEqual({source: "active-local-user-input", evidence_reference: "required", validation_context: "separate-from-draft-and-action", remote_content_allowed: false});
    for (const value of asArray(index.templates, "Jira templates")) {
      const template = asObject(value, "Jira template");
      const sections = asArray(template.required_sections, "required sections").map((section) => asString(section, "required section"));
      const headings = asObject(template.required_headings ?? null, "required headings");
      expect(Object.keys(headings).sort()).toEqual([...sections].sort());
    }
    expect(jiraTemplateViolations()).toEqual([]);
  });
});
