#!/usr/bin/env bash
# Capa C preflight: PAT present, package builds, VSIX ok, optional Marketplace version peek.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/load-maintainer-env.sh"

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
if npx @vscode/vsce show anghelll.bdd-pilot --json 2>/dev/null | node -e "
  let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{
    try {
      const j=JSON.parse(s);
      const v=j.versions?.[0]?.version ?? j.version ?? 'unknown';
      console.log('  Marketplace latest   :', v);
      console.log('  Local package.json   :', process.argv[1]);
      if (v !== 'unknown' && v !== process.argv[1]) console.log('  → publish will upload', process.argv[1]);
      else if (v === process.argv[1]) console.log('  → same version already on Marketplace (publish may no-op or fail)');
    } catch { console.log('  (could not parse vsce show — PAT may lack read or network)'); }
  });
" "$VERSION"; then
  :
else
  echo "  (vsce show skipped — check PAT scopes or network)"
fi

echo ""
echo "Preflight OK. To publish:"
echo "  npm run publish:marketplace"
echo ""
echo "Gate: only run after Capa B dogfood OK and explicit \"publish\" order."
