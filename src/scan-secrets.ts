import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { invariant, readText, walkFiles } from "./contracts.js";

const roots = ["template", "tests/fixtures", "examples", "docs"] as const;
const rootFiles = ["README.md", "UPGRADE.md", "CHANGELOG.md"] as const;
const patterns = [
  { name: "private-key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "aws-access-key", expression: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "authorization-header", expression: /Authorization:\s*(?:Basic|Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/i },
  { name: "cookie-header", expression: /(?:Cookie|Set-Cookie):\s*[^\r\n]{8,}/i },
  { name: "credential-assignment", expression: /\b(?:password|access_token|refresh_token|client_secret)\s*[=:]\s*["']?[^\s"']{8,}/i },
  { name: "private-atlassian-url", expression: /https:\/\/[A-Za-z0-9.-]+\.atlassian\.net/i },
] as const;

export function findSensitiveValues(text: string): string[] {
  return patterns.filter((pattern) => pattern.expression.test(text)).map((pattern) => pattern.name);
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
