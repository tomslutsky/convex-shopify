#!/usr/bin/env bash
set -Eeuo pipefail

readonly repository="tomslutsky/convex-shopify"
requested_ref="main"
arguments=("$@")

for ((index = 0; index < ${#arguments[@]}; index += 1)); do
  if [[ "${arguments[$index]}" == "--template-ref" ]]; then
    ((index + 1 < ${#arguments[@]})) || { echo "--template-ref requires a value" >&2; exit 2; }
    requested_ref="${arguments[$((index + 1))]}"
  fi
done

resolve_ref() {
  local candidate output
  if [[ "$requested_ref" =~ ^[0-9a-f]{40}$ ]]; then
    printf '%s' "$requested_ref"
    return
  fi
  for candidate in "refs/heads/$requested_ref" "refs/tags/$requested_ref^{}" "refs/tags/$requested_ref"; do
    output="$(git ls-remote "https://github.com/${repository}.git" "$candidate")"
    if [[ "${output%%[[:space:]]*}" =~ ^[0-9a-f]{40}$ ]]; then
      printf '%s' "${output%%[[:space:]]*}"
      return
    fi
  done
  echo "Could not resolve public template ref: $requested_ref" >&2
  exit 1
}

verify_checksum() {
  local expected actual
  expected="$(awk 'NR == 1 { print $1 }' "$2")"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$1" | awk '{ print $1 }')"
  else
    actual="$(shasum -a 256 "$1" | awk '{ print $1 }')"
  fi
  [[ "$expected" =~ ^[0-9a-f]{64}$ && "$actual" == "$expected" ]] || {
    echo "Initializer checksum verification failed." >&2
    exit 1
  }
}

resolved_ref="$(resolve_ref)"
repository_cli=""
script_source="${BASH_SOURCE[0]-}"
if [[ -n "$script_source" && "$script_source" != /dev/fd/* ]]; then
  repository_cli="$(cd "$(dirname "$script_source")/.." 2>/dev/null && pwd)/packages/create-convex-shopify/dist/cli.js"
fi
if [[ -f "$repository_cli" ]]; then
  node "$repository_cli" "${arguments[@]}" --template-ref "$resolved_ref"
else
  initializer_tmp="$(mktemp "${TMPDIR:-/tmp}/create-convex-shopify.XXXXXX.mjs")"
  checksum_tmp="${initializer_tmp}.sha256"
  cleanup() { rm -f -- "$initializer_tmp" "$checksum_tmp"; }
  trap cleanup EXIT INT TERM
  base_url="https://raw.githubusercontent.com/${repository}/${resolved_ref}/packages/create-convex-shopify/dist"
  curl -fsSL "$base_url/cli.js" -o "$initializer_tmp"
  curl -fsSL "$base_url/cli.js.sha256" -o "$checksum_tmp"
  verify_checksum "$initializer_tmp" "$checksum_tmp"
  node "$initializer_tmp" "${arguments[@]}" --template-ref "$resolved_ref"
fi
