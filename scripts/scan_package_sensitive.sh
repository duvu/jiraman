#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -ne 1 ]]; then
  echo "usage: ./scripts/scan_package_sensitive.sh ROOT" >&2
  exit 2
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node --input-type=module - "$SCRIPT_DIR/sensitive-content.mjs" "$1" <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [modulePath, rootArgument] = process.argv.slice(2);
const { findSensitiveNames } = await import(pathToFileURL(modulePath).href);
const root = path.resolve(rootArgument);
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
      for (const name of findSensitiveNames(text)) findings.push(relative + ": " + name);
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
