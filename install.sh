#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./install.sh [PROJECT_ROOT] [--force]

Installs the project-local Jiraman v3 agent, command, policy, state, and
specification templates. It does NOT install or modify MCP configuration.

Options:
  --force   Back up existing managed Jiraman files, then replace them.
USAGE
}

ROOT="${PWD}"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) ROOT="$arg" ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/template"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

managed=(
  ".kilo/commands/jiraman.md"
  ".kilo/agent/jiraman.md"
  ".kilo/config/jiraman.yaml"
  ".kilo/state/jiraman.json"
  "docs/project-management/templates/epic-spec.md"
  "docs/project-management/templates/story-spec.md"
  "docs/project-management/templates/subtask-spec.md"
  "docs/project-management/templates/hierarchy-policy.md"
)

for rel in "${managed[@]}"; do
  target="$ROOT/$rel"
  if [[ -e "$target" && "$FORCE" -ne 1 ]]; then
    echo "Refusing to overwrite existing managed file: $target" >&2
    echo "Re-run with --force to back up and replace all managed Jiraman files." >&2
    exit 1
  fi
done

if [[ "$FORCE" -eq 1 ]]; then
  backup="$ROOT/.jiraman-backup-$TIMESTAMP"
  mkdir -p "$backup"
  copied=0
  for rel in "${managed[@]}"; do
    if [[ -e "$ROOT/$rel" ]]; then
      mkdir -p "$backup/$(dirname "$rel")"
      cp -a "$ROOT/$rel" "$backup/$rel"
      copied=1
    fi
  done
  if [[ "$copied" -eq 1 ]]; then
    echo "Existing managed Jiraman files backed up to: $backup"
  else
    rmdir "$backup" 2>/dev/null || true
  fi
fi

mkdir -p \
  "$ROOT/.kilo/commands" \
  "$ROOT/.kilo/agent" \
  "$ROOT/.kilo/config" \
  "$ROOT/.kilo/state" \
  "$ROOT/docs/project-management/daily" \
  "$ROOT/docs/project-management/weekly-reports" \
  "$ROOT/docs/project-management/sprint-reviews" \
  "$ROOT/docs/project-management/templates"

for rel in "${managed[@]}"; do
  mkdir -p "$ROOT/$(dirname "$rel")"
  cp "$TEMPLATE/$rel" "$ROOT/$rel"
done

for rel in \
  "docs/project-management/risk-register.md" \
  "docs/project-management/decision-log.md" \
  "docs/project-management/daily/.gitkeep" \
  "docs/project-management/weekly-reports/.gitkeep" \
  "docs/project-management/sprint-reviews/.gitkeep"; do
  if [[ ! -e "$ROOT/$rel" ]]; then
    mkdir -p "$ROOT/$(dirname "$rel")"
    cp "$TEMPLATE/$rel" "$ROOT/$rel"
  fi
done

GITIGNORE="$ROOT/.gitignore"
touch "$GITIGNORE"
if ! grep -qxF '.kilo/state/' "$GITIGNORE"; then
  printf '\n# Jiraman operational state\n.kilo/state/\n' >> "$GITIGNORE"
fi

cat <<EOF2
Installed Jiraman v3 into: $ROOT

Managed files:
  .kilo/commands/jiraman.md
  .kilo/agent/jiraman.md
  .kilo/config/jiraman.yaml
  .kilo/state/jiraman.json
  docs/project-management/templates/*.md

MCP configuration was not changed.
Start a new Kilo chat, verify the existing mcp-atlassian server is enabled, then run:
  /jiraman hierarchy
  /jiraman runway
  /jiraman refine AIPLATFORM-<STORY>
EOF2
