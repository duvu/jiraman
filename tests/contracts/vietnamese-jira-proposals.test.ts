import { describe, expect, test } from "vitest";

import { asArray, asObject, asString, parseFrontmatter, readJson, readText, validateJson, type JsonValue } from "../../src/contracts.js";
import { resolveJiraContentLanguage } from "../../src/jira-language-rules.js";

const WORKFLOWS = [
  "jiraman-refinement",
  "jiraman-meeting-actions",
  "jiraman-risk-management",
  "jiraman-decision-management",
  "jiraman-next-two-weeks",
  "jiraman-sprint-cadence",
  "jiraman-daily",
  "jiraman-sprint-health",
] as const;

function resolveLocalJsonPointer(document: JsonValue, reference: string): JsonValue {
  const [path, pointer] = reference.split("#", 2);
  if (path !== "docs/project-management/templates/jira/index.json" || pointer === undefined || !pointer.startsWith("/")) throw new Error(`Invalid Jira language contract reference: ${reference}`);
  return pointer.slice(1).split("/").reduce<JsonValue>((current, token) => {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    const next = asObject(current, `JSON Pointer segment ${key}`)[key];
    if (next === undefined) throw new Error(`Unresolved Jira language contract reference: ${reference}`);
    return next;
  }, document);
}

describe("Vietnamese Jira proposal workflows", () => {
  test("defaults English and ambiguous inputs to vi-VN with exact literal preservation", () => {
    expect(resolveJiraContentLanguage(null)).toBe("vi-VN");
    expect(resolveJiraContentLanguage({requestedLanguage: "en-US", explicit: true})).toBe("en-US");
    expect(resolveJiraContentLanguage({requestedLanguage: "en-US", explicit: false})).toBe("vi-VN");
    expect(resolveJiraContentLanguage({requestedLanguage: "en_US", explicit: true})).toBe("vi-VN");
  });

  test("routes every Jira proposal workflow through the canonical language contract", () => {
    const index = asObject(readJson("template/docs/project-management/templates/jira/index.json"), "Jira template index");
    const workflows = asObject(index.proposal_workflows ?? null, "proposal workflows");
    const routes = Object.entries(workflows).map(([name, value]) => ({name, route: asObject(value, `proposal workflow ${name}`)}));
    expect(asObject(index.override_authorization ?? null, "override authorization").validation_context).toBe("separate-from-draft-and-action");

    expect(routes.map(({name}) => name).sort()).toEqual([...WORKFLOWS].sort());
    for (const {name, route} of routes) {
      expect(route).toMatchObject({
        name,
        default_content_language: "vi-VN",
        source_language_mode: "translate-user-facing-content",
        literal_mode: "preserve-exact",
        existing_issue_match: "evidence-not-language",
        ambiguity_mode: "vi-VN-with-assumption",
        writes_allowed: false,
      });
    }
  });

  test("translates the canonical English-source hierarchy fixture to Vietnamese", () => {
    const backlogFixture = asObject(readJson("tests/fixtures/drafts/backlog.json"), "backlog fixture");
    const metadata = asObject(backlogFixture.metadata ?? null, "backlog metadata");
    const source = asObject(metadata.source_user_facing_content ?? null, "English source content");
    const backlog = asObject(backlogFixture.data ?? null, "backlog data");
    const epic = asObject(backlog.epic ?? null, "Epic");
    const goal = asObject(asArray(backlog.stories, "Goal Stories")[0] ?? null, "Goal Story");
    const subtaskFixture = asObject(readJson("tests/fixtures/drafts/subtasks.json"), "Sub-task fixture");
    const subtaskData = asObject(subtaskFixture.data ?? null, "Sub-task data");
    const subtask = asObject(asArray(subtaskData.subtasks, "Sub-tasks")[0] ?? null, "Sub-task");

    expect(metadata.source).toBe("synthetic-english-source-translated");
    expect(validateJson("backlog-draft.schema.json", backlog)).toEqual({valid: true, errors: []});
    expect(validateJson("subtask-draft.schema.json", subtaskData)).toEqual({valid: true, errors: []});
    expect(epic.content_language).toBe("vi-VN");
    expect(goal.content_language).toBe("vi-VN");
    expect(source.epic_outcome).not.toBe(epic.outcome);
    expect(source.goal_name).not.toBe(goal.goal_name);
    expect(source.subtask_title).not.toBe(subtask.title);
    const rendered = JSON.stringify({backlog, subtaskData});
    for (const literal of asArray(metadata.preserved_literals, "preserved source literals")) expect(rendered).toContain(asString(literal, "preserved literal"));
  });

  test("binds every proposal skill to its exact indexed route", () => {
    const index = readJson("template/docs/project-management/templates/jira/index.json");
    for (const name of WORKFLOWS) {
      const path = `template/.kilo/skills/${name}/SKILL.md`;
      const frontmatter = parseFrontmatter(readText(path));
      const reference = frontmatter.get("jira_language_contract") ?? "";
      expect(reference).toBe(`docs/project-management/templates/jira/index.json#/proposal_workflows/${name}`);
      expect(asObject(resolveLocalJsonPointer(index, reference), `${name} language route`).name).toBe(name);
      expect(frontmatter.get("side_effects")).toBe("none");
    }
  });
});
