#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -ne 1 ]]; then echo "usage: ./scripts/verify_package.sh ARCHIVE" >&2; exit 2; fi
ARCHIVE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT
case "$ARCHIVE" in
  *.tar.gz) tar -xzf "$ARCHIVE" -C "$TEMP" ;;
  *.zip) unzip -q "$ARCHIVE" -d "$TEMP" ;;
  *) echo "unsupported archive: $ARCHIVE" >&2; exit 2 ;;
esac
mapfile -t roots < <(find "$TEMP" -mindepth 1 -maxdepth 1 -type d)
[[ "${#roots[@]}" -eq 1 ]] || { echo "package must have one root" >&2; exit 1; }
ROOT="${roots[0]}"
(
  cd "$ROOT"
  sha256sum -c MANIFEST.sha256 >/dev/null
)
for forbidden in "$ROOT/.git" "$ROOT/node_modules" "$ROOT/dist" "$ROOT/coverage" "$ROOT/release" "$ROOT/.test-output" "$ROOT/.kilo/state" "$ROOT/tests/install/output"; do
  if [[ -e "$forbidden" ]]; then echo "forbidden package path: ${forbidden#"$ROOT/"}" >&2; exit 1; fi
done
if find "$ROOT" -type d -name '.jiraman-backup-*' -print -quit | grep -q .; then echo "backup directory in package" >&2; exit 1; fi
while IFS= read -r path; do extension="${path##*.}"; if [[ "$extension" == "p""y" || "$extension" == "p""yc" ]]; then echo "application runtime file in package: $path" >&2; exit 1; fi; done < <(find "$ROOT" -type f)
"$ROOT/verify.sh" --source-tree >/dev/null
(
  cd "$ROOT"
  npm ci --ignore-scripts --silent
  npm run validate --silent >/dev/null
)
echo "package verification: PASS ($ARCHIVE)"
