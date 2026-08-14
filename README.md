# @convex-dev/shopify

A packaged Convex component for Shopify apps, intentionally shaped like
Shopify's official React Router server package. It provides Shopify request
authentication, encrypted expiring offline sessions, Admin GraphQL, webhook
authentication, and operational credential rotation.

The package is private at `0.1.0` while developed in this repository. It can be
packed and consumed locally but must not be published yet.

The canonical application starter lives in the `template` npm workspace. A
single root install links it to this component and `npm run verify` validates
the component package, packed-consumer boundary, and template together.

## Install the component

Until an intentional package-publication review, install from the private
GitHub repository using a verified tag or immutable commit:

```sh
npm install 'git+ssh://git@github.com/OWNER/convex-shopify.git#v0.1.0'
```

The installing developer or CI runner must have SSH access to the private
repository. The repository commits verified `dist/` artifacts, so installation
does not depend on a sibling checkout or a Convex deployment. See
`VERSIONING.md` for the distribution contract.

```ts
// convex/convex.config.ts
import { defineApp } from 'convex/server'
import shopify from '@convex-dev/shopify/convex.config.js'

const app = defineApp()
app.use(shopify, { name: 'shopify' })
export default app
```

The facade accepts the generated component reference, so custom mount names are
fully typed:

```ts
// convex/shopify.ts
import { shopifyApp } from '@convex-dev/shopify'
import { components } from './_generated/api'

const shopify = shopifyApp({ component: components.shopify })

export default shopify
export const authenticate = shopify.authenticate
export const unauthenticated = shopify.unauthenticated
export const sessionStorage = shopify.sessionStorage
```

Configure `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
`SHOPIFY_TOKEN_ENCRYPTION_KEY`, `SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION`,
`SHOPIFY_TOKEN_ENCRYPTION_KEYS`, `SHOPIFY_API_VERSION`, and `SHOPIFY_SCOPES` on
the Convex deployment. Never expose credentials through `VITE_` variables.

The active encryption key must be strict base64 encoding of exactly 32 bytes.
`SHOPIFY_TOKEN_ENCRYPTION_KEYS` is a JSON map containing previous versions only;
the active version must not also appear there.

## Authenticate an embedded Admin request

This mirrors Shopify's `authenticate.admin(request)` flow while adapting the
incoming token to a Convex action:

```ts
const { admin, session, shopifyUserId } = await authenticate.admin(ctx, {
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

`session.shop` is the authenticated `*.myshopify.com` domain. The session is an
offline session and is sanitized; access and refresh tokens remain encrypted
inside the component.

The result preserves partial `data` plus GraphQL `errors`, along with request
ID, actual API version, HTTP status, query cost, and throttle status. Mutation
payload `userErrors` remain typed application data, not transport errors.

## Offline and background workflows

Shopify calls workflows without a current Shopify Admin request
“unauthenticated.” The application must still authorize or otherwise trust the
shop before passing it here:

```ts
const store = await ctx.runQuery(internal.stores.authorizedForJob, { storeId })

const { admin, session } = await unauthenticated.admin(ctx, store.shopDomain)

await admin.graphql(
  `#graphql
    query SyncProducts($first: Int!) {
      products(first: $first) { nodes { id title } }
    }
  `,
  { variables: { first: 100 } },
)
```

Never pass a browser-provided shop domain directly to
`unauthenticated.admin`. Convex components cannot access parent `ctx.auth`; the
parent app must derive the shop from an authenticated membership, an app-owned
store record, a scheduled job record, or a verified webhook.

The component refreshes expiring credentials before the Admin request. A `401`
forces one refresh and one retry with the new credential. It does not retry
arbitrary GraphQL mutations after ambiguous network or server failures.

## Session storage

The facade uses Shopify's storage vocabulary:

```ts
const session = await sessionStorage.findSessionByShop(ctx, shop)
const byId = await sessionStorage.loadSession(ctx, `offline_${shop}`)

await sessionStorage.deleteSessionsForShop(ctx, shop)
```

Returned sessions expose `id`, `shop`, `isOnline: false`, normalized scopes,
access/refresh expiries, and missing scopes. They never expose credentials. A
query-loaded session intentionally has no time-dependent `ready` status; Admin
actions perform authoritative refresh and expiry classification.

`deleteSessionsForShop` forgets component credentials. It does not remotely
uninstall the Shopify app.

## Webhooks

Use the native `Request`, as in Shopify's template:

```ts
try {
  const { shop, topic, payload, webhookId, rawBody, session } =
    await shopify.authenticate.webhook(ctx, request)

  await shopify.webhooks.accept(ctx, { shop, topic, payload, webhookId, rawBody, session }, {
    handler: internal.webhooks.process,
    deduplicate: true,
  })
  return new Response(null, { status: 200 })
} catch (error) {
  return new Response('Invalid Shopify webhook', { status: 401 })
}
```

HMAC is verified against exact raw bytes before JSON parsing or trusting shop,
topic, and webhook ID headers. Accepted deliveries are stored in the component,
processed through a retrying workpool, and retained for bounded failure
inspection and replay. Topic routing and handler idempotency remain app-owned.

## Session states and errors

Missing scopes and credential expiries are exposed as stored session facts. A
missing stored session is represented by `null` from session storage, or a
structured missing-session error when creating an Admin context. Creating an
Admin context is action-backed and performs authoritative lifecycle checks.

Transport and token failures throw `ConvexError` with serializable data:

```ts
const detail = shopifyComponentErrorData(error)
if (detail?.kind === 'transient_refresh_failure' && detail.retryable) {
  // Retry at a bounded application workflow boundary.
}
```

GraphQL operation typing ends at compile time. Validate important response
fields at runtime before using them in business invariants.

## Credential rotation

To rotate `v1` to `v2`:

1. Set the new active key and active version `v2`.
2. Put the old key in `SHOPIFY_TOKEN_ENCRYPTION_KEYS` as `v1`.
3. From an operator-only action, repeatedly call
   `shopify.operations.credentials.rotate(ctx, { cursor, batchSize: 25 })` and
   pass the opaque `nextCursor` unchanged until `isDone`.
4. Rerun from a null cursor and verify `migrated` is zero.
5. Remove historical keys only after no stored row uses them.

Batch sizes are bounded to `1..100`. Rotation pagination is stable and writes
use credential-generation preconditions.

## Partner API and REST policy

Partner API credentials belong to the developer organization, not a shop
session. Use the separate entry point:

```ts
import { createShopifyPartnerClient } from '@convex-dev/shopify/partner'

const partner = createShopifyPartnerClient(components.shopify)
const result = await partner.graphql(ctx, {
  document: ActiveSubscriptionDocument,
  variables: { appId, shopId },
})
```

The package exposes no Admin REST client. GraphQL Admin is the supported API.

## Shopify-style GraphQL codegen

Install Shopify's official preset and GraphQL Config in the consuming app:

```sh
npm install --save-dev @graphql-codegen/cli @shopify/api-codegen-preset graphql-config
```

Configure `.graphqlrc.ts`:

```ts
import { ApiType, shopifyApiProject } from '@shopify/api-codegen-preset'

const apiVersion = '2026-07'
const documents = ['./convex/**/*.{ts,tsx}']

export default {
  schema: `https://shopify.dev/admin-graphql-direct-proxy/${apiVersion}`,
  documents,
  projects: {
    default: shopifyApiProject({
      apiType: ApiType.Admin,
      apiVersion,
      documents,
      outputDir: './convex/types',
      module: '@convex-dev/shopify',
    }),
  },
}
```

Write operations as inline `#graphql` template strings and run
`graphql-codegen`, or `graphql-codegen --watch` during development. Generated
declarations augment this package's `AdminQueries` and `AdminMutations`;
consumers do not import generated documents.

Keep the config's `apiVersion` exactly aligned with the component runtime
`SHOPIFY_API_VERSION`. Update both together and regenerate before deploying a
new Shopify Admin API version.

`admin.graphql(...)` is the Shopify-template-shaped primary API.
`admin.graphqlDocument(...)` is an explicit advanced escape hatch for projects
that already use `TypedDocumentNode` codegen.

## Testing and packaging

```ts
import { register } from '@convex-dev/shopify/test'

const t = convexTest(schema, modules)
register(t, 'shopify')
```

Build order is component codegen, package build, then example typecheck:

```sh
npm run build
npm run typecheck:example
npm test
npm run pack:check
npm pack --dry-run
```

## Official references

- [Shopify React Router package](https://shopify.dev/docs/api/shopify-app-react-router/latest)
- [Authenticate Admin](https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin)
- [Shopify app template](https://github.com/Shopify/shopify-app-template-react-router)
- [Shopify Session model](https://github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/lib/session/session.ts)
- [Session tokens](https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens)
- [Token exchange](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange)
- [Expiring offline tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens)
- [Webhook verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries)
- [Convex component authoring](https://docs.convex.dev/components/authoring)

## Remaining release decisions

- Choose an open-source license; the repository currently establishes none.
- Remove `private: true` only during an intentional publication and licensing
  review. GitHub-only installation is the supported distribution path today.
- Establish package ownership, changelog, support policy, and Convex peer-version
  policy.
