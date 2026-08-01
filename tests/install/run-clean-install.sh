#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="$ROOT/tests/install/output/clean-project"
rm -rf "$TARGET"
mkdir -p "$TARGET/.kilo"
printf '%s\n' '{"servers":{"mcp-atlassian":{"command":"USER-OWNED-SENTINEL"}}}' > "$TARGET/.kilo/mcp.json"
cp "$TARGET/.kilo/mcp.json" "$TARGET/mcp.before"
"$ROOT/install.sh" "$TARGET" >/dev/null
"$ROOT/verify.sh" "$TARGET" >/dev/null
"$ROOT/install.sh" "$TARGET" --check >/dev/null
cmp "$TARGET/mcp.before" "$TARGET/.kilo/mcp.json"
if "$ROOT/install.sh" "$TARGET" >"$TARGET/reinstall.out" 2>&1; then echo "expected conflict refusal" >&2; exit 1; fi
grep -q '.kilo/agents/jiraman.md' "$TARGET/reinstall.out"
find "$TARGET/.kilo" -type f | while read -r path; do extension="${path##*.}"; [[ "$extension" != "p""y" ]]; done
echo "clean install: PASS"
