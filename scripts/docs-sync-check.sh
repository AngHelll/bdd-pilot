#!/usr/bin/env bash
# Docs sync guard (Release & dogfood loop P3 / AGENT A4 lite).
# Fails when product sources under src/ (excluding src/test/) change vs a git
# baseline without a CHANGELOG.md change. Does not require a version bump.
#
# Usage:
#   npm run docs:sync-check
#   bash scripts/docs-sync-check.sh
#
# Env:
#   DOCS_SYNC_BASE   Git ref to diff against (default: origin/main if exists, else main, else HEAD~1)
#   DOCS_SYNC_WARN=1 Warn instead of exit 1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

resolve_base() {
  if [[ -n "${DOCS_SYNC_BASE:-}" ]]; then
    echo "$DOCS_SYNC_BASE"
    return
  fi
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    echo "origin/main"
    return
  fi
  if git rev-parse --verify --quiet main >/dev/null; then
    echo "main"
    return
  fi
  echo "HEAD~1"
}

BASE="$(resolve_base)"
echo "== BDD Pilot docs:sync-check =="
echo "  base: $BASE"

# Collect changed paths: branch vs BASE, plus working tree / staged vs HEAD.
ALL_FILES="$(
  {
    git diff --name-only "${BASE}...HEAD" 2>/dev/null || true
    git diff --name-only HEAD 2>/dev/null || true
    git diff --name-only --cached 2>/dev/null || true
  } | awk 'NF && !seen[$0]++'
)"

SRC_HIT=0
CHANGELOG_HIT=0
SRC_SAMPLE_N=0
SRC_SAMPLES=""

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ "$f" == "CHANGELOG.md" ]]; then
    CHANGELOG_HIT=1
    continue
  fi
  case "$f" in
    src/test/*) ;;
    src/*)
      SRC_HIT=1
      if [[ "$SRC_SAMPLE_N" -lt 5 ]]; then
        SRC_SAMPLES="${SRC_SAMPLES}    - ${f}"$'\n'
        SRC_SAMPLE_N=$((SRC_SAMPLE_N + 1))
      fi
      ;;
  esac
done <<< "$ALL_FILES"

if [[ "$SRC_HIT" -eq 0 ]]; then
  echo "  OK: no product src/ changes (or only src/test/) vs $BASE + working tree"
  exit 0
fi

if [[ "$CHANGELOG_HIT" -eq 1 ]]; then
  echo "  OK: src/ changed and CHANGELOG.md also changed"
  exit 0
fi

echo "  FAIL: docs sync: src/ changed without CHANGELOG.md update (base=$BASE)" >&2
printf '%s' "$SRC_SAMPLES" >&2
echo "  Add a CHANGELOG bullet, or set DOCS_SYNC_WARN=1 to warn only." >&2

if [[ "${DOCS_SYNC_WARN:-}" == "1" ]]; then
  echo "  (DOCS_SYNC_WARN=1 — continuing with warning)" >&2
  exit 0
fi
exit 1
