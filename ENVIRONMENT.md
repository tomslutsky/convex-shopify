# Environment reference

All values are Convex deployment environment variables. None may use a
client-visible prefix such as `VITE_`.

| Name | Required | Purpose |
| --- | --- | --- |
| `SHOPIFY_API_KEY` | Yes | Shopify app client ID used as session-token audience and token-exchange client ID. |
| `SHOPIFY_API_SECRET` | Yes | Shopify app secret used for session-token and webhook verification and token exchange. |
| `SHOPIFY_TOKEN_ENCRYPTION_KEY` | Yes | Strict base64 encoding of the active 32-byte AES key. |
| `SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION` | Yes | Stable label for the active encryption key, such as `v1`. |
| `SHOPIFY_TOKEN_ENCRYPTION_KEYS` | During rotation | JSON object mapping prior version labels to base64 keys. It must not repeat the active version. |
| `SHOPIFY_API_VERSION` | Recommended | Admin GraphQL API version; defaults to the package version if omitted. Keep it aligned with consumer codegen. |
| `SHOPIFY_SCOPES` | Yes | Comma-separated required scopes, sourced from the app's shared scope configuration. |
| `SHOPIFY_PARTNER_ORGANIZATION_ID` | Partner API only | Shopify Partner organization ID. |
| `SHOPIFY_PARTNER_ACCESS_TOKEN` | Partner API only | Partner API access token. |
| `SHOPIFY_PARTNER_API_VERSION` | Partner API only | Optional Partner GraphQL API override. |

Generate an encryption key with `npx convex-shopify generate-key`. It writes
`.shopify-token-encryption-key` with owner-only permissions and never prints the
secret or a shell-history command containing it. Transfer it through the
interactive deployment-secret prompt, then securely remove the file.
