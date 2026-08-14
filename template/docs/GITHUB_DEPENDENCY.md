# GitHub component dependency

Inside the public monorepo, the template links `@convex-dev/shopify` from the
repository root. The creation script extracts only `template/`, resolves its
default `main` branch to an immutable commit, and rewrites that workspace
dependency to the same selected public tag or commit.

The initializer is maintained as the `create-convex-shopify` workspace package,
not as logic embedded in `template/create.sh`. The small shell launcher only
resolves one immutable commit, downloads the CLI and its SHA-256 checksum from
that commit, verifies it, and executes the CLI against the same commit. This
prevents a branch update from pairing an older initializer with a newer template.

`npm ci` resolves that commit directly from public GitHub over HTTPS. No npm
registry publication, sibling checkout, GitHub credential, deploy key, or
repository secret is required.
