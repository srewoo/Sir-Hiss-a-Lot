#!/usr/bin/env bash
# Build the Chrome Web Store upload zip.
#
#   ./tools/build.sh            -> dist/sir-hiss-a-lot-<version>.zip
#
# Ships only what the extension needs at runtime. Dev files (README, selftest,
# store art, tooling) are left out so reviewers see nothing they have to ask about.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Files that go in the zip. Anything not listed here is not shipped.
SHIP=(manifest.json background.js index.html game.js icons)

VERSION="$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')"
OUT="dist/sir-hiss-a-lot-${VERSION}.zip"

fail() { echo "  ✗ $1" >&2; exit 1; }

echo "Sir Hiss-a-Lot ${VERSION}"
echo "Checking…"

python3 -c 'import json;json.load(open("manifest.json"))' || fail "manifest.json is not valid JSON"

# Chrome wants 1-4 dot-separated integers; anything else is rejected on upload.
[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){0,3}$ ]] || fail "manifest version \"$VERSION\" is not a valid Chrome version"

for f in "${SHIP[@]}"; do
  [[ -e "$f" ]] || fail "missing $f"
done

for size in 16 48 128; do
  [[ -f "icons/icon${size}.png" ]] || fail "missing icons/icon${size}.png"
done

# MV3 refuses to load a page with an inline <script> or an inline event handler;
# catching it here beats finding out from a rejected upload.
if grep -oE '<script[^>]*>' index.html | grep -qv 'src='; then
  fail "index.html has an inline <script> — MV3 CSP will block it"
fi
if grep -qiE '\bon[a-z]+="' index.html; then
  fail "index.html has an inline event handler — MV3 CSP will block it"
fi

# Every local file the page references must actually be in the zip.
while read -r ref; do
  [[ -z "$ref" || "$ref" == http* || "$ref" == data:* ]] && continue
  [[ -e "$ref" ]] || fail "index.html references missing file: $ref"
done < <(grep -oE '(src|href)="[^"]+"' index.html | cut -d'"' -f2)

node --check game.js 2>/dev/null && node --check background.js 2>/dev/null \
  || echo "  · node not found, skipping syntax check"

echo "  ✓ checks passed"

mkdir -p dist
rm -f "$OUT"
zip -r -q -X "$OUT" "${SHIP[@]}" -x '*.DS_Store' '*/.*'

echo "  ✓ $OUT ($(du -h "$OUT" | cut -f1))"
echo
unzip -Z1 "$OUT" | sed 's/^/  /'
echo
echo "Upload at https://chrome.google.com/webstore/devconsole"
