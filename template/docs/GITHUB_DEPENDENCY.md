# GitHub component dependency

Inside the public monorepo, the template links `@convex-dev/shopify` from the
repository root. The creation script extracts only `template/`, resolves its
default `main` branch to an immutable commit, and rewrites that workspace
dependency to the same selected public tag or commit.

The initializer is maintained as the `create-convex-shopify` workspace package,
not as logic embedded in `template/create.sh`. The small shell launcher only
downloads and executes the committed CLI build for compatibility with the
original curl entry point.

`npm ci` resolves that commit directly from public GitHub over HTTPS. No npm
registry publication, sibling checkout, GitHub credential, deploy key, or
repository secret is required.
