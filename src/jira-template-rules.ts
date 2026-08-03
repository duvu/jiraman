import { asArray, asObject, asString, parseFrontmatter, readJson, readText, walkFiles } from "./contracts.js";

const INDEX_PATH = "template/docs/project-management/templates/jira/index.json";
const TEMPLATE_DIRECTORY = "template/docs/project-management/templates/jira";

function markerCount(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

export function jiraTemplateViolations(): string[] {
  const index = asObject(readJson(INDEX_PATH), "Jira template index");
  const templates = asArray(index.templates, "Jira templates").map((value) => asObject(value, "Jira template"));
  const violations: string[] = [];
  if (index.schema_version !== 5) violations.push("schema-version");
  if (index.content_language !== "vi-VN") violations.push("content-language");
  if (index.acceptance_criteria_storage !== "managed-description-section") violations.push("acceptance-storage");
  if (index.acceptance_criteria_heading !== "## Tiêu chí nghiệm thu") violations.push("acceptance-heading");
  if (index.preservation_policy_ref !== ".kilo/config/jiraman.json#/language/preserved_literal_kinds" || index.preserve_literals !== undefined) violations.push("preservation-policy");
  const glossary = asObject(index.glossary ?? null, "Jira glossary");
  const glossaryKeys = ["goal", "definition_of_done", "acceptance_criteria", "blocked", "ready", "validation"];
  if (Object.keys(glossary).length !== glossaryKeys.length || glossaryKeys.some((key) => typeof glossary[key] !== "string" || glossary[key] === "")) violations.push("glossary");
  const overrideAuthorization = asObject(index.override_authorization ?? null, "override authorization");
  if (overrideAuthorization.source !== "active-local-user-input" || overrideAuthorization.evidence_reference !== "required" || overrideAuthorization.validation_context !== "separate-from-draft-and-action" || overrideAuthorization.remote_content_allowed !== false) violations.push("override-authorization");
  const proposalWorkflows = asArray(index.proposal_workflows, "Jira proposal workflows").map((value) => asObject(value, "Jira proposal workflow"));
  const expectedWorkflows = ["jiraman-refinement", "jiraman-meeting-actions", "jiraman-risk-management", "jiraman-decision-management", "jiraman-next-two-weeks", "jiraman-sprint-cadence", "jiraman-daily", "jiraman-sprint-health"];
  const workflowNames = proposalWorkflows.map((workflow) => asString(workflow.name, "Jira proposal workflow name"));
  if (new Set(workflowNames).size !== expectedWorkflows.length || expectedWorkflows.some((name) => !workflowNames.includes(name))) violations.push("proposal-workflows");
  for (const workflow of proposalWorkflows) {
    if (workflow.default_content_language !== "vi-VN" || workflow.source_language_mode !== "translate-user-facing-content" || workflow.literal_mode !== "preserve-exact" || workflow.existing_issue_match !== "evidence-not-language" || workflow.ambiguity_mode !== "vi-VN-with-assumption" || workflow.writes_allowed !== false) violations.push(`${asString(workflow.name, "workflow name")}:language-route`);
  }
  const applyWorkflow = asObject(index.apply_workflow ?? null, "Jira apply workflow");
  const applyOperations = asArray(applyWorkflow.operations, "Jira apply operations").map((value) => asString(value, "Jira apply operation"));
  const readBackNormalization = asArray(applyWorkflow.read_back_normalization, "Jira read-back normalization").map((value) => asString(value, "Jira read-back normalization item"));
  if (applyWorkflow.name !== "jiraman-apply-actions" || JSON.stringify(applyOperations) !== JSON.stringify(["issue.create", "issue.update", "issue.comment"]) || applyWorkflow.default_content_language !== "vi-VN" || applyWorkflow.override_scope !== "single-approved-action" || applyWorkflow.override_authorization_ref !== "#/override_authorization" || applyWorkflow.existing_ticket_mode !== "preserve-human-content" || JSON.stringify(readBackNormalization) !== JSON.stringify(["crlf-to-lf", "object-key-order"]) || applyWorkflow.array_order !== "preserve-exact" || applyWorkflow.unicode !== "preserve-exact" || applyWorkflow.live_writes !== "approved-safe-test-scope-only") violations.push("apply-language-route");
  const fields = asArray(index.acceptance_criterion_fields, "Acceptance Criterion fields").map((value) => asString(value, "Acceptance Criterion field"));
  if (JSON.stringify(fields) !== JSON.stringify(["id", "statement", "verification"])) violations.push("acceptance-fields");
  const issueTypes = templates.map((template) => asString(template.issue_type, "issue type"));
  if (templates.length !== 3 || new Set(issueTypes).size !== 3 || !["Epic", "Story", "Sub-task"].every((issueType) => issueTypes.includes(issueType))) violations.push("issue-types");
  const indexedFiles = templates.map((template) => `${TEMPLATE_DIRECTORY}/${asString(template.file, "template file")}`);
  const templateFiles = walkFiles(TEMPLATE_DIRECTORY).filter((path) => path.endsWith(".md"));
  if (new Set(indexedFiles).size !== 3 || templateFiles.length !== indexedFiles.length || templateFiles.some((path) => !indexedFiles.includes(path))) violations.push("template-index");
  for (const template of templates) {
    const file = asString(template.file, "template file");
    const path = `${TEMPLATE_DIRECTORY}/${file}`;
    const text = readText(path);
    const frontmatter = parseFrontmatter(text);
    const sections = asArray(template.required_sections, "required sections").map((value) => asString(value, "required section"));
    const headings = asObject(template.required_headings ?? null, "required headings");
    if (frontmatter.get("content_language") !== "vi-VN" || frontmatter.get("acceptance_criteria_storage") !== "managed-description-section" || frontmatter.get("literal_preservation_policy") !== ".kilo/config/jiraman.json#/language/preserved_literal_kinds" || frontmatter.get("language_override_scope") !== "jira-draft") violations.push(`${file}:metadata`);
    if (!sections.includes("acceptance-criteria") || new Set(sections).size !== sections.length) violations.push(`${file}:sections`);
    if (Object.keys(headings).length !== sections.length || sections.some((section) => typeof headings[section] !== "string")) violations.push(`${file}:headings`);
    if (markerCount(text, "<!-- JIRAMAN:BEGIN managed-ticket -->") !== 1 || markerCount(text, "<!-- JIRAMAN:END managed-ticket -->") !== 1 || markerCount(text, "<!-- HUMAN:BEGIN notes -->") !== 1 || markerCount(text, "<!-- HUMAN:END notes -->") !== 1) violations.push(`${file}:ownership`);
    for (const section of sections) {
      const begin = `<!-- JIRAMAN:JIRA-SECTION:${section}:BEGIN -->`;
      const end = `<!-- JIRAMAN:JIRA-SECTION:${section}:END -->`;
      const start = text.indexOf(begin) + begin.length;
      const finish = text.indexOf(end, start);
      const content = finish < start ? "" : text.slice(start, finish).trim();
      const expectedHeading = asString(headings[section], `${file}:${section} heading`);
      if (markerCount(text, begin) !== 1 || markerCount(text, end) !== 1 || !/^##\s+\S/m.test(content)) violations.push(`${file}:${section}`);
      if (!content.startsWith(`## ${expectedHeading}\n`)) violations.push(`${file}:${section}:heading`);
      if (section === "acceptance-criteria" && !content.startsWith("## Tiêu chí nghiệm thu\n")) violations.push(`${file}:acceptance-heading`);
    }
  }
  return violations;
}
