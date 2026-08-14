# Architecture and ownership

## Request flow

1. App Bridge obtains a Shopify session token inside Shopify Admin.
2. `POST /auth/shopify` asks the component to verify it and exchange it for an encrypted offline credential.
3. The app signs a five-minute ES256 JWT containing the verified shop domain and Shopify user subject.
4. Convex verifies that JWT against `/auth/shopify/jwks`; `stores.ensure` derives identity and store scope from `ctx.auth`.
5. App actions resolve the authorized shop server-side before calling the component's Admin GraphQL client.

## Ownership contract

The `convex-shopify` dependency owns Shopify token verification/exchange, encrypted credential lifecycle, Admin transport, HMAC verification, sanitized session metadata, and key rotation. This application owns membership, roles, tenant authorization, webhook delivery state, uninstall effects outside the component, and every domain/compliance decision.

The starter contains no business-domain model. Add tables only when their ownership and deletion contract is understood. For every public function, derive identity via `ctx.auth`; verify the referenced row belongs to that identity's store; return not-found for cross-store identifiers.

`convex/lib/compliance.ts` exposes three deliberately unimplemented, app-owned handler contracts. Verified compliance payloads are not stored by the generic starter; replace each stub with bounded, retry-safe domain export/deletion before handling real data.

## Frontend boundary

TanStack Start stays in SPA mode and Convex owns the backend. Do not add TanStack server functions, server routes, SSR loaders, or another application server to the default template. Add public HTTP callbacks in `convex/http.ts`; add application reads, writes, external-I/O actions, file storage, and scheduled work as Convex functions.

Static hosting uses app-owned root routing because Shopify auth, JWKS, and webhook URLs are stable root paths. Exact Convex HTTP routes are registered first, then the static-hosting catch-all serves assets and returns `index.html` for client-side deep links.

## Deliberately excluded

There are no legacy credential migrations, commerce workflows, billing plans, background-workflow frameworks, rate limiters, AI providers, document processing, or domain-specific deletion policies. Optional migration work belongs in application-specific documentation, not this baseline.
