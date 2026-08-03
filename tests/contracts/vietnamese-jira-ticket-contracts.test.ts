import { describe, expect, test } from "vitest";

import { asArray, asObject, readJson, validateJson, type JsonObject } from "../../src/contracts.js";

const POLICY_REF = ".kilo/config/jiraman.json#/language/preserved_literal_kinds";

function fixtureData(path: string): JsonObject {
  return asObject(asObject(readJson(path), path).data ?? null, `${path} data`);
}

describe("Vietnamese Jira ticket contracts", () => {
  test("requires language and literal-preservation metadata on every Jira draft", () => {
    const backlog = fixtureData("tests/fixtures/drafts/backlog.json");
    const subtasks = fixtureData("tests/fixtures/drafts/subtasks.json");

    expect(validateJson("backlog-draft.schema.json", backlog).valid).toBe(true);
    expect(validateJson("subtask-draft.schema.json", subtasks).valid).toBe(true);

    const missingEpicLanguage = structuredClone(backlog);
    delete asObject(missingEpicLanguage.epic ?? null, "epic").content_language;
    const missingGoalPreservation = structuredClone(backlog);
    delete asObject(asArray(missingGoalPreservation.stories, "stories")[0] ?? null, "story").literal_preservation;
    const missingSubtaskLanguage = structuredClone(subtasks);
    delete asObject(asArray(missingSubtaskLanguage.subtasks, "subtasks")[0] ?? null, "subtask").content_language;

    expect(validateJson("backlog-draft.schema.json", missingEpicLanguage).valid).toBe(false);
    expect(validateJson("backlog-draft.schema.json", missingGoalPreservation).valid).toBe(false);
    expect(validateJson("subtask-draft.schema.json", missingSubtaskLanguage).valid).toBe(false);
  });

  test("allows one explicitly scoped override and rejects scope leakage", () => {
    const backlog = fixtureData("tests/fixtures/drafts/backlog.json");
    const overridden = structuredClone(backlog);
    const story = asObject(asArray(overridden.stories, "stories")[0] ?? null, "story");
    story.content_language = "en-US";
    story.language_override = {
      requested_language: "en-US",
      scope_type: "jira-draft",
      scope_ref: story.draft_ref ?? "",
      source: "explicit-user-request",
      evidence_reference: "user-request-2026-08-03",
    };
    const leaked = structuredClone(overridden);
    asObject(asArray(leaked.stories, "stories")[0] ?? null, "story").language_override = {
      requested_language: "en-US",
      scope_type: "jira-draft",
      scope_ref: "story-2",
      source: "explicit-user-request",
      evidence_reference: "user-request-2026-08-03",
    };

    expect(validateJson("backlog-draft.schema.json", overridden).valid).toBe(true);
    expect(validateJson("backlog-draft.schema.json", leaked).valid).toBe(false);
  });

  test("preserves the canonical literal policy reference on draft metadata", () => {
    const backlog = fixtureData("tests/fixtures/drafts/backlog.json");
    const epic = asObject(backlog.epic ?? null, "epic");
    const story = asObject(asArray(backlog.stories, "stories")[0] ?? null, "story");

    expect(asObject(epic.literal_preservation ?? null, "epic preservation").policy_ref).toBe(POLICY_REF);
    expect(asObject(story.literal_preservation ?? null, "story preservation").policy_ref).toBe(POLICY_REF);
  });
});
