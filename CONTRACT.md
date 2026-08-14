# @convex-dev/shopify implemented contract

The supported API deliberately follows Shopify's official server libraries.
Consumers create a Shopify app object, authenticate incoming Admin or webhook
requests, and receive a shop-scoped Admin context backed by a stored offline
session.

## Ownership boundary

The component owns encrypted offline access and refresh tokens, normalized
scopes, token expiry and refresh, Admin GraphQL transport, Shopify request
verification, and encryption-key rotation. Credentials never cross the
component boundary.

The parent Convex app owns application-user authentication, shop authorization,
HTTP routing, webhook topic routing and business handlers, and all business data. A
component cannot inspect the parent app's `ctx.auth`.

## Supported facade

```ts
const shopify = shopifyApp({ component: components.shopify })
```

It exposes:

- `authenticate.admin(ctx, { sessionToken })`
- `authenticate.webhook(ctx, request)`
- `unauthenticated.admin(ctx, shop)`
- `sessionStorage.loadSession(ctx, id)`
- `sessionStorage.findSessionByShop(ctx, shop)`
- `sessionStorage.deleteSession(ctx, id)`
- `sessionStorage.deleteSessionsForShop(ctx, shop)`
- `operations.credentials.rotate(ctx, options)`

Both Admin entry points return `{ admin, session }`. The embedded entry point
also returns the verified Shopify user subject as `shopifyUserId`. The returned
`session` follows Shopify's offline-session vocabulary but is sanitized: it
contains its deterministic ID, shop, scopes and expiries, never access or
refresh tokens. Query-loaded sessions do not claim a time-dependent lifecycle
status; Admin actions perform authoritative expiry classification.

`admin.graphql(...)` with an inline `#graphql` string uses Shopify's official codegen
preset and generated `AdminQueries`/`AdminMutations` module augmentation to
infer results and variables. Variables must be serializable object records.
Results preserve `data`, GraphQL envelope errors, and
request/API-version/cost/throttle metadata. Generated operation types are not
runtime response validation. `admin.graphqlDocument(...)` is the explicit
advanced `TypedDocumentNode` escape hatch.

`unauthenticated.admin` matches Shopify's name: there is no current incoming
Shopify Admin request. It is not an authorization bypass. The shop argument
must come from an app-owned, authenticated and authorized server workflow.

`authenticate.webhook` reads the exact request bytes, verifies HMAC before
parsing JSON or trusting metadata, and returns `shop`, a Shopify-normalized
topic such as `APP_UNINSTALLED`, `webhookId`,
`payload`, `rawBody`, and a nullable stored session. `webhooks.accept` persists
the verified delivery, deduplicates it when requested, and invokes an app-owned
internal mutation through a durable retrying workpool. The component records
terminal failures and exposes bounded inspection and replay operations.

`shopifyApp` is the supported application facade. Lower-level exports exist for
advanced integration and testing, but are not a second authorization layer.

## Raw component surface

Raw references are advanced implementation primitives:

- `auth.exchangeSessionToken` and `auth.verifySessionToken` are actions.
- `auth.getState` is an authoritative wall-clock action.
- `auth.snapshot` is a deterministic query of stored facts.
- `admin.gql` is the structured Admin GraphQL transport.
- `install.uninstall` and `install.reencrypt` manage
  component-owned credentials.
- `webhooks.verifyRequestHmac` verifies exact raw bytes only.
- `partner.gql` uses organization credentials and persists no shop session.

Every registered function has argument and return validators. There is no
Admin REST function.

## Offline session lifecycle

Embedded session tokens are verified for HS256, audience, time claims, issuer,
HTTPS destination, exact shop relationship, supported `*.myshopify.com` domain,
and Shopify user subject. Token exchange provisions an expiring offline session.

Admin calls refresh access tokens 60 seconds before expiry. Refresh requests
time out after 10 seconds and retry the same refresh token at most three times
for network errors, timeouts, `429`, and `5xx`, using bounded exponential jitter
and bounded `Retry-After`. Successful access/refresh pairs persist atomically
with a credential-generation compare-and-swap. An Admin `401` forces one refresh
and exactly one retry with the new access token.

Expected missing-session, scope-change, and reauthorization conditions are
serializable session states or structured `ConvexError.data`. Transport failures
also use stable serializable error data; callers never rely on `instanceof`
across the Convex boundary.

## Storage and upgrades

The component owns an `offlineSessions` table with one encrypted Shopify
offline session per shop. Parent applications must not read or write this table
directly. Package upgrades and credential-key rotation are documented in
`VERSIONING.md`; application-specific data migrations remain app-owned.

## Package contract

The ESM package exports the root facade and types, separate `./partner` and
`./pagination` entry points, component config and generated API entry points,
the `./test` registration helper, and the `convex-shopify` CLI. The public
monorepo currently keeps the package unpublished at version `0.2.0` via
`private: true`; npm publication and licensing remain explicit release decisions.
