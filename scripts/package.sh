#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT="$ROOT/release"
if [[ "${1:-}" == "--output" ]]; then OUTPUT="$2"; shift 2; fi
if [[ "$#" -ne 0 ]]; then echo "usage: ./scripts/package.sh [--output DIRECTORY]" >&2; exit 2; fi
VERSION="$(node -p "require('$ROOT/package.json').version")"
NAME="jiraman-$VERSION"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/$NAME" "$OUTPUT"
rm -f "$OUTPUT/$NAME.tar.gz" "$OUTPUT/$NAME.zip"
while IFS= read -r relative; do
  [[ -n "$relative" ]] || continue
  mkdir -p "$STAGE/$NAME/$(dirname "$relative")"
  cp -a "$ROOT/$relative" "$STAGE/$NAME/$relative"
done < "$ROOT/packaging/package-files.txt"
rm -rf "$STAGE/$NAME/tests/install/output"
(
  cd "$STAGE/$NAME"
  find . -type f ! -name MANIFEST.sha256 -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sed 's#  \./#  #' > MANIFEST.sha256
)
find "$STAGE/$NAME" -exec touch -h -d '@0' {} +
tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner -C "$STAGE" -cf - "$NAME" | gzip -n > "$OUTPUT/$NAME.tar.gz"
(
  cd "$STAGE"
  find "$NAME" -type f -print | LC_ALL=C sort | zip -X -q "$OUTPUT/$NAME.zip" -@
)
printf 'Built %s and %s\n' "$OUTPUT/$NAME.tar.gz" "$OUTPUT/$NAME.zip"
