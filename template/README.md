# Shopify + Convex app starter

A deliberately small foundation for an embedded Shopify app using TanStack Start, React, Vite, Convex, App Bridge, and the `@convex-dev/shopify` component.

Requires Node.js 22.18 or newer. The App Home UI uses Shopify's CDN-hosted App Bridge and Polaris web components with their official companion TypeScript packages.

## Create your first app

```sh
curl -fsSL https://raw.githubusercontent.com/tomslutsky/convex-shopify/main/template/create.sh | bash
```

The initializer lives beside the component in this monorepo, so both are versioned together.
The no-argument path is an interactive wizard: choose the app name, then let it
download this template, install dependencies, link Shopify, select a fresh
Convex project, generate protected keys, configure secrets, and run codegen.
After cloning manually, the same resumable wizard is available as
`npm run setup`. Use `npm run setup -- --help` to see automation flags.

Open the generated preview URL through **Shopify Admin → Apps** in your development store. Convex's built-in `CONVEX_SITE_URL` is the app-token issuer and JWKS origin, so initial project creation has no auth-environment-variable chicken-and-egg. The wizard copies the linked app's public client ID and securely transfers its API secret from Shopify CLI to Convex without displaying or retaining the secret.

The component is consumed directly from a public GitHub commit behind verified
tag `v0.2.0`; nothing is published to an npm registry. See
[GitHub dependency](docs/GITHUB_DEPENDENCY.md).

## What is included

- Shopify App Bridge bootstrap and session-token exchange.
- Shopify-native App Home layout and status UI using Polaris web components.
- Five-minute ES256 Convex JWTs and a public-only JWKS endpoint.
- Component-owned encrypted offline Shopify credentials and Admin GraphQL transport.
- App-owned `stores` and `storeMembers` tables with server-derived authorization.
- A typed inline `#graphql` shop identity example.
- HMAC-verified webhooks, durable webhook-ID deduplication, uninstall cleanup, and explicit compliance contracts.
- Deterministic negative security tests and configuration consistency checks.

## Configuration

The Shopify Admin API version and runtime scopes live in `convex/lib/shopifyConfig.ts`. `npm run config:check` proves that `shopify.app.toml` agrees. The committed TOML is intentionally a placeholder. Use named CLI configurations (`development` and `production`) and never commit a real client ID or generated local Shopify state.

After Shopify CLI links the development app, the setup wizard synchronizes the template's scopes and webhook subscriptions into the generated named configuration. Run `npm run config:sync` if you relink outside the wizard.

The frontend follows Shopify's current React model: React and TanStack own application state and routing, Polaris Web Components provide the App Home UI, and `@shopify/app-bridge-react` provides React access to App Bridge APIs such as toasts, modals, and resource pickers. No legacy App Bridge provider or deprecated Polaris React package is needed.

Run `npm run auth:keys` once per environment. It creates an untracked, mode-`0600` file and never prints private material. Delete the local file after setting the Convex environment values. See [environment reference](docs/ENVIRONMENT.md).

## Verification

```sh
npm ci
npm run config:check
npm run shopify:codegen
npm test
npm run typecheck
npm run lint
npm run build
```

These checks do not deploy. A real Shopify/Convex handshake remains a manual smoke test; see [operations](docs/OPERATIONS.md).

## Security boundary

The Shopify component owns credentials and protocol verification. This parent app owns identity-to-store membership and all domain authorization. Browser-supplied shop/user identifiers are never trusted for access decisions. Public Convex functions exist only for the authenticated browser flow; webhook persistence functions are internal.

New apps must define an explicit role policy. This template never treats the first visitor as an owner. All established memberships begin with the neutral `member` role.

## Compliance warning

The compliance endpoints authenticate and durably record Shopify deliveries, but customer export/redaction and shop-domain data deletion are intentionally app-owned stubs. **You must implement them for every domain table before using this starter with real merchant or customer data.** See [architecture and ownership](docs/ARCHITECTURE.md).

No license has been selected. All rights are reserved unless the repository owner adds a license.
