#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_ROOT="$(mktemp -d)"
trap 'rm -rf "$OUTPUT_ROOT"' EXIT
TARGET="$OUTPUT_ROOT/upgraded-project"
SPOOFED="$OUTPUT_ROOT/spoofed-v5-project"
INVALID="$OUTPUT_ROOT/invalid-v5-project"
MALFORMED="$OUTPUT_ROOT/malformed-v5-project"
INTEGRITY="$OUTPUT_ROOT/state-integrity"
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
node - "$ROOT" "$INVALID/.kilo/state/jiraman.json" <<'NODE'
const fs=require("fs"),path=require("path");
const [root,output]=process.argv.slice(2);
const group=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/actions/valid.json"),"utf8"));
const state={schema_version:5,project:"AIPLATFORM",pending_action_groups:{[group.id]:group},deliverable_candidates:{},run_records:[],migration:{legacy_state_file:null,reapproval_required_ids:[]}};
state.pending_action_groups["PMG-20260801-99"]={bad:true};
fs.writeFileSync(output,`${JSON.stringify(state,null,2)}\n`);
NODE
cp "$INVALID/.kilo/state/jiraman.json" "$INVALID/state.before"
if "$ROOT/install.sh" "$INVALID" --force >"$INVALID/invalid-state.out" 2>&1; then echo "expected invalid v5 state rejection" >&2; exit 1; fi
grep -q 'full state schema' "$INVALID/invalid-state.out"
cmp "$INVALID/state.before" "$INVALID/.kilo/state/jiraman.json"
if find "$INVALID" -maxdepth 1 -type d -name '.jiraman-backup-*' -print -quit | grep -q .; then echo "invalid v5 state was backed up or mutated" >&2; exit 1; fi
if "$ROOT/verify.sh" "$INVALID" >/dev/null 2>&1; then echo "expected verifier rejection for invalid v5 state" >&2; exit 1; fi

mkdir -p "$MALFORMED/.kilo/state"
printf '%s\n' '{"schema_version":5,"project":"AIPLATFORM","pending_action_groups":{}}' > "$MALFORMED/.kilo/state/jiraman.json"
cp "$MALFORMED/.kilo/state/jiraman.json" "$MALFORMED/state.before"
if "$ROOT/install.sh" "$MALFORMED" --force >"$MALFORMED/malformed-state.out" 2>&1; then echo "expected malformed v5 state rejection" >&2; exit 1; fi
grep -q 'full state schema' "$MALFORMED/malformed-state.out"
cmp "$MALFORMED/state.before" "$MALFORMED/.kilo/state/jiraman.json"
if find "$MALFORMED" -maxdepth 1 -type d -name '.jiraman-backup-*' -print -quit | grep -q .; then echo "malformed v5 state was backed up or mutated" >&2; exit 1; fi

mkdir -p "$INTEGRITY"
node - "$ROOT" "$INTEGRITY" <<'NODE'
const fs = require("fs"), path = require("path");
const [root, directory] = process.argv.slice(2);
const group = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/actions/high-risk-approved.json"), "utf8"));
const proposedGroup = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/actions/valid.json"), "utf8"));
const state = {schema_version: 5, project: "AIPLATFORM", pending_action_groups: {[group.id]: group}, deliverable_candidates: {}, run_records: [], migration: {legacy_state_file: null, reapproval_required_ids: []}};
fs.writeFileSync(path.join(directory, "valid.json"), JSON.stringify(state));
state.pending_action_groups = {"PMG-20260801-99": group};
fs.writeFileSync(path.join(directory, "wrong-map-key.json"), JSON.stringify(state));
state.pending_action_groups = {[group.id]: group};
group.approval.approved_action_ids = ["PMA-20260801-99"];
fs.writeFileSync(path.join(directory, "wrong-approved-id.json"), JSON.stringify(state));
group.approval.approved_action_ids = [group.actions[0].id];
group.approval.payload_hash = "0".repeat(64);
fs.writeFileSync(path.join(directory, "wrong-approval-hash.json"), JSON.stringify(state));
group.approval.payload_hash = group.payload_hash;
group.payload_hash = "1".repeat(64);
fs.writeFileSync(path.join(directory, "wrong-payload-hash.json"), JSON.stringify(state));
proposedGroup.actions[0].status = "applied";
state.pending_action_groups = {[proposedGroup.id]: proposedGroup};
fs.writeFileSync(path.join(directory, "wrong-lifecycle.json"), JSON.stringify(state));
NODE
"$ROOT/verify.sh" --validate-state-file "$INTEGRITY/valid.json"
for state in wrong-map-key wrong-approved-id wrong-approval-hash wrong-payload-hash wrong-lifecycle; do
  set +e
  "$ROOT/verify.sh" --validate-state-file "$INTEGRITY/$state.json"
  status=$?
  set -e
  [[ "$status" -eq 5 ]] || { echo "expected integrity rejection for $state" >&2; exit 1; }
done
echo "v4 upgrade: PASS"
