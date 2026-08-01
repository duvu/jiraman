import { readText } from "./contracts.js";

export const REQUIRED_RELEASE_GATES = ["architecture", "schemas", "skills", "aliases", "migration", "fixtures", "security", "reproducibility", "package-verification", "manual-smoke", "rollback"] as const;

export function checklistGates(text: string): string[] {
  return [...text.matchAll(/<!--\s*gate:([a-z-]+)\s*-->/g)].map((match) => match[1]).filter((value): value is string => value !== undefined);
}

export function missingChecklistGates(path = "docs/release-checklist.md"): string[] {
  const present = new Set(checklistGates(readText(path)));
  return REQUIRED_RELEASE_GATES.filter((gate) => !present.has(gate));
}
