import { asObject, readJson, validateJson } from "./contracts.js";
import { goalPackageSetViolations } from "./goal-rules.js";

export function goalPackageFixtureViolations(): string[] {
  const backlog = asObject(asObject(readJson("tests/fixtures/drafts/backlog.json"), "backlog fixture").data ?? null, "backlog");
  const packagePaths = ["tests/fixtures/drafts/subtasks.json", "tests/fixtures/drafts/subtasks.story-2.json"] as const;
  const packages = packagePaths.map((path) => asObject(asObject(readJson(path), path).data ?? null, `${path} data`));
  const violations = goalPackageSetViolations(backlog, packages);
  for (const [index, packageValue] of packages.entries()) {
    const result = validateJson("subtask-draft.schema.json", packageValue);
    if (!result.valid) violations.push(`${packagePaths[index]}:schema`);
  }
  return violations;
}
