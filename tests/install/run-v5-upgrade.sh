#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_ROOT="$(mktemp -d)"
trap 'rm -rf "$OUTPUT_ROOT"' EXIT
TARGET="$OUTPUT_ROOT/v5-project"
mkdir -p "$TARGET"
"$ROOT/install.sh" "$TARGET" >/dev/null
node - "$ROOT" "$TARGET/.kilo/state/jiraman.json" <<'NODE'
const fs = require("fs"), path = require("path");
const [root, output] = process.argv.slice(2);
const group = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/actions/valid.json"), "utf8"));
const legacy = {
  schema_version: 5,
  project: "AIPLATFORM",
  pending_action_groups: {[group.id]: group},
  deliverable_candidates: {},
  run_records: [],
  migration: {legacy_state_file: null, reapproval_required_ids: []},
};
fs.writeFileSync(output, JSON.stringify(legacy, null, 2) + "\n");
NODE
"$ROOT/install.sh" "$TARGET" --force >/dev/null
"$ROOT/verify.sh" "$TARGET" >/dev/null
test -f "$TARGET/.kilo/state/jiraman.v5.json"
test "$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).schema_version' "$TARGET/.kilo/state/jiraman.json")" = 6
grep -q 'aiplatform' "$TARGET/.kilo/state/jiraman.json"
grep -q 'PMG-20260801-01' "$TARGET/.kilo/state/jiraman.json"
grep -q 'PMA-20260801-01' "$TARGET/.kilo/state/jiraman.json"
grep -q 'reapproval_required_ids' "$TARGET/.kilo/state/jiraman.json"
if grep -q '"schema_version": 5' "$TARGET/.kilo/state/jiraman.json"; then echo "v5 state was not migrated" >&2; exit 1; fi
echo "v5 upgrade: PASS"
