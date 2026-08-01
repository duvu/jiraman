#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="$ROOT/tests/install/output/upgraded-project"
SPOOFED="$ROOT/tests/install/output/spoofed-v5-project"
INVALID="$ROOT/tests/install/output/invalid-v5-project"
rm -rf "$TARGET" "$SPOOFED" "$INVALID"
mkdir -p "$TARGET"
cp -a "$ROOT/tests/install/fixtures/v4-project/." "$TARGET/"
cp "$TARGET/.kilo/mcp.json" "$TARGET/mcp.before"
cp "$TARGET/.kilo/state/jiraman.json" "$TARGET/state.before"
"$ROOT/install.sh" "$TARGET" --force >/dev/null
"$ROOT/verify.sh" "$TARGET" >/dev/null
cmp "$TARGET/mcp.before" "$TARGET/.kilo/mcp.json"
cmp "$TARGET/state.before" "$TARGET/.kilo/state/jiraman.v4.json"
grep -q 'PMA-20260731-01' "$TARGET/.kilo/state/jiraman.json"
grep -q 'PMG-20260731-01' "$TARGET/.kilo/state/jiraman.json"
grep -q 'reapproval_required_ids' "$TARGET/.kilo/state/jiraman.json"
backup="$(find "$TARGET" -maxdepth 1 -type d -name '.jiraman-backup-*' | head -1)"
test -n "$backup"
cmp "$TARGET/state.before" "$backup/.kilo/state/jiraman.json"
test ! -e "$TARGET/.kilo/agent/jiraman.md"
test ! -e "$TARGET/.kilo/config/jiraman.yaml"

mkdir -p "$SPOOFED"
cp -a "$ROOT/tests/install/fixtures/v4-project/." "$SPOOFED/"
node - "$SPOOFED/.kilo/state/jiraman.json" <<'NODE'
const fs=require("fs"),path=process.argv[2];
const state=JSON.parse(fs.readFileSync(path,"utf8"));
state.schema_version=5;
fs.writeFileSync(path,`${JSON.stringify(state,null,2)}\n`);
NODE
"$ROOT/install.sh" "$SPOOFED" --force >/dev/null
"$ROOT/verify.sh" "$SPOOFED" >/dev/null
grep -q 'PMA-20260731-01' "$SPOOFED/.kilo/state/jiraman.json"
grep -q 'reapproval_required_ids' "$SPOOFED/.kilo/state/jiraman.json"
if grep -q 'pending_actions' "$SPOOFED/.kilo/state/jiraman.json"; then echo "legacy state was incorrectly preserved" >&2; exit 1; fi

mkdir -p "$INVALID"
"$ROOT/install.sh" "$INVALID" >/dev/null
node - "$INVALID/.kilo/state/jiraman.json" <<'NODE'
const fs=require("fs"),path=process.argv[2];
const state=JSON.parse(fs.readFileSync(path,"utf8"));
state.pending_action_groups["PMG-20260801-99"]={bad:true};
fs.writeFileSync(path,`${JSON.stringify(state,null,2)}\n`);
NODE
cp "$INVALID/.kilo/state/jiraman.json" "$INVALID/state.before"
if "$ROOT/install.sh" "$INVALID" --force >"$INVALID/invalid-state.out" 2>&1; then echo "expected invalid v5 state rejection" >&2; exit 1; fi
grep -q 'full state schema' "$INVALID/invalid-state.out"
cmp "$INVALID/state.before" "$INVALID/.kilo/state/jiraman.json"
if find "$INVALID" -maxdepth 1 -type d -name '.jiraman-backup-*' -print -quit | grep -q .; then echo "invalid v5 state was backed up or mutated" >&2; exit 1; fi
if "$ROOT/verify.sh" "$INVALID" >/dev/null 2>&1; then echo "expected verifier rejection for invalid v5 state" >&2; exit 1; fi
echo "v4 upgrade: PASS"
