import { invariant, readText, walkFiles } from "./contracts.js";

const roots = ["template", "tests/fixtures", "examples", "docs"] as const;
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /Authorization:\s*(?:Basic|Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\b(?:password|access_token|refresh_token|client_secret)\s*[=:]\s*["']?[^\s"']{8,}/i,
  /https:\/\/[A-Za-z0-9.-]+\.atlassian\.net/i,
] as const;
const findings: string[] = [];
for (const root of roots) {
  for (const path of walkFiles(root).filter((item) => !item.endsWith(".gitkeep"))) {
    const text = readText(path);
    for (const pattern of patterns) {
      if (pattern.test(text)) findings.push(`${path}: ${pattern.source}`);
    }
  }
}
invariant(findings.length === 0, `sensitive values found:\n${findings.join("\n")}`);
console.log("secret scan: PASS");
