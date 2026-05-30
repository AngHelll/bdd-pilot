#!/usr/bin/env bash
# Automated pre-release checks for BDD Pilot (0.2.5-4 / Phase C gate).
# Manual VS Code checklist: .github/ISSUE_TEMPLATE/dogfood_checklist.yml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== BDD Pilot automated dogfood smoke =="

echo ""
echo "-- Extension: lint, compile, unit tests --"
npm run lint
npm run compile
npm run test:unit

echo ""
echo "-- Extension: bundle + VSIX --"
npm run build
npm run package
if [[ ! -f bdd-pilot.vsix ]]; then
  echo "error: bdd-pilot.vsix not found after npm run package" >&2
  exit 1
fi
echo "VSIX OK: bdd-pilot.vsix ($(wc -c < bdd-pilot.vsix | tr -d ' ') bytes)"

echo ""
echo "-- Sample BDD: dotnet restore, build, test --"
dotnet restore samples/minimal-bdd/MinimalBdd.csproj
dotnet build samples/minimal-bdd/MinimalBdd.csproj --no-restore
dotnet test samples/minimal-bdd/MinimalBdd.csproj --no-build --verbosity minimal

echo ""
echo "-- Sample BDD: Pilot-style filters --"
dotnet test samples/minimal-bdd/MinimalBdd.csproj --no-build --filter "Category=smoke" --verbosity minimal
dotnet test samples/minimal-bdd/MinimalBdd.csproj --no-build --filter "FullyQualifiedName~SmokeFeature" --verbosity minimal

echo ""
echo "All automated dogfood checks passed."
echo "Next: open samples/minimal-bdd in VS Code, install bdd-pilot.vsix, file dogfood checklist issue."
