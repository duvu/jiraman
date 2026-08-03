import { describe, expect, test } from "vitest";

import { asObject, readJson, validateJson } from "../../src/contracts.js";
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
      preserved_literal_kinds: ["jira-key", "req-id", "ac-id", "code", "path", "command", "url", "issue-type", "status", "json-key", "jql", "log"],
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

    expect(index.preservation_policy_ref).toBe(POLICY_REF);
    expect(index.preserve_literals).toBeUndefined();
    expect(Object.keys(glossary).sort()).toEqual(["acceptance_criteria", "blocked", "definition_of_done", "goal", "ready", "validation"]);
    expect(jiraTemplateViolations()).toEqual([]);
  });
});
