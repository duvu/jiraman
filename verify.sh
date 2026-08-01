#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE=0
if [[ "${1:-}" == "--source-tree" ]]; then SOURCE=1; ROOT="$SCRIPT_DIR"; else ROOT="${1:-$PWD}"; fi
ROOT="$(cd "$ROOT" && pwd)"
MANIFEST="$SCRIPT_DIR/packaging/managed-files.txt"
failed=0
while IFS= read -r relative; do
  path="$ROOT/$relative"
  if [[ "$SOURCE" -eq 1 ]]; then path="$ROOT/template/$relative"; fi
  if [[ -f "$path" ]]; then echo "OK   $relative"; else echo "MISS $relative"; failed=1; fi
done < "$MANIFEST"

agent="$ROOT/.kilo/agents/jiraman.md"
command="$ROOT/.kilo/commands/jiraman.md"
config_root="$ROOT/.kilo/config"
state="$ROOT/.kilo/state/jiraman.json"
if [[ "$SOURCE" -eq 1 ]]; then
  agent="$ROOT/template/.kilo/agents/jiraman.md"; command="$ROOT/template/.kilo/commands/jiraman.md"; config_root="$ROOT/template/.kilo/config"; state="$ROOT/template/.kilo/state/jiraman.json"
fi
if grep -q '^agent: jiraman$' "$command" && grep -q '^write_mode: exact-apply-only$' "$agent"; then echo "OK   canonical agent routing"; else echo "FAIL canonical agent routing"; failed=1; fi
if grep -q '^project: AIPLATFORM$' "$agent" && grep -q '^mcp_server: mcp-atlassian$' "$agent" && grep -q '^untrusted_content: evidence-only$' "$agent"; then echo "OK   primary safety metadata"; else echo "FAIL primary safety metadata"; failed=1; fi
if ! command -v node >/dev/null 2>&1; then echo "FAIL Node is required for verification tooling"; exit 1; fi
if ! node - "$config_root" "$state" <<'NODE'
const fs=require("fs"), path=require("path");
const [configRoot,statePath]=process.argv.slice(2);
const object=(value)=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const config=JSON.parse(fs.readFileSync(path.join(configRoot,"jiraman.json"),"utf8"));
const router=JSON.parse(fs.readFileSync(path.join(configRoot,"command-router.json"),"utf8"));
const mcp=JSON.parse(fs.readFileSync(path.join(configRoot,"mcp-atlassian.json"),"utf8"));
const state=JSON.parse(fs.readFileSync(statePath,"utf8"));
if(config.schema_version!==5||config.project?.key!=="AIPLATFORM"||!object(config.confluence)||!object(config.delivery)||!object(config.actions)||!object(config.state)) throw new Error("invalid config contract");
if(router.schema_version!==5||router.default_mode!=="daily"||!object(router.canonical)||!object(router.aliases)||router.canonical.apply!=="jiraman-apply-actions") throw new Error("invalid router contract");
if(mcp.schema_version!==5||mcp.server_ownership!=="external-user-owned"||!Array.isArray(mcp.capabilities)||!object(mcp.profiles)||!Array.isArray(mcp.denied)) throw new Error("invalid MCP contract");
const stateKeys=object(state)?Object.keys(state).sort().join(","):"";
if(stateKeys!=="deliverable_candidates,migration,pending_action_groups,project,run_records,schema_version"||state.schema_version!==5||state.project!=="AIPLATFORM"||!object(state.pending_action_groups)||!object(state.deliverable_candidates)||!Array.isArray(state.run_records)||!object(state.migration)||!Array.isArray(state.migration.reapproval_required_ids)) throw new Error("invalid state contract");
NODE
then echo "FAIL JSON contract validation"; failed=1; else echo "OK   JSON contracts"; fi
if ! node - "$ROOT" "$SOURCE" <<'NODE'
const fs=require("fs"), path=require("path");
const [root,source]=process.argv.slice(2);
const prefix=source==="1"?path.join(root,"template"):root;
const index=JSON.parse(fs.readFileSync(path.join(prefix,".kilo/skills/index.json"),"utf8"));
for(const skill of index.skills){if(!fs.existsSync(path.join(prefix,skill.path))) throw new Error(`missing ${skill.path}`)}
NODE
then echo "FAIL broken skill index"; failed=1; else echo "OK   skill references"; fi
if [[ "$SOURCE" -eq 0 ]]; then
  for pattern in ".kilo/state/" ".jiraman-backup-*/"; do if ! grep -qxF "$pattern" "$ROOT/.gitignore"; then echo "FAIL missing gitignore: $pattern"; failed=1; fi; done
  for obsolete in ".kilo/agent/jiraman.md" ".kilo/config/jiraman.yaml" ".kilo/config/jiraman-deliverables.md"; do if [[ -e "$ROOT/$obsolete" ]]; then echo "FAIL obsolete v4 path: $obsolete"; failed=1; fi; done
fi
scan_root="$ROOT/.kilo"
if [[ "$SOURCE" -eq 1 ]]; then scan_root="$ROOT/template/.kilo"; fi
while IFS= read -r path; do
  extension="${path##*.}"
  if [[ "$extension" == "p""y" || "$extension" == "p""yc" ]]; then echo "FAIL application runtime file: $path"; failed=1; fi
done < <(find "$scan_root" -type f -print)
if [[ "$SOURCE" -eq 1 ]]; then
  for executable in install.sh verify.sh scripts/ci.sh scripts/package.sh scripts/verify_package.sh tests/install/run-clean-install.sh tests/install/run-v4-upgrade.sh; do if [[ ! -x "$ROOT/$executable" ]]; then echo "FAIL not executable: $executable"; failed=1; fi; done
fi
if [[ "$failed" -eq 0 ]]; then echo "Jiraman verification: PASS"; fi
exit "$failed"
