#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--run-invariant" ]]; then
  if [[ "$#" -lt 3 ]]; then
    echo "usage: ./scripts/ci.sh --run-invariant INVARIANT COMMAND [ARG ...]" >&2
    exit 2
  fi
  invariant="$2"
  shift 2
  if ! node --input-type=module - "$ROOT/scripts/sensitive-content.mjs" "$invariant" <<'NODE'
import { pathToFileURL } from "node:url";
const [modulePath, invariant] = process.argv.slice(2);
const { releaseInvariantNames } = await import(pathToFileURL(modulePath).href);
process.exit(releaseInvariantNames.has(invariant) ? 0 : 1);
NODE
  then
    echo "unknown release invariant" >&2
    exit 2
  fi
  set +e
  "$@"
  status=$?
  set -e
  if [[ "$status" -ne 0 ]]; then
    printf 'FAIL invariant=%s\n' "$invariant" >&2
  fi
  exit "$status"
fi

run_gate() {
  "$ROOT/scripts/ci.sh" --run-invariant "$@"
}

run_gate SHELL_SYNTAX bash -n install.sh verify.sh scripts/package.sh scripts/sanitize_ci_log.sh scripts/scan_package_sensitive.sh scripts/verify_package.sh tests/install/run-clean-install.sh tests/install/run-v4-upgrade.sh
run_gate TYPE_SAFETY npm run typecheck
run_gate SECURITY_INVARIANTS npm test
run_gate CONTRACT_VALIDATION npm run validate
run_gate SECRET_OUTPUT npm run scan:secrets
run_gate SOURCE_CONTRACT ./verify.sh --source-tree
run_gate CLEAN_INSTALL ./tests/install/run-clean-install.sh
run_gate V4_MIGRATION ./tests/install/run-v4-upgrade.sh
OUTPUT="$(mktemp -d)"
RELATIVE_OUTPUT=".test-output/package-relative-$$"
trap 'rm -rf "$OUTPUT" "$RELATIVE_OUTPUT"' EXIT
run_gate PACKAGE_BUILD ./scripts/package.sh --output "$OUTPUT/a" >/dev/null
run_gate PACKAGE_BUILD ./scripts/package.sh --output "$OUTPUT/b" >/dev/null
run_gate PACKAGE_BUILD ./scripts/package.sh --output "$RELATIVE_OUTPUT" >/dev/null
run_gate PACKAGE_REPRODUCIBILITY cmp "$OUTPUT/a/jiraman-5.0.0.tar.gz" "$OUTPUT/b/jiraman-5.0.0.tar.gz"
run_gate PACKAGE_REPRODUCIBILITY cmp "$OUTPUT/a/jiraman-5.0.0.zip" "$OUTPUT/b/jiraman-5.0.0.zip"
run_gate PACKAGE_REPRODUCIBILITY cmp "$OUTPUT/a/jiraman-5.0.0.tar.gz" "$RELATIVE_OUTPUT/jiraman-5.0.0.tar.gz"
run_gate PACKAGE_REPRODUCIBILITY cmp "$OUTPUT/a/jiraman-5.0.0.zip" "$RELATIVE_OUTPUT/jiraman-5.0.0.zip"
run_gate PACKAGE_INTEGRITY ./scripts/verify_package.sh "$OUTPUT/a/jiraman-5.0.0.tar.gz"
run_gate PACKAGE_INTEGRITY ./scripts/verify_package.sh "$OUTPUT/a/jiraman-5.0.0.zip"
echo "Jiraman release gates: PASS"
