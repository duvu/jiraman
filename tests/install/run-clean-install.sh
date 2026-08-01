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

SYMLINK_TARGET="$ROOT/tests/install/output/symlink-project"
OUTSIDE="$ROOT/tests/install/output/outside-agents"
mkdir -p "$SYMLINK_TARGET/.kilo" "$OUTSIDE"
printf 'OUTSIDE-SENTINEL\n' > "$OUTSIDE/jiraman.md"
cp "$OUTSIDE/jiraman.md" "$SYMLINK_TARGET/sentinel.before"
ln -s "$OUTSIDE" "$SYMLINK_TARGET/.kilo/agents"
if "$ROOT/install.sh" "$SYMLINK_TARGET" --force >"$SYMLINK_TARGET/symlink.out" 2>&1; then echo "expected symlink rejection" >&2; exit 1; fi
grep -q 'unsafe symbolic link' "$SYMLINK_TARGET/symlink.out"
cmp "$SYMLINK_TARGET/sentinel.before" "$OUTSIDE/jiraman.md"
echo "clean install: PASS"
