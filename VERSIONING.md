# Versioning and distribution

The package follows semantic versioning beginning at `v0.1.0`. While the major
version is zero, minor releases may contain deliberate API changes documented
in commit history and release notes. Credential storage changes require an
explicit staged upgrade path; application-domain migrations never belong in
this package.

The repository is a public monorepo. The package is `private: true` and is not
licensed or published to npm. License selection remains intentionally
undecided. The supported interim distribution is a public HTTPS Git dependency
pinned to an immutable commit or verified tag:

```json
{
  "dependencies": {
    "@convex-dev/shopify": "git+https://github.com/tomslutsky/convex-shopify.git#v0.2.0"
  }
}
```

Public GitHub installation requires no repository credential. The committed
`dist/` directory makes installation independent of a sibling checkout. Before
tagging, run `npm ci && npm run verify`, inspect `npm pack --dry-run`, and
confirm the generated artifacts are unchanged.
