#!/usr/bin/env bash
# Capa C: publish anghelll.bdd-pilot to VS Code Marketplace (requires VSCE_PAT).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/load-maintainer-env.sh"
# shellcheck disable=SC1091
source "$ROOT/scripts/marketplace-version.sh"

VERSION="$(node -p "require('./package.json').version")"

echo "== BDD Pilot publish:marketplace (Capa C) =="
echo "  anghelll.bdd-pilot @ $VERSION"
echo ""

echo "-- version gate --"
MP_LATEST="$(fetch_marketplace_latest)"
assert_publishable_version "$VERSION" "$MP_LATEST"
echo ""

npm run package

echo ""
echo "-- vsce publish --"
npx @vscode/vsce publish --no-dependencies

echo ""
echo "Published. Verify:"
echo "  https://marketplace.visualstudio.com/items?itemName=anghelll.bdd-pilot"
echo ""
echo "Post-publish: pin ROADMAP checklist · good first issue · watch 1–2 weeks."
