#!/usr/bin/env bash
set -Eeuo pipefail

readonly TEMPLATE_REPOSITORY="tomslutsky/convex-shopify"
template_ref="v0.1.0"

app_name=""
target_directory=""
assume_yes=false
install_dependencies=true
run_setup=true
dry_run=false

usage() {
  cat <<'EOF'
Create a Shopify + Convex app without an npm-published initializer.

Usage:
  curl -fsSL https://raw.githubusercontent.com/tomslutsky/convex-shopify/main/template/create.sh | bash
  create.sh [options]

No arguments are required; the default flow is interactive.

Options:
  --name NAME          set the package/app name
  --directory PATH     set the target directory
  --template-ref REF   use another template tag or immutable commit
  --yes                accept bootstrap defaults
  --no-install         skip npm install
  --no-setup           skip the Shopify/Convex setup wizard
  --dry-run            print resolved actions without changing files
  --help               show this help
EOF
}

while (($#)); do
  case "$1" in
    --name)
      (($# >= 2)) || { echo "--name requires a value" >&2; exit 2; }
      app_name="$2"; shift 2 ;;
    --directory)
      (($# >= 2)) || { echo "--directory requires a value" >&2; exit 2; }
      target_directory="$2"; shift 2 ;;
    --template-ref)
      (($# >= 2)) || { echo "--template-ref requires a value" >&2; exit 2; }
      template_ref="$2"; shift 2 ;;
    --yes) assume_yes=true; shift ;;
    --no-install) install_dependencies=false; shift ;;
    --no-setup) run_setup=false; shift ;;
    --dry-run) dry_run=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

prompt() {
  local question="$1" default_value="$2" answer
  if [[ ! -r /dev/tty ]]; then
    echo "Interactive input requires a terminal. Re-run in a terminal or pass --name and --yes." >&2
    exit 1
  fi
  printf '%s [%s]: ' "$question" "$default_value" >/dev/tty
  IFS= read -r answer </dev/tty || true
  printf '%s' "${answer:-$default_value}"
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

if [[ -z "$app_name" ]]; then
  if [[ "$assume_yes" == true ]]; then
    app_name="my-shopify-app"
  else
    app_name="$(prompt 'App name' 'my-shopify-app')"
  fi
fi
app_name="$(slugify "$app_name")"
[[ -n "$app_name" ]] || { echo "The app name must contain a letter or number." >&2; exit 2; }
[[ "$app_name" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || { echo "Invalid app name: $app_name" >&2; exit 2; }

if [[ -z "$target_directory" ]]; then
  target_directory="$app_name"
fi

archive_url="https://github.com/${TEMPLATE_REPOSITORY}/archive/${template_ref}.tar.gz"

printf '\nCreate Convex Shopify\n\n'
printf '  App:      %s\n' "$app_name"
printf '  Target:   %s\n' "$target_directory"
printf '  Template: %s@%s\n\n' "$TEMPLATE_REPOSITORY" "$template_ref"

if [[ "$dry_run" == true ]]; then
  printf 'Would download the pinned template, initialize Git, and%s install dependencies.\n' "$([[ "$install_dependencies" == true ]] && printf '' || printf ' not')"
  [[ "$run_setup" == true ]] && printf 'Would launch the interactive Shopify + Convex setup wizard.\n'
  exit 0
fi

for command in curl tar git node npm; do
  command -v "$command" >/dev/null 2>&1 || { echo "$command is required." >&2; exit 1; }
done
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 18)) { console.error("Node.js 22.18 or newer is required."); process.exit(1) }'

if [[ -e "$target_directory" ]]; then
  echo "Refusing to overwrite existing path: $target_directory" >&2
  exit 1
fi

bootstrap_tmp="$(mktemp -d "${TMPDIR:-/tmp}/create-convex-shopify.XXXXXX")"
cleanup() {
  case "$bootstrap_tmp" in
    "${TMPDIR:-/tmp}"/create-convex-shopify.*) rm -rf -- "$bootstrap_tmp" ;;
  esac
}
trap cleanup EXIT INT TERM

curl -fsSL "$archive_url" -o "$bootstrap_tmp/template.tar.gz"
mkdir -p "$bootstrap_tmp/archive" "$target_directory"
tar -xzf "$bootstrap_tmp/template.tar.gz" -C "$bootstrap_tmp/archive"
archive_root="$(find "$bootstrap_tmp/archive" -mindepth 1 -maxdepth 1 -type d -print -quit)"
[[ -d "$archive_root/template" ]] || { echo "Downloaded archive does not contain template/." >&2; exit 1; }
tar -C "$archive_root/template" -cf - . | tar -C "$target_directory" -xf -

(
  cd "$target_directory"
  APP_NAME="$app_name" TEMPLATE_REF="$template_ref" node --input-type=module -e '
    import { readFileSync, writeFileSync } from "node:fs";
    const path = "package.json";
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    pkg.name = process.env.APP_NAME;
    pkg.dependencies["@convex-dev/shopify"] = `git+https://github.com/tomslutsky/convex-shopify.git#${process.env.TEMPLATE_REF}`;
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  '
  git init -q -b main
  if [[ "$install_dependencies" == true ]]; then
    npm install
  fi
  if [[ "$run_setup" == true ]]; then
    if [[ "$install_dependencies" != true ]]; then
      echo "Skipping setup because dependencies were not installed. Run npm install && npm run setup later."
    elif [[ -r /dev/tty ]]; then
      if [[ "$assume_yes" == true ]]; then
        npm run setup -- --yes </dev/tty
      else
        npm run setup </dev/tty
      fi
    else
      echo "Setup needs a terminal. Run npm run setup from $target_directory later."
    fi
  fi
)

printf '\nCreated %s.\n\n' "$target_directory"
printf 'Next time:\n  cd %q\n  npm run setup\n\n' "$target_directory"
