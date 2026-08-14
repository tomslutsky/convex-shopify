#!/usr/bin/env bash
set -Eeuo pipefail

# Compatibility launcher for the public monorepo. The tested implementation is
# the create-convex-shopify workspace package; keep this script intentionally
# free of template/setup logic so the two entry points cannot drift.
repository_cli="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)/packages/create-convex-shopify/dist/cli.js"
if [[ -f "$repository_cli" ]]; then
  node "$repository_cli" --template-ref main "$@"
else
  initializer_tmp="$(mktemp "${TMPDIR:-/tmp}/create-convex-shopify.XXXXXX.mjs")"
  cleanup() { rm -f -- "$initializer_tmp"; }
  trap cleanup EXIT INT TERM
  curl -fsSL "https://raw.githubusercontent.com/tomslutsky/convex-shopify/main/packages/create-convex-shopify/dist/cli.js" -o "$initializer_tmp"
  node "$initializer_tmp" --template-ref main "$@"
fi
