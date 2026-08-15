# Installing from GitHub

The starter currently consumes `@convex-dev/shopify` from this public GitHub
repository instead of npm.

The generated app pins the dependency to the same immutable commit as the
downloaded template. This keeps the template and component API in sync and
does not require a sibling checkout or GitHub credentials.

To update an existing app, change the dependency to a reviewed commit, then
run:

```sh
npm install
npm run config:check
npm test
npm run typecheck
npm run build
```

Do not replace an immutable commit with a moving branch in production.
