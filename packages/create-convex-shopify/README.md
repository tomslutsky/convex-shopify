# create-convex-shopify

This workspace owns the initializer used by the public
`tomslutsky/convex-shopify` monorepo. Today it is distributed through the
repository's compatibility launcher:

```sh
curl -fsSL https://raw.githubusercontent.com/tomslutsky/convex-shopify/main/template/create.sh | bash
```

The package remains `private: true` while the repository has no selected
license and no npm release. After those release decisions, it is structured to
support `npm create convex-shopify@latest` without changing the CLI.

The initializer resolves its default public `main` branch (or any explicitly
selected branch) to an immutable commit, extracts only the
`template/` workspace, rewrites its monorepo-local component dependency to the
same public Git revision, initializes Git, installs dependencies, and launches
the resumable Shopify/Convex setup wizard.

Run `create-convex-shopify --help` for non-interactive and CI options.
