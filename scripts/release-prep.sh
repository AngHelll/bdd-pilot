#!/usr/bin/env bash
# Maintainer pre-release gate (Release & dogfood loop P1).
# Wraps dogfood/verify + package.json↔CHANGELOG check + VSIX checklist.
# Does NOT tag, push, create GitHub releases, or publish to Marketplace.
#
# Usage:
#   npm run release:prep
#   bash scripts/release-prep.sh [--verify-only | --skip-dogfood | --help]
#
# Flags:
#   --verify-only   Run `npm run verify:local` instead of full dogfood (faster iterate).
#   --skip-dogfood  Skip dogfood/verify; only version↔CHANGELOG + ensure VSIX (dangerous).
#   --help          Show this help.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="dogfood"

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verify-only) MODE="verify" ;;
    --skip-dogfood) MODE="skip" ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown flag: $1 (try --help)" >&2
      exit 1
      ;;
  esac
  shift
done

echo "== BDD Pilot release:prep =="
echo ""

VERSION="$(node -p "require('./package.json').version")"
echo "  package.json version : $VERSION"

echo ""
echo "-- CHANGELOG ↔ version --"
if ! grep -E -q "^## \[${VERSION}\]( —| |$)" CHANGELOG.md; then
  echo "error: CHANGELOG.md has no heading matching ## [${VERSION}]" >&2
  echo "  Add a section like: ## [${VERSION}] — YYYY-MM-DD" >&2
  exit 1
fi
echo "  CHANGELOG heading    : ## [${VERSION}] OK"

if grep -E -q '^## \[Unreleased\]' CHANGELOG.md; then
  # Warn (non-fatal) when Unreleased has non-placeholder bullets.
  if awk '
    BEGIN { in_u=0; bullets=0 }
    /^## \[Unreleased\]/ { in_u=1; next }
    /^## \[/ { in_u=0 }
    in_u && /^- / && $0 !~ /Nothing yet/ { bullets=1 }
    END { exit bullets ? 0 : 1 }
  ' CHANGELOG.md; then
    echo "  note: ## [Unreleased] still has bullets — move them into [${VERSION}] if shipping now"
  fi
fi

echo ""
case "$MODE" in
  dogfood)
    echo "-- gate: npm run dogfood --"
    npm run dogfood
    ;;
  verify)
    echo "-- gate: npm run verify:local (--verify-only) --"
    npm run verify:local
    ;;
  skip)
    echo "-- gate: SKIPPED (--skip-dogfood; dangerous) --"
    echo "  ensuring VSIX via npm run package"
    npm run package
    ;;
esac

if [[ ! -f bdd-pilot.vsix ]]; then
  echo ""
  echo "-- VSIX missing after gate; packaging --"
  npm run package
fi
if [[ ! -f bdd-pilot.vsix ]]; then
  echo "error: bdd-pilot.vsix not found" >&2
  exit 1
fi

VSIX_BYTES="$(wc -c < bdd-pilot.vsix | tr -d ' ')"
echo ""
echo "=============================================="
echo "  RELEASE PREP OK — next steps (human)"
echo "=============================================="
echo ""
echo "  Version : $VERSION"
echo "  VSIX    : $ROOT/bdd-pilot.vsix ($VSIX_BYTES bytes)"
echo ""
echo "  Capa B (manual):"
echo "  [ ] 1. Install from VSIX… → $ROOT/bdd-pilot.vsix"
echo "  [ ] 2. Open samples/minimal-bdd — tree discovers features"
echo "  [ ] 3. Run scenario or @smoke — pass/fail icons update"
echo ""
echo "  Ship (only with explicit order):"
echo "  [ ] git commit / tag v$VERSION / push"
echo "  [ ] gh release create v$VERSION (attach VSIX optional)"
echo "  [ ] npm run publish:check"
echo "  [ ] npm run publish:marketplace   # only with explicit \"publish\""
echo ""
echo "  Optional: open dogfood issue from .github/ISSUE_TEMPLATE/dogfood_checklist.yml"
echo "  Never: auto-publish or read VSCE_PAT from this script."
echo ""
