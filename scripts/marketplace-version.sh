#!/usr/bin/env bash
# Read Marketplace latest version and compare semver (no secrets).
set -euo pipefail

fetch_marketplace_latest() {
  npx @vscode/vsce show anghelll.bdd-pilot --json 2>/dev/null | node -e "
    let s = '';
    process.stdin.on('data', (d) => { s += d; });
    process.stdin.on('end', () => {
      try {
        const j = JSON.parse(s);
        const v = j.versions?.[0]?.version ?? j.version ?? '';
        if (v) process.stdout.write(String(v));
      } catch {
        process.exit(1);
      }
    });
  " 2>/dev/null || true
}

# Exit 0 if $1 > $2 semver; 1 if <= or invalid.
semver_gt() {
  node -e "
    const parse = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
    const a = parse(process.argv[1]);
    const b = parse(process.argv[2]);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const x = a[i] ?? 0;
      const y = b[i] ?? 0;
      if (x > y) process.exit(0);
      if (x < y) process.exit(1);
    }
    process.exit(1);
  " "$1" "$2"
}

# Block publish when local version is not ahead of Marketplace.
assert_publishable_version() {
  local local_ver="$1"
  local mp_ver="${2:-}"

  if [[ -z "$mp_ver" ]]; then
    echo "  Marketplace latest   : (unknown — skipping version gate)"
    return 0
  fi

  echo "  Marketplace latest   : $mp_ver"
  echo "  Local package.json   : $local_ver"

  if semver_gt "$local_ver" "$mp_ver"; then
    echo "  → publish OK (local > Marketplace)"
    return 0
  fi

  if [[ "${PUBLISH_FORCE:-}" == "1" ]]; then
    echo "  ⚠ PUBLISH_FORCE=1 — publishing despite local <= Marketplace" >&2
    return 0
  fi

  echo "error: local version ($local_ver) is not greater than Marketplace ($mp_ver)." >&2
  echo "  Bump package.json (e.g. patch) or set PUBLISH_FORCE=1 to override (not recommended)." >&2
  return 1
}
