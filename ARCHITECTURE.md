# Architecture

## One backend: Convex

The starter uses TanStack Start as a client-side SPA. Convex is the backend:

- `convex/http.ts` contains public HTTP callbacks such as auth and webhooks.
- Convex queries read application data.
- Convex mutations write application data.
- Convex actions perform external I/O such as Shopify Admin calls.
- Convex scheduled functions handle background work.

Do not add TanStack server functions, SSR loaders, or a second server to the
default template.

## Component boundary

The Shopify component owns protocol and credential state:

- session-token verification and offline-token exchange;
- encrypted access and refresh tokens;
- token refresh and Admin GraphQL transport;
- webhook HMAC verification and durable delivery;
- automatic scope-update and uninstall projections;
- encryption-key rotation.

The parent app owns everything specific to the product:

- users, memberships, roles, and tenant authorization;
- stores and domain tables;
- HTTP URL registration;
- webhook business handlers;
- privacy export and deletion rules.

Components cannot inspect the parent app's `ctx.auth`, so every background
workflow must resolve and authorize its shop in the parent app first.

## Request flows

An embedded request sends its App Bridge session token to a Convex action. The
component verifies it and returns a shop-scoped Admin client backed by an
encrypted offline credential.

A background job resolves an authorized shop from app-owned data and calls
`unauthenticated.admin`.

A webhook reaches an app-owned topic-specific Convex HTTP route. The route
authenticates the exact raw request, submits it to `webhooks.accept`, and
returns after durable acceptance. The component deduplicates, applies its own
lifecycle state changes, retries the app callback, and records terminal
failures.

## Static hosting

Convex HTTP routes are registered before the static-hosting catch-all. Static
hosting serves built assets and falls back to `index.html` for client-side deep
links. This keeps Shopify auth, JWKS, and webhook URLs stable while allowing
normal SPA navigation.
