#!/usr/bin/env bash
# Fail if maintainer secrets could reach git (run before commit/push).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if git ls-files --error-unmatch config/maintainer.local >/dev/null 2>&1; then
  echo "error: config/maintainer.local is tracked by git — run: git rm --cached config/maintainer.local" >&2
  exit 1
fi

if git diff --cached --name-only | grep -qx 'config/maintainer.local'; then
  echo "error: config/maintainer.local is staged" >&2
  exit 1
fi

if git diff --cached | grep -E '^\+[^#]*VSCE_PAT=[^[:space:]]+' | grep -v 'maintainer.local.example' | grep -v 'VSCE_PAT=$' | grep -v 'VSCE_PAT=""'; then
  echo "error: staged diff may contain VSCE_PAT value — never commit tokens" >&2
  exit 1
fi

echo "guard-no-secrets: OK (maintainer.local not tracked or staged)"
