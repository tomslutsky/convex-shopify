# Component contract

`@convex-dev/shopify` is a Convex component for the Shopify parts of an app.
It is intentionally not a complete application framework.

## Setup

```ts
import { shopifyApp } from '@convex-dev/shopify'
import { components } from './_generated/api'

export const shopify = shopifyApp({ component: components.shopify })
```

The component requires the Shopify API credentials, encryption key, API
version, and required scopes listed in [`ENVIRONMENT.md`](ENVIRONMENT.md).

## Supported facade

### `authenticate.admin(ctx, { sessionToken })`

Verifies an embedded Shopify session token, exchanges or refreshes the offline
credential, and returns:

```ts
{
  admin: ShopifyAdminContext
  session: ShopifySession
  shopifyUserId: string
}
```

`admin.graphql(operation, { variables })` is the supported shop Admin API. The
session is sanitized and never contains access or refresh tokens.

### `unauthenticated.admin(ctx, shopDomain)`

Creates an Admin context for background work after the parent app has already
authorized the shop. “Unauthenticated” means there is no current Shopify
request; it is not an authorization bypass.

### `installation.snapshot(ctx, shopDomain)`

Returns component-owned installation facts:

```ts
{
  installed: boolean
  scopes: string[]
  missingScopes: string[]
  accessTokenExpiresAt: number | null
  refreshTokenExpiresAt: number | null
}
```

There is no public scope-reconciliation mutation. Verified Shopify scope
webhooks update this state automatically.

### `sessionStorage`

The Shopify-compatible storage adapter exposes:

- `loadSession(ctx, id)`
- `findSessionByShop(ctx, shopDomain)`
- `deleteSession(ctx, id)`
- `deleteSessionsForShop(ctx, shopDomain)`

These operations expose sanitized metadata only. The component stores encrypted
credentials in its isolated `offlineSessions` table.

### `authenticate.webhook(ctx, request)`

Reads the exact request bytes, verifies Shopify's HMAC, validates the shop
domain and required headers, parses JSON, and returns the verified delivery:

```ts
{
  shop: string
  topic: string
  payload: unknown
  webhookId: string
  rawBody: ArrayBuffer
  session: ShopifySession | null
}
```

### `webhooks.accept(ctx, delivery, options)`

Persists and optionally deduplicates the verified delivery, applies component
lifecycle projections, and invokes an app-owned internal mutation through the
durable workpool.

Lifecycle projections are automatic and idempotent:

- `APP_SCOPES_UPDATE` replaces granted scopes with Shopify's current set.
- `APP_UNINSTALLED` removes component-owned credentials.

The application callback still owns memberships, domain data, privacy exports,
and deletion policies.

### `operations.credentials.rotate(ctx, options)`

Re-encrypts stored credentials in bounded pages. Pass the returned cursor back
until `isDone` is true. Restrict this action to operators.

### Partner API

`@convex-dev/shopify/partner` provides Partner GraphQL using organization
credentials. Partner credentials are independent of shop installations and are
not persisted by the component.

## Ownership

The component owns Shopify authentication, credential encryption, token refresh,
Admin transport, webhook verification, webhook delivery state, lifecycle
projection, and key rotation.

The parent app owns its users, authorization, HTTP routes, topic handlers,
membership and domain tables, privacy behavior, and business invariants. The
component cannot access the parent app's `ctx.auth`.

## Non-goals

The package does not provide Admin REST, merchant roles, billing, domain data
models, SSR, TanStack server functions, or an application server.
