#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
bash -n install.sh verify.sh scripts/package.sh scripts/sanitize_ci_log.sh scripts/scan_package_sensitive.sh scripts/verify_package.sh tests/install/run-clean-install.sh tests/install/run-v4-upgrade.sh
npm run typecheck
npm test
npm run validate
npm run scan:secrets
./verify.sh --source-tree
./tests/install/run-clean-install.sh
./tests/install/run-v4-upgrade.sh
OUTPUT="$(mktemp -d)"
RELATIVE_OUTPUT=".test-output/package-relative-$$"
trap 'rm -rf "$OUTPUT" "$RELATIVE_OUTPUT"' EXIT
./scripts/package.sh --output "$OUTPUT/a" >/dev/null
./scripts/package.sh --output "$OUTPUT/b" >/dev/null
./scripts/package.sh --output "$RELATIVE_OUTPUT" >/dev/null
cmp "$OUTPUT/a/jiraman-5.0.0.tar.gz" "$OUTPUT/b/jiraman-5.0.0.tar.gz"
cmp "$OUTPUT/a/jiraman-5.0.0.zip" "$OUTPUT/b/jiraman-5.0.0.zip"
cmp "$OUTPUT/a/jiraman-5.0.0.tar.gz" "$RELATIVE_OUTPUT/jiraman-5.0.0.tar.gz"
cmp "$OUTPUT/a/jiraman-5.0.0.zip" "$RELATIVE_OUTPUT/jiraman-5.0.0.zip"
./scripts/verify_package.sh "$OUTPUT/a/jiraman-5.0.0.tar.gz"
./scripts/verify_package.sh "$OUTPUT/a/jiraman-5.0.0.zip"
echo "Jiraman release gates: PASS"
