#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -ne 1 ]]; then
  echo "usage: ./scripts/scan_package_sensitive.sh ROOT" >&2
  exit 2
fi
node - "$1" <<'NODE'
const fs = require("fs");
const path = require("path");
const root = path.resolve(process.argv[2]);
const patterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["authorization-header", /Authorization:\s*(?:Basic|Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/i],
  ["cookie-header", /(?:Cookie|Set-Cookie):\s*[^\r\n]{8,}/i],
  ["credential-assignment", /\b(?:password|access_token|refresh_token|client_secret)\s*[=:]\s*["']?[^\s"']{8,}/i],
  ["private-atlassian-url", /https:\/\/[A-Za-z0-9.-]+\.atlassian\.net/i],
  ["test-canary", new RegExp(["TEST", "ONLY"].join("_") + "_", "i")],
];
const findings = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute);
    if (entry.isSymbolicLink()) {
      findings.push(relative + ": symbolic-link");
    } else if (entry.isDirectory()) {
      visit(absolute);
    } else if (entry.isFile()) {
      const text = fs.readFileSync(absolute).toString("utf8");
      for (const [name, expression] of patterns) {
        if (expression.test(text)) findings.push(relative + ": " + name);
      }
    }
  }
};
visit(root);
if (findings.length > 0) {
  console.error("sensitive package content found:\n" + findings.join("\n"));
  process.exit(1);
}
console.log("package sensitive-content scan: PASS");
NODE
