import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { findSensitiveNames } from "../scripts/sensitive-content.mjs";
import { invariant, readText, walkFiles } from "./contracts.js";

const roots = ["template", "tests/fixtures", "examples", "docs"] as const;
const rootFiles = ["README.md", "UPGRADE.md", "CHANGELOG.md"] as const;
export function findSensitiveValues(text: string): string[] {
  return findSensitiveNames(text);
}

export function scanSensitiveRoots(): string[] {
  const findings: string[] = [];
  for (const root of roots) {
    for (const path of walkFiles(root).filter((item) => !item.endsWith(".gitkeep"))) {
      for (const finding of findSensitiveValues(readText(path))) findings.push(`${path}: ${finding}`);
    }
  }
  for (const path of rootFiles) for (const finding of findSensitiveValues(readText(path))) findings.push(`${path}: ${finding}`);
  return findings;
}

const entry = process.argv[1];
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) {
  const findings = scanSensitiveRoots();
  invariant(findings.length === 0, `sensitive values found:\n${findings.join("\n")}`);
  console.log("secret scan: PASS");
}
