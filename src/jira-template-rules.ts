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
    if (frontmatter.get("content_language") !== "vi-VN" || frontmatter.get("acceptance_criteria_storage") !== "managed-description-section") violations.push(`${file}:metadata`);
    if (!sections.includes("acceptance-criteria") || new Set(sections).size !== sections.length) violations.push(`${file}:sections`);
    if (markerCount(text, "<!-- JIRAMAN:BEGIN managed-ticket -->") !== 1 || markerCount(text, "<!-- JIRAMAN:END managed-ticket -->") !== 1 || markerCount(text, "<!-- HUMAN:BEGIN notes -->") !== 1 || markerCount(text, "<!-- HUMAN:END notes -->") !== 1) violations.push(`${file}:ownership`);
    for (const section of sections) {
      const begin = `<!-- JIRAMAN:JIRA-SECTION:${section}:BEGIN -->`;
      const end = `<!-- JIRAMAN:JIRA-SECTION:${section}:END -->`;
      const start = text.indexOf(begin) + begin.length;
      const finish = text.indexOf(end, start);
      const content = finish < start ? "" : text.slice(start, finish).trim();
      if (markerCount(text, begin) !== 1 || markerCount(text, end) !== 1 || !/^##\s+\S/m.test(content)) violations.push(`${file}:${section}`);
      if (section === "acceptance-criteria" && !content.startsWith("## Tiêu chí nghiệm thu\n")) violations.push(`${file}:acceptance-heading`);
    }
  }
  return violations;
}
