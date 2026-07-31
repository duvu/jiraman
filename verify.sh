#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
ROOT="$(cd "$ROOT" && pwd)"

files=(
  ".kilo/commands/jiraman.md"
  ".kilo/agent/jiraman.md"
  ".kilo/config/jiraman.yaml"
  ".kilo/state/jiraman.json"
  "docs/project-management/templates/epic-spec.md"
  "docs/project-management/templates/story-spec.md"
  "docs/project-management/templates/subtask-spec.md"
  "docs/project-management/templates/hierarchy-policy.md"
  "docs/project-management/risk-register.md"
  "docs/project-management/decision-log.md"
)

failed=0
for rel in "${files[@]}"; do
  if [[ -f "$ROOT/$rel" ]]; then
    echo "OK   $rel"
  else
    echo "MISS $rel"
    failed=1
  fi
done

if grep -qxF '.kilo/state/' "$ROOT/.gitignore" 2>/dev/null; then
  echo "OK   .kilo/state/ is gitignored"
else
  echo "WARN .kilo/state/ is not gitignored"
fi

if grep -q 'agent: jiraman' "$ROOT/.kilo/commands/jiraman.md" 2>/dev/null; then
  echo "OK   slash command routes to jiraman"
else
  echo "FAIL slash command does not route to jiraman"
  failed=1
fi

if grep -q 'Epic -> Story -> Sub-task' "$ROOT/.kilo/agent/jiraman.md" 2>/dev/null; then
  echo "OK   strict three-level hierarchy policy is present"
else
  echo "FAIL hierarchy policy is missing from the agent"
  failed=1
fi

if grep -q 'maximum_original_estimate_hours: 4' "$ROOT/.kilo/config/jiraman.yaml" 2>/dev/null; then
  echo "OK   four-hour Sub-task maximum is configured"
else
  echo "FAIL four-hour Sub-task maximum is not configured"
  failed=1
fi

if grep -q 'count_only_ready_stories: true' "$ROOT/.kilo/config/jiraman.yaml" 2>/dev/null; then
  echo "OK   ready runway counts Stories only"
else
  echo "FAIL Story-only ready-runway policy is missing"
  failed=1
fi

if command -v python3 >/dev/null 2>&1; then
  if python3 - "$ROOT" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
with (root / '.kilo/state/jiraman.json').open(encoding='utf-8') as fh:
    state = json.load(fh)
assert state['schema_version'] == 3
print('OK   state JSON validation passed')

try:
    import yaml
except ModuleNotFoundError:
    print('WARN PyYAML is not installed; skipped semantic YAML validation')
else:
    with (root / '.kilo/config/jiraman.yaml').open(encoding='utf-8') as fh:
        config = yaml.safe_load(fh)
    assert config['version'] == 3
    assert config['issue_hierarchy']['allow_other_issue_types'] is False
    assert config['issue_hierarchy']['execution_level'] == 'subtask'
    assert config['spec_driven_delivery']['subtask_spec']['maximum_original_estimate_hours'] == 4
    assert config['spec_driven_delivery']['subtask_spec']['maximum_actual_focused_time_hours'] == 4
    assert config['sprint_management']['ready_horizon_sprints'] == 2
    assert config['sprint_management']['ready_runway']['count_only_ready_stories'] is True
    print('OK   YAML policy validation passed')
PY
  then
    :
  else
    echo "FAIL JSON/YAML policy validation failed"
    failed=1
  fi
else
  echo "WARN python3 not found; skipped JSON/YAML validation"
fi

exit "$failed"
