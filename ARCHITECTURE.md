# Architecture and ownership

This repository is the reusable Shopify platform boundary extracted from an
application integration. It is a Convex component, not a complete Shopify app.

## Component-owned behavior

- Verify Shopify Admin session tokens and exchange them for expiring offline
  credentials.
- Encrypt access and refresh tokens at rest in the isolated `offlineSessions`
  component table.
- Refresh expiring credentials, serialize refresh races with generation checks,
  and retry an Admin request once after a credential rejection.
- Send Shopify Admin GraphQL operations and return the response envelope plus
  request, API-version, cost, and throttle metadata.
- Verify webhook HMACs over the exact request bytes before any JSON parsing.
- Return sanitized session metadata without exposing credentials.
- Rotate encryption keys in bounded, resumable batches.
- Optionally call the Shopify Partner GraphQL API using organization-owned
  credentials that are never persisted.

## Parent-application behavior

The consuming app authenticates its own users, derives their authorized store
server-side, mounts HTTP routes, persists webhook delivery IDs, implements
compliance processing, and owns every domain table and business invariant.
Component functions cannot access parent `ctx.auth`; app wrappers must perform
authorization before passing a shop domain across the boundary.

The component intentionally contains no merchant roles, billing plans,
application workflows, document generation, catalog matching, notifications,
retention policy, or application-data migration logic.

## Request flow

An embedded request obtains an App Bridge session token. An app action calls
`authenticate.admin`, which verifies the token, exchanges or refreshes the
offline credentials, and returns a sanitized session and Admin client. For a
background job, app code first authorizes a store record and then calls
`unauthenticated.admin`. A webhook reaches an app-owned HTTP route, which calls
`authenticate.webhook`, deduplicates the verified delivery, and handles the
topic using app-owned data.
