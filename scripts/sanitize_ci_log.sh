#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -ne 2 ]]; then
  echo "usage: ./scripts/sanitize_ci_log.sh INPUT OUTPUT" >&2
  exit 2
fi
node - "$1" "$2" <<'NODE'
const fs = require("fs");
const [input, output] = process.argv.slice(2);
if (input === output) {
  console.error("input and output must differ");
  process.exit(2);
}
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /Authorization:\s*(?:Basic|Bearer)\s+\S{8,}/i,
  /(?:Cookie|Set-Cookie):\s*\S.{6,}/i,
  /\b(?:password|access_token|refresh_token|client_secret)\s*[=:]\s*["']?\S{8,}/i,
  /https:\/\/[A-Za-z0-9.-]+\.atlassian\.net/i,
  new RegExp(["TEST", "ONLY"].join("_") + "_", "i"),
];
const sanitized = fs.readFileSync(input, "utf8")
  .split(/\r?\n/)
  .map((line) => patterns.some((pattern) => pattern.test(line)) ? "[REDACTED SENSITIVE LINE]" : line)
  .join("\n");
fs.writeFileSync(output, sanitized);
NODE
