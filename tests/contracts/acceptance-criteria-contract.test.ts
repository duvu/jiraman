import { describe, expect, test } from "vitest";

import {
  acceptanceCriteriaReadBackMatches,
} from "../../src/action-rules.js";
import { goalActionSemanticErrors } from "../../src/goal-action-rules.js";
import { candidateCanCommit } from "../../src/workflow-rules.js";
import {
  asArray,
  asObject,
  asString,
  listSkillFiles,
  parseFrontmatter,
  readJson,
  readText,
  validateJson,
  type JsonObject,
} from "../../src/contracts.js";
import { goalHierarchyGroup } from "./goal-hierarchy-fixture.js";

function goalCriterion(id: string, requirementId: string): JsonObject {
  return {
    id,
    statement: "Bản sao lưu được khôi phục nguyên vẹn trong dự án kiểm thử",
    verification: "./tests/install/run-v4-upgrade.sh",
    requirement_refs: [requirementId],
  };
}

function localCriterion(): JsonObject {
  return {
    id: "AC-1",
    statement: "Kết quả kiểm thử được ghi nhận cho deliverable của Sub-task",
    verification: "./tests/install/run-v4-upgrade.sh",
    validation_ref: "VAL-1",
    definition_of_done_ref: "DOD-1",
  };
}

function structuredBacklog(): JsonObject {
  const backlog = structuredClone(asObject(asObject(readJson("tests/fixtures/drafts/backlog.json"), "backlog fixture").data ?? null, "backlog"));
  asObject(backlog.epic ?? null, "Epic").acceptance_criteria = [{
    id: "AC-1",
    statement: "Tất cả Goal Stories được nghiệm thu và bằng chứng khôi phục đạt thước đo thành công",
    verification: "Đối chiếu trạng thái nghiệm thu của Story map và chạy ./tests/install/run-v4-upgrade.sh",
  }];
  for (const value of asArray(backlog.stories, "Goal Stories")) {
    const story = asObject(value, "Goal Story");
    const requirementId = asString(asArray(story.requirements, "requirements")[0], "requirement ID");
    const criterionId = requirementId === "REQ-1" ? "AC-1" : "AC-2";
    story.acceptance_criteria = [goalCriterion(criterionId, requirementId)];
  }
  return backlog;
}

function structuredSubtasks(): JsonObject {
  const packageValue = structuredClone(asObject(asObject(readJson("tests/fixtures/drafts/subtasks.json"), "Sub-task fixture").data ?? null, "Sub-task package"));
  const goal = asObject(packageValue.goal ?? null, "Goal");
  goal.requirements = ["REQ-1"];
  goal.acceptance_criteria = [goalCriterion("AC-1", "REQ-1")];
  for (const value of asArray(packageValue.subtasks, "Sub-tasks")) {
    const subtask = asObject(value, "Sub-task");
    subtask.parent_acceptance_criteria_refs = ["AC-1"];
    subtask.acceptance_criteria = [localCriterion()];
  }
  const traceability = asObject(packageValue.traceability ?? null, "traceability");
  delete traceability.acceptance_criteria;
  traceability.parent_acceptance_criteria = {"AC-1": ["subtask-1", "subtask-2"]};
  return packageValue;
}

describe("Acceptance Criteria contract", () => {
  test("accepts structured Epic and Goal criteria when every requirement is covered", () => {
    // Given
    const backlog = structuredBacklog();

    // When
    const result = validateJson("backlog-draft.schema.json", backlog);

    // Then
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
  });

  test("rejects duplicate, vague, and uncovered Goal criteria at precise boundaries", () => {
    // Given
    const duplicate = structuredBacklog();
    const duplicateStory = asObject(asArray(duplicate.stories, "stories")[0] ?? null, "story");
    asArray(duplicateStory.acceptance_criteria, "criteria").push(goalCriterion("AC-1", "REQ-1"));
    const vague = structuredBacklog();
    const vagueCriterion = asObject(asArray(asObject(asArray(vague.stories, "stories")[0] ?? null, "story").acceptance_criteria, "criteria")[0] ?? null, "criterion");
    vagueCriterion.verification = "đã kiểm tra";
    const uncovered = structuredBacklog();
    const uncoveredCriterion = asObject(asArray(asObject(asArray(uncovered.stories, "stories")[0] ?? null, "story").acceptance_criteria, "criteria")[0] ?? null, "criterion");
    uncoveredCriterion.requirement_refs = ["REQ-999"];

    // When
    const duplicateResult = validateJson("backlog-draft.schema.json", duplicate);
    const vagueResult = validateJson("backlog-draft.schema.json", vague);
    const uncoveredResult = validateJson("backlog-draft.schema.json", uncovered);

    // Then
    expect(duplicateResult.errors.some((error) => error.keyword === "uniqueAcceptanceCriterionIds")).toBe(true);
    expect(vagueResult.errors.some((error) => error.keyword === "testableAcceptanceCriterion")).toBe(true);
    expect(uncoveredResult.errors.some((error) => error.keyword === "requirementAcceptanceCoverage")).toBe(true);
  });

  test("accepts local Sub-task criteria only with resolved parent and validation traceability", () => {
    // Given
    const valid = structuredSubtasks();
    const invalidParent = structuredSubtasks();
    asObject(asArray(invalidParent.subtasks, "Sub-tasks")[0] ?? null, "Sub-task").parent_acceptance_criteria_refs = ["AC-999"];
    const invalidLocalTrace = structuredSubtasks();
    const criterion = asObject(asArray(asObject(asArray(invalidLocalTrace.subtasks, "Sub-tasks")[0] ?? null, "Sub-task").acceptance_criteria, "criteria")[0] ?? null, "criterion");
    criterion.validation_ref = "VAL-999";

    // When
    const validResult = validateJson("subtask-draft.schema.json", valid);
    const invalidParentResult = validateJson("subtask-draft.schema.json", invalidParent);
    const invalidLocalTraceResult = validateJson("subtask-draft.schema.json", invalidLocalTrace);

    // Then
    expect(validResult.valid, JSON.stringify(validResult.errors)).toBe(true);
    expect(invalidParentResult.errors.some((error) => error.keyword === "resolvedParentAcceptanceReference")).toBe(true);
    expect(invalidLocalTraceResult.errors.some((error) => error.keyword === "localAcceptanceTraceability")).toBe(true);
  });

  test("requires source specifications to preserve statements, verification, and requirement coverage", () => {
    // Given
    const specification = structuredClone(asObject(asObject(readJson("tests/fixtures/specs/complete.json"), "spec fixture").data ?? null, "specification"));
    specification.acceptance_criteria = [{
      ...goalCriterion("AC-1", "REQ-1"),
      source_section: "Acceptance",
    }];

    // When
    const result = validateJson("specification.schema.json", specification);

    // Then
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
  });

  test("compares every approved AC field during read-after-write verification", () => {
    // Given
    const approved = [goalCriterion("AC-1", "REQ-1")];
    const changedStatement = structuredClone(approved);
    asObject(changedStatement[0] ?? null, "changed criterion").statement = "Nội dung đã bị thay đổi";
    const missingVerification = structuredClone(approved);
    delete asObject(missingVerification[0] ?? null, "missing verification").verification;

    // When / Then
    expect(acceptanceCriteriaReadBackMatches(approved, structuredClone(approved))).toBe(true);
    expect(acceptanceCriteriaReadBackMatches(approved, changedStatement)).toBe(false);
    expect(acceptanceCriteriaReadBackMatches(approved, missingVerification)).toBe(false);
  });

  test("blocks Jira proposals with uncovered parent criteria or unsafe description replacement", () => {
    // Given
    const uncovered = goalHierarchyGroup();
    const uncoveredActions = asArray(uncovered.actions, "uncovered actions").map((value) => asObject(value, "uncovered action"));
    for (const index of [2, 3]) {
      asObject(uncoveredActions[index]?.desired_state ?? null, "Sub-task desired state").parent_acceptance_criteria_refs = ["AC-999"];
    }
    const unsafeUpdate = goalHierarchyGroup();
    const updateAction = asObject(asArray(unsafeUpdate.actions, "unsafe update actions")[1] ?? null, "Story update action");
    const approvedState = structuredClone(asObject(updateAction.desired_state ?? null, "approved Story state"));
    updateAction.operation = "issue.update";
    updateAction.target_version = 7;
    updateAction.before_state = approvedState;
    updateAction.desired_state = {
      acceptance_criteria: structuredClone(approvedState.acceptance_criteria ?? null),
      description: "replace human-authored description",
    };

    // When
    const uncoveredErrors = goalActionSemanticErrors(uncovered);
    const unsafeUpdateErrors = goalActionSemanticErrors(unsafeUpdate);

    // Then
    expect(uncoveredErrors.some((error) => error.keyword === "resolvedParentAcceptanceReference")).toBe(true);
    expect(uncoveredErrors.some((error) => error.keyword === "goalAcceptanceSubtaskCoverage")).toBe(true);
    expect(unsafeUpdateErrors.some((error) => error.keyword === "managedAcceptanceSection")).toBe(true);
  });

  test("keeps Ready candidates executable only with structured criteria", () => {
    // Given
    const fixture = asObject(asObject(readJson("tests/fixtures/deliverables/cases.json"), "deliverable fixture").data ?? null, "deliverable data");
    const candidate = structuredClone(asObject(asArray(fixture.candidates, "candidates")[0] ?? null, "candidate"));
    const goal = asObject(asArray(candidate.goals, "goals")[0] ?? null, "Goal");
    goal.acceptance_criteria = [goalCriterion("AC-1", "REQ-1")];

    // When
    const ready = candidateCanCommit(candidate);

    // Then
    expect(ready).toBe(true);
  });

  test("indexes three managed Jira templates with a structured AC section", () => {
    // Given
    const index = asObject(readJson("template/docs/project-management/templates/jira/index.json"), "Jira template index");
    const templates = asArray(index.templates, "Jira templates");

    // When
    const violations = templates.flatMap((value) => {
      const template = asObject(value, "Jira template");
      const file = asString(template.file, "template file");
      const sections = asArray(template.required_sections, "required sections").map((section) => asString(section, "section"));
      const text = readText(`template/docs/project-management/templates/jira/${file}`);
      return sections.flatMap((section) => {
        const begin = `<!-- JIRAMAN:JIRA-SECTION:${section}:BEGIN -->`;
        const end = `<!-- JIRAMAN:JIRA-SECTION:${section}:END -->`;
        return text.includes(begin) && text.includes(end) ? [] : [`${file}:${section}`];
      });
    });

    // Then
    expect(templates).toHaveLength(3);
    expect(violations).toEqual([]);
  });

  test("routes every Jira proposal workflow through the canonical ticket contract", () => {
    // Given
    const proposalSkills = new Set([
      "jiraman-apply-actions",
      "jiraman-daily",
      "jiraman-decision-management",
      "jiraman-meeting-actions",
      "jiraman-next-two-weeks",
      "jiraman-refinement",
      "jiraman-risk-management",
      "jiraman-sprint-cadence",
      "jiraman-sprint-health",
    ]);

    // When
    const violations = listSkillFiles().flatMap((path) => {
      const frontmatter = parseFrontmatter(readText(path));
      const name = frontmatter.get("name");
      return name !== undefined && proposalSkills.has(name) && frontmatter.get("jira_ticket_contract") !== "docs/project-management/templates/jira/index.json" ? [name] : [];
    });

    // Then
    expect(violations).toEqual([]);
  });
});
