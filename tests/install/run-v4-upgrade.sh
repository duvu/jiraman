#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="$ROOT/tests/install/output/upgraded-project"
rm -rf "$TARGET"
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
echo "v4 upgrade: PASS"
