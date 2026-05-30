#!/usr/bin/env bash
# Load maintainer.local for VSCE_PAT (never log the token).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAINTAINER_ENV="$ROOT/config/maintainer.local"

if [[ -f "$MAINTAINER_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$MAINTAINER_ENV"
  set +a
fi

if [[ -z "${VSCE_PAT:-}" ]]; then
  echo "error: VSCE_PAT is not set." >&2
  echo "" >&2
  echo "  cp config/maintainer.local.example config/maintainer.local" >&2
  echo "  # add Marketplace Manage PAT → https://dev.azure.com/anghelll/_usersSettings/tokens" >&2
  echo "" >&2
  echo "  Or export VSCE_PAT in your shell for this session only." >&2
  exit 2
fi
