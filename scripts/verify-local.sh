#!/usr/bin/env bash
# Capa A: verificación automática local (sin UI VS Code).
# Capa B: imprime checklist manual fijo + hint de spec extras.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SPEC_HINT="${1:-}"

echo "== BDD Pilot verify:local (Capa A) =="

echo ""
echo "-- compile --"
npm run compile

echo ""
echo "-- lint --"
npm run lint

echo ""
echo "-- unit tests --"
npm run test:unit

echo ""
echo "-- build + VSIX --"
npm run build
npm run package
if [[ ! -f bdd-pilot.vsix ]]; then
  echo "error: bdd-pilot.vsix not found" >&2
  exit 1
fi
echo "VSIX OK: bdd-pilot.vsix ($(wc -c < bdd-pilot.vsix | tr -d ' ') bytes)"

echo ""
echo "=============================================="
echo "  CAPA B — CHECKLIST MANUAL (tu intervención)"
echo "=============================================="
echo ""
echo "  [ ] 1. Instalar bdd-pilot.vsix"
echo "         Cursor → Extensions → ... → Install from VSIX..."
echo "         Ruta: $ROOT/bdd-pilot.vsix"
echo ""
echo "  [ ] 2. Abrir workspace samples/minimal-bdd"
echo "         Panel BDD Pilot → features visibles en el tree"
echo ""
echo "  [ ] 3. Run @smoke o un escenario"
echo "         Icono pass/fail se actualiza tras el run"
echo ""
if [[ -n "$SPEC_HINT" ]]; then
  echo "  Extras de spec: docs-internal/specs/$SPEC_HINT"
  echo ""
fi
echo "  Cuando OK: di \"verificado, ship\" o pide más cambios."
echo "  Git (commit/push/tag): solo con orden explícita."
echo ""
