#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./install.sh [PROJECT_ROOT] [--force|--check]

  --force  Back up every existing v4/v5 managed file, then migrate and replace.
  --check  Make no changes; verify an existing installation.

Exit codes: 0 success, 1 conflict/verification failure, 2 invalid arguments.
The installer never changes MCP configuration or installs packages in the target.
USAGE
}

ROOT="${PWD}"
FORCE=0
CHECK=0
POSITIONAL=0
for argument in "$@"; do
  case "$argument" in
    --force) FORCE=1 ;;
    --check) CHECK=1 ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $argument" >&2; usage >&2; exit 2 ;;
    *)
      if [[ "$POSITIONAL" -eq 1 ]]; then echo "Only one PROJECT_ROOT is allowed" >&2; exit 2; fi
      ROOT="$argument"
      POSITIONAL=1
      ;;
  esac
done
if [[ "$FORCE" -eq 1 && "$CHECK" -eq 1 ]]; then echo "--force and --check are mutually exclusive" >&2; exit 2; fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$CHECK" -eq 1 ]]; then exec "$SCRIPT_DIR/verify.sh" "$ROOT"; fi
mkdir -p "$ROOT"
ROOT="$(cd "$ROOT" && pwd)"
TEMPLATE="$SCRIPT_DIR/template"
MANIFEST="$SCRIPT_DIR/packaging/managed-files.txt"
mapfile -t managed < "$MANIFEST"
legacy=(
  ".kilo/agent/jiraman.md"
  ".kilo/config/jiraman.yaml"
  ".kilo/config/jiraman-deliverables.md"
)

reject_symlink_path() {
  local relative="$1"
  local current="$ROOT"
  local component
  IFS='/' read -r -a components <<< "$relative"
  for component in "${components[@]}"; do
    current="$current/$component"
    if [[ -L "$current" ]]; then
      echo "Refusing unsafe symbolic link in managed path: $current" >&2
      exit 1
    fi
  done
}

for relative in "${managed[@]}" "${legacy[@]}"; do
  reject_symlink_path "$relative"
done

preserve_v5_state=0
migrate_v4_state=0
if [[ -f "$ROOT/.kilo/state/jiraman.json" ]]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "Existing state requires Node verification tooling before installation." >&2
    exit 1
  fi
  set +e
  "$SCRIPT_DIR/verify.sh" --validate-state-file "$ROOT/.kilo/state/jiraman.json" >/dev/null
  state_status=$?
  set -e
  case "$state_status" in
    0) preserve_v5_state=1 ;;
    3) migrate_v4_state=1 ;;
    4) echo "Existing state is not valid JSON; installation stopped before backup or mutation." >&2; exit 1 ;;
    5) echo "Existing v5 state fails the full state schema; installation stopped before backup or mutation." >&2; exit 1 ;;
    *) echo "Existing state validation failed; installation stopped before backup or mutation." >&2; exit 1 ;;
  esac
fi

existing=()
declare -A seen=()
for relative in "${managed[@]}" "${legacy[@]}"; do
  if [[ -e "$ROOT/$relative" && -z "${seen[$relative]:-}" ]]; then
    existing+=("$relative")
    seen[$relative]=1
  fi
done
if [[ "${#existing[@]}" -gt 0 && "$FORCE" -ne 1 ]]; then
  echo "Refusing to overwrite managed Jiraman files:" >&2
  printf '  %s\n' "${existing[@]}" | LC_ALL=C sort >&2
  echo "Re-run with --force to create a complete backup first." >&2
  exit 1
fi

backup=""
if [[ "${#existing[@]}" -gt 0 ]]; then
  timestamp="$(date +%Y%m%d-%H%M%S)"
  backup="$ROOT/.jiraman-backup-$timestamp"
  mkdir -p "$backup"
  for relative in "${existing[@]}"; do
    mkdir -p "$backup/$(dirname "$relative")"
    cp -a "$ROOT/$relative" "$backup/$relative"
  done
  echo "Existing managed files backed up to: $backup"
fi

for relative in "${managed[@]}"; do
  if [[ "$relative" == ".kilo/state/jiraman.json" && "$preserve_v5_state" -eq 1 ]]; then continue; fi
  mkdir -p "$ROOT/$(dirname "$relative")"
  cp "$TEMPLATE/$relative" "$ROOT/$relative"
done

if [[ "$migrate_v4_state" -eq 1 ]]; then
  old_state="$backup/.kilo/state/jiraman.json"
  preserved="$ROOT/.kilo/state/jiraman.v4.json"
  cp "$old_state" "$preserved"
  node - "$old_state" "$ROOT/.kilo/state/jiraman.json" <<'NODE'
const fs = require("fs");
const [oldPath, newPath] = process.argv.slice(2);
const oldText = fs.readFileSync(oldPath, "utf8");
JSON.parse(oldText);
const ids = [...new Set(oldText.match(/PM[AG]-[0-9]{8}-[0-9]{2}/g) ?? [])].sort();
const state = JSON.parse(fs.readFileSync(newPath, "utf8"));
state.migration.legacy_state_file = ".kilo/state/jiraman.v4.json";
state.migration.reapproval_required_ids = ids;
fs.writeFileSync(newPath, `${JSON.stringify(state, null, 2)}\n`);
NODE
fi

for relative in "${legacy[@]}"; do
  if [[ -e "$ROOT/$relative" ]]; then rm -f "$ROOT/$relative"; fi
done
rmdir "$ROOT/.kilo/agent" 2>/dev/null || true

touch "$ROOT/.gitignore"
for pattern in ".kilo/state/" ".jiraman-backup-*/"; do
  if ! grep -qxF "$pattern" "$ROOT/.gitignore"; then printf '\n%s\n' "$pattern" >> "$ROOT/.gitignore"; fi
done
cat <<SUMMARY
Installed Jiraman v5 into: $ROOT
Primary agent: .kilo/agents/jiraman.md
Skills: .kilo/skills/
Configuration: .kilo/config/jiraman.json
Operational state: .kilo/state/jiraman.json (gitignored)
MCP configuration was not changed and no target packages were installed.
Run: $SCRIPT_DIR/verify.sh "$ROOT"
SUMMARY
