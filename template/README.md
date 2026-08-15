# Convex Shopify app starter

An embedded Shopify App Home using React, TanStack Start, Vite, App Bridge,
Polaris web components, and Convex.

Requires Node.js 22.18 or newer.

## Quickstart

```sh
curl -fsSL https://raw.githubusercontent.com/tomslutsky/convex-shopify/main/template/create.sh | bash
```

Choose an app name when prompted. The setup wizard will:

1. create the app directory;
2. install dependencies;
3. link or create the Shopify app configuration;
4. create or select a Convex project;
5. generate and configure protected keys;
6. run Shopify GraphQL codegen.

Then run:

```sh
cd my-shopify-app
npm run dev
```

Open the development app from Shopify Admin. For automation, inspect:

```sh
npm run setup -- --help
```

The wizard is resumable. If setup stops while waiting for an interactive
Shopify or Convex CLI prompt, run `npm run setup` again in the generated app.

## What you get

- Embedded App Bridge session-token authentication.
- Convex JWT issuance and a public JWKS endpoint for the browser app.
- Encrypted Shopify offline credentials managed by the component.
- Typed Shopify Admin GraphQL operations.
- Explicit topic-specific webhook routes with durable delivery and retries.
- SPA deep-link fallback through Convex static hosting.
- App-owned store membership and authorization examples.
- Tests, config checks, codegen, lint, typecheck, and production build scripts.

## Development commands

```sh
npm run dev
npm run setup
npm run config:check
npm run config:sync
npm run shopify:codegen
npm test
npm run typecheck
npm run lint
npm run build
```

These commands do not deploy. `npm run setup:check` checks local wiring without
contacting a live deployment.

## Main application flow

The browser sends its Shopify session token to `POST /auth/shopify`. Convex
verifies the token, exchanges the offline credential, and returns a short-lived
app JWT. The browser uses that JWT for the app's Convex functions.

The app exposes these Shopify webhook paths:

```text
/webhooks/app/uninstalled
/webhooks/app/scopes-update
/webhooks/customers/data-request
/webhooks/customers/redact
/webhooks/shop/redact
```

The component verifies HMACs, deduplicates webhook IDs, updates its own scope or
credential state, and retries the app-owned handler. Implement the compliance
handlers in `convex/lib/compliance.ts` before storing real customer or merchant
data.

## Architecture rule

TanStack Start is intentionally SPA-only. Do not add TanStack server functions,
SSR loaders, or another application server to this template.

- Put public HTTP callbacks in `convex/http.ts`.
- Put reads and writes in Convex queries and mutations.
- Put Shopify calls and other external I/O in Convex actions.
- Put scheduled or retryable work in Convex functions.

The Shopify component owns credentials and Shopify protocol. This app owns
users, memberships, authorization, domain data, webhook URLs, and business
behavior.

## Production

For a reviewed release:

```sh
npm run deploy:convex
npm run publish:static
```

Then set `application_url` in the ignored production Shopify configuration to
the resulting `https://<deployment>.convex.site` URL, verify the topic-specific
webhook paths, and deploy the named Shopify configuration. Follow the complete
[release runbook](docs/OPERATIONS.md).

## Configuration and safety

Runtime scopes and the Admin API version are defined in
`convex/lib/shopifyConfig.ts`. `npm run config:check` verifies that the Shopify
TOML files agree.

Backend secrets belong in Convex environment variables. Never use a `VITE_`
prefix for secrets. See [environment variables](docs/ENVIRONMENT.md).
