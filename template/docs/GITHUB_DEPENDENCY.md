# GitHub component dependency

Inside the monorepo, the template links `@convex-dev/shopify` from the repository
root. The creation script rewrites that workspace dependency to the selected
immutable tag or commit in the public `convex-shopify` repository.

`npm ci` resolves that commit directly from public GitHub over HTTPS. No npm
registry publication, sibling checkout, GitHub credential, deploy key, or
repository secret is required.
