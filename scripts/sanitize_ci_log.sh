#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -ne 2 ]]; then
  echo "usage: ./scripts/sanitize_ci_log.sh INPUT OUTPUT" >&2
  exit 2
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node --input-type=module - "$SCRIPT_DIR/sensitive-content.mjs" "$1" "$2" <<'NODE'
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const [modulePath, input, output] = process.argv.slice(2);
if (input === output) {
  console.error("input and output must differ");
  process.exit(2);
}
const { sanitizeSensitiveText } = await import(pathToFileURL(modulePath).href);
fs.writeFileSync(output, sanitizeSensitiveText(fs.readFileSync(input, "utf8")));
NODE
