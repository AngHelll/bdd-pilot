#!/usr/bin/env bash
# Capa C preflight: PAT present, package builds, VSIX ok, Marketplace version compare.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/load-maintainer-env.sh"
# shellcheck disable=SC1091
source "$ROOT/scripts/marketplace-version.sh"

VERSION="$(node -p "require('./package.json').version")"

echo "== BDD Pilot publish:check (Capa C preflight) =="
echo ""
echo "  package.json version : $VERSION"
echo "  publisher            : anghelll"
echo "  VSCE_PAT             : set (${#VSCE_PAT} chars)"
echo ""

echo "-- package VSIX --"
npm run package
if [[ ! -f bdd-pilot.vsix ]]; then
  echo "error: bdd-pilot.vsix not found" >&2
  exit 1
fi
echo "VSIX OK: bdd-pilot.vsix ($(wc -c < bdd-pilot.vsix | tr -d ' ') bytes)"
echo ""

echo "-- marketplace (read-only) --"
MP_LATEST="$(fetch_marketplace_latest)"
if [[ -z "$MP_LATEST" ]]; then
  echo "  (could not read Marketplace version — check PAT/network)"
elif semver_gt "$VERSION" "$MP_LATEST"; then
  echo "  Marketplace latest   : $MP_LATEST"
  echo "  Local package.json   : $VERSION"
  echo "  → publish OK (local > Marketplace)"
else
  echo "  Marketplace latest   : $MP_LATEST"
  echo "  Local package.json   : $VERSION"
  echo "  → publish BLOCKED — bump package.json before publish:marketplace"
  echo "    (override: PUBLISH_FORCE=1 — not recommended)"
fi

echo ""
echo "Preflight OK (build + PAT). To publish when version is ahead:"
echo "  npm run publish:marketplace"
echo ""
echo "Gate: only run after Capa B dogfood OK and explicit \"publish\" order."
