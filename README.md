# Convex Shopify

Shopify authentication, encrypted offline credentials, Admin GraphQL, and
durable webhooks for Convex applications.

This public repository contains two things:

- `template/`: a complete embedded Shopify app starter.
- the component package: the backend boundary used by that starter.

The package is currently consumed from GitHub rather than npm. Use an
immutable commit or a release tag.

## Start a new app

```sh
curl -fsSL https://raw.githubusercontent.com/tomslutsky/convex-shopify/main/template/create.sh | bash
```

The wizard creates a directory, installs dependencies, links Shopify, creates
or selects a Convex project, configures secrets, and runs GraphQL codegen.
Then start development:

```sh
cd my-shopify-app
npm run dev
```

Use `npm run setup -- --help` for non-interactive setup and CI options.

The generated app is an embedded Shopify App Home built with React, TanStack
Start, Vite, App Bridge, and Convex. TanStack Start runs in SPA mode. The
backend is Convex: HTTP routes live in `convex/http.ts`, and queries, mutations,
actions, storage, and scheduled work live in Convex functions.

## Use the component in an existing Convex app

Install the public Git dependency:

```sh
npm install 'git+https://github.com/tomslutsky/convex-shopify.git#ebb433f2a9661dcaedf6f0dc9b8dcce80fd25067'
```

Register the component:

```ts
// convex/convex.config.ts
import { defineApp } from 'convex/server'
import shopify from '@convex-dev/shopify/convex.config.js'

const app = defineApp()
app.use(shopify, { name: 'shopify' })
export default app
```

Create the application facade from the generated component reference:

```ts
// convex/lib/shopifyApp.ts
import { shopifyApp } from '@convex-dev/shopify'
import { components } from '../_generated/api'

export const shopify = shopifyApp({ component: components.shopify })
```

Set the required Convex environment variables before using the facade. See
[`ENVIRONMENT.md`](ENVIRONMENT.md) for the complete list and key rotation
instructions.

## Main API

### Embedded Admin requests

Pass the Shopify App Bridge session token to the Convex action that handles
your authenticated request:

```ts
const { admin, session, shopifyUserId } = await shopify.authenticate.admin(ctx, {
  sessionToken,
})

const result = await admin.graphql(
  `#graphql
    query Shop {
      shop { id name }
    }
  `,
  { variables: {} },
)
```

The component verifies the token, exchanges it for an offline credential, and
keeps access and refresh tokens encrypted. The returned session contains shop,
scope, and expiry metadata only.

`result` preserves GraphQL data, GraphQL errors, request metadata, API version,
cost, and throttle information. Use Shopify's GraphQL codegen preset for typed
operations; see the template's `.graphqlrc.ts` and `npm run shopify:codegen`.

### Background Admin work

There is no incoming Shopify request for a scheduled job or server workflow.
Authorize the shop in your own data model first, then use:

```ts
const { admin } = await shopify.unauthenticated.admin(ctx, store.shopDomain)
```

Never pass a browser-supplied shop domain directly. The parent app owns users,
memberships, and authorization; the component cannot inspect the parent app's
`ctx.auth`.

### Installation and sessions

Use the read-only installation snapshot for current granted and missing scopes:

```ts
const installation = await shopify.installation.snapshot(ctx, shopDomain)
// { installed, scopes, missingScopes, accessTokenExpiresAt, refreshTokenExpiresAt }
```

`sessionStorage` is the Shopify-compatible credential adapter:

```ts
const session = await shopify.sessionStorage.findSessionByShop(ctx, shopDomain)
const byId = await shopify.sessionStorage.loadSession(ctx, `offline_${shopDomain}`)
await shopify.sessionStorage.deleteSessionsForShop(ctx, shopDomain)
```

Sessions are sanitized. Credentials never cross the component boundary.
Deleting a session removes local credentials; it does not uninstall the app
from Shopify.

### Webhooks

The component verifies exact raw request bytes, persists accepted deliveries,
deduplicates by webhook ID, retries app callbacks, and records terminal
failures. The consuming app owns HTTP paths and business handlers.

Use one explicit endpoint per Shopify topic and a shared route helper. The
starter registers:

```text
/webhooks/app/uninstalled
/webhooks/app/scopes-update
/webhooks/customers/data-request
/webhooks/customers/redact
/webhooks/shop/redact
```

After authentication, accept the delivery with an internal Convex handler:

```ts
const delivery = await shopify.authenticate.webhook(ctx, request)

await shopify.webhooks.accept(ctx, delivery, {
  handler: internal.webhooks.appUninstalled,
  deduplicate: true,
})
```

`app/scopes_update` automatically replaces the component's stored granted
scope set. `app/uninstalled` automatically removes component credentials. App
handlers remain responsible for memberships, domain data, and privacy work.
All webhook handlers must be idempotent.

### Credential rotation

Rotate encryption keys through the operator-only action:

```ts
await shopify.operations.credentials.rotate(ctx, {
  cursor: null,
  batchSize: 25,
})
```

Continue with the returned cursor until `isDone` is true. Keep old keys in the
rotation keyring until every stored row has been migrated.

### Partner GraphQL

Partner API access is separate from shop credentials:

```ts
import { createShopifyPartnerClient } from '@convex-dev/shopify/partner'

const partner = createShopifyPartnerClient(components.shopify)
const result = await partner.graphql(ctx, { document, variables })
```

The package provides Admin GraphQL and Partner GraphQL. It does not provide an
Admin REST client.

## Template commands

From a generated app:

```sh
npm run dev                 # Convex + Vite development
npm run setup               # link Shopify/Convex and configure secrets
npm run config:check        # validate TOML against runtime scopes/version
npm run shopify:codegen     # generate Admin GraphQL types
npm test
npm run typecheck
npm run lint
npm run build
```

For a reviewed production release, deploy Convex, publish the SPA with
`npm run publish:static`, update the named Shopify production configuration,
and smoke-test installation, deep links, scope updates, uninstall, and privacy
webhooks. See [`template/docs/OPERATIONS.md`](template/docs/OPERATIONS.md).

## Boundaries

The component owns Shopify protocol and credential state. The application owns
users, authorization, domain tables, HTTP route registration, and business
effects. Do not add TanStack server functions, SSR, or a second backend to the
default template.

More detail:

- [`CONTRACT.md`](CONTRACT.md): supported API and ownership contract.
- [`ENVIRONMENT.md`](ENVIRONMENT.md): environment variables and secrets.
- [`SECURITY.md`](SECURITY.md): trust boundaries and credential handling.
- [`template/README.md`](template/README.md): starter-specific quickstart.
