#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="$ROOT/tests/install/output/clean-project"
SYMLINK_TARGET="$ROOT/tests/install/output/symlink-project"
OUTSIDE="$ROOT/tests/install/output/outside-agents"
RACE_TARGET="$ROOT/tests/install/output/race-project"
RACE_OUTSIDE="$ROOT/tests/install/output/race-outside"
rm -rf "$TARGET" "$SYMLINK_TARGET" "$OUTSIDE" "$RACE_TARGET" "$RACE_OUTSIDE"
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

mkdir -p "$SYMLINK_TARGET/.kilo" "$OUTSIDE"
printf 'OUTSIDE-SENTINEL\n' > "$OUTSIDE/jiraman.md"
cp "$OUTSIDE/jiraman.md" "$SYMLINK_TARGET/sentinel.before"
ln -s "$OUTSIDE" "$SYMLINK_TARGET/.kilo/agents"
if "$ROOT/install.sh" "$SYMLINK_TARGET" --force >"$SYMLINK_TARGET/symlink.out" 2>&1; then echo "expected symlink rejection" >&2; exit 1; fi
grep -q 'unsafe symbolic link' "$SYMLINK_TARGET/symlink.out"
cmp "$SYMLINK_TARGET/sentinel.before" "$OUTSIDE/jiraman.md"

mkdir -p "$RACE_TARGET/.kilo/agents" "$RACE_OUTSIDE"
printf 'OUTSIDE-RACE-SENTINEL\n' > "$RACE_OUTSIDE/jiraman.md"
cp "$RACE_OUTSIDE/jiraman.md" "$RACE_TARGET/sentinel.before"
printf 'old managed file\n' > "$RACE_TARGET/.kilo/agents/jiraman.md"
(
  for _ in $(seq 1 400); do
    rm -rf "$RACE_TARGET/.kilo/agents"
    ln -s "$RACE_OUTSIDE" "$RACE_TARGET/.kilo/agents" 2>/dev/null || true
    rm -f "$RACE_TARGET/.kilo/agents" 2>/dev/null || true
    mkdir -p "$RACE_TARGET/.kilo/agents"
    printf 'old managed file\n' > "$RACE_TARGET/.kilo/agents/jiraman.md"
    sleep 0.001
  done
) &
racer=$!
set +e
"$ROOT/install.sh" "$RACE_TARGET" --force >"$RACE_TARGET/race.out" 2>&1
wait "$racer"
set -e
cmp "$RACE_TARGET/sentinel.before" "$RACE_OUTSIDE/jiraman.md"
echo "clean install: PASS"
