# Security model

## Trust boundary

Shop domains supplied to `unauthenticated.admin` are trusted inputs from the
parent app. Never pass a browser-provided shop, user ID, or store ID directly.
Derive tenant scope from `ctx.auth` and app-owned membership records first.

`authenticate.admin` verifies Shopify's HS256 signature, audience, issuer,
destination, subject, expiry, and not-before claims. `authenticate.webhook`
verifies a constant-time HMAC comparison over exact raw bytes before parsing or
trusting payload data.

## Credential handling

Offline tokens are AES-256-GCM encrypted with a strict 32-byte key. The active
key version is stored with each ciphertext; previous keys are read only from
the configured rotation keyring. Tokens never cross the component boundary,
appear in sanitized sessions, or belong in client-visible environment values.

Use a secrets manager or an interactive deployment-secret prompt where
available. Avoid command-line values that would place secrets in shell history.
`convex-shopify generate-key` writes a mode-0600 file and does not print the
secret. Restrict operator actions that invoke credential rotation.

## Webhooks and GraphQL

The component authenticates a delivery but does not provide persistent
deduplication. Store Shopify's webhook ID in an app table before applying domain
writes. GraphQL operation types are compile-time assistance, not runtime
validation; validate fields used for authorization or financial invariants.

Report suspected vulnerabilities privately to the repository owner. A public
security contact has not yet been designated.
