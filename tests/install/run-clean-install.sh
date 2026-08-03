#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="$ROOT/tests/install/output/clean-project"
SYMLINK_TARGET="$ROOT/tests/install/output/symlink-project"
OUTSIDE="$ROOT/tests/install/output/outside-agents"
RACE_TARGET="$ROOT/tests/install/output/race-project"
RACE_OUTSIDE="$ROOT/tests/install/output/race-outside"
PERMISSION_ROOT="$ROOT/tests/install/output/permission-project"
rm -rf "$TARGET" "$SYMLINK_TARGET" "$OUTSIDE" "$RACE_TARGET" "$RACE_OUTSIDE" "$PERMISSION_ROOT"-*
mkdir -p "$TARGET/.kilo"
printf '%s\n' '{"servers":{"mcp-atlassian":{"command":"USER-OWNED-SENTINEL"}}}' > "$TARGET/.kilo/mcp.json"
cp "$TARGET/.kilo/mcp.json" "$TARGET/mcp.before"
"$ROOT/install.sh" "$TARGET" >/dev/null
"$ROOT/verify.sh" "$TARGET" >/dev/null
for relative in \
  "docs/project-management/templates/jira/index.json" \
  "docs/project-management/templates/jira/epic.md" \
  "docs/project-management/templates/jira/goal-story.md" \
  "docs/project-management/templates/jira/sub-task.md"; do
  [[ -f "$TARGET/$relative" ]] || { echo "missing installed Jira template: $relative" >&2; exit 1; }
done
grep -q '## Tiêu chí nghiệm thu' "$TARGET/docs/project-management/templates/jira/epic.md"
grep -q '## Tiêu chí nghiệm thu' "$TARGET/docs/project-management/templates/jira/goal-story.md"
grep -q '## Tiêu chí nghiệm thu' "$TARGET/docs/project-management/templates/jira/sub-task.md"
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
RACE_BIN="$RACE_TARGET/test-bin"
RACE_SIGNAL="$RACE_TARGET/snapshot-complete"
RACE_CONTINUE="$RACE_TARGET/continue-install"
mkdir -p "$RACE_BIN"
cat > "$RACE_BIN/cp" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"/template/.kilo/agents/jiraman.md"* ]]; then
  : > "$RACE_SIGNAL"
  while [[ ! -e "$RACE_CONTINUE" ]]; do sleep 0.01; done
fi
exec "$REAL_CP" "$@"
WRAPPER
chmod +x "$RACE_BIN/cp"
REAL_CP="$(command -v cp)" RACE_SIGNAL="$RACE_SIGNAL" RACE_CONTINUE="$RACE_CONTINUE" PATH="$RACE_BIN:$PATH" \
  "$ROOT/install.sh" "$RACE_TARGET" --force >"$RACE_TARGET/race.out" 2>&1 &
installer=$!
for _ in $(seq 1 500); do
  if [[ -e "$RACE_SIGNAL" ]]; then break; fi
  if ! kill -0 "$installer" 2>/dev/null; then wait "$installer"; exit 1; fi
  sleep 0.01
done
[[ -e "$RACE_SIGNAL" ]] || { echo "installer did not reach synchronized snapshot boundary" >&2; exit 1; }
mv -T "$RACE_TARGET/.kilo/agents" "$RACE_TARGET/agents.snapshot"
ln -s "$RACE_OUTSIDE" "$RACE_TARGET/.kilo/agents"
: > "$RACE_CONTINUE"
wait "$installer"
cmp "$RACE_TARGET/sentinel.before" "$RACE_OUTSIDE/jiraman.md"
"$ROOT/verify.sh" "$RACE_TARGET" >/dev/null

for mask in 000 0600 0700; do
  permission_target="$PERMISSION_ROOT-$mask"
  (umask "$mask"; "$ROOT/install.sh" "$permission_target" >/dev/null)
  [[ "$(stat -c '%a' "$permission_target/.kilo/state")" == "700" ]]
  [[ "$(stat -c '%a' "$permission_target/.kilo/state/jiraman.json")" == "600" ]]
  kilo_mode="$(stat -c '%a' "$permission_target/.kilo")"
  (( (8#$kilo_mode & 022) == 0 ))
done
echo "clean install: PASS"
