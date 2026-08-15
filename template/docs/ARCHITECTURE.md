# App architecture

## Runtime

The frontend is a TanStack Start SPA. Convex is the only backend.

| Need | Put it in |
| --- | --- |
| Browser UI and client routing | `src/` |
| Public HTTP callback | `convex/http.ts` |
| Database read | Convex query |
| Database write | Convex mutation |
| Shopify or other external I/O | Convex action |
| Retryable/background work | Convex function or scheduler |

Do not add TanStack server functions, SSR, or a second API server.

## Ownership

`@convex-dev/shopify` owns Shopify authentication, encrypted offline
credentials, token refresh, Admin GraphQL, webhook verification, durable webhook
delivery, and component lifecycle state.

This app owns users, stores, memberships, authorization, domain data, HTTP
routes, webhook handlers, and privacy behavior. The component cannot see this
app's `ctx.auth`.

## Webhook flow

Each Shopify topic has its own public URL. The shared route helper authenticates
the exact raw request and checks that the topic matches the URL. The component
then:

1. deduplicates by Shopify webhook ID;
2. applies `app/scopes_update` or `app/uninstalled` to component state;
3. stores and queues the delivery;
4. retries the app-owned internal handler.

Handlers must be idempotent. Uninstall cleanup for app-owned memberships and
domain data remains the app's responsibility.

## Authorization

Never trust a shop, user ID, or store ID from the browser. Resolve the store
from the authenticated app identity and check membership server-side before
calling Shopify or reading tenant data.

The compliance handlers are intentionally placeholders. Implement bounded,
retry-safe export and deletion for every app-owned table before using the app
with real customer or merchant data.
