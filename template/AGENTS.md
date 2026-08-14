# Shopify app agent guidance

- Use the `shopify-dev-mcp` server for Shopify app work: Admin API schemas and operations, Shopify configuration, webhooks, App Bridge, and Polaris web components.
- Consult its current Shopify documentation and validation tools before introducing or changing Shopify-specific APIs. Do not use it for generic React, TanStack, Convex, or repository maintenance work.
- Keep TanStack Start in SPA mode. Do not add TanStack server functions or SSR; implement backend and HTTP behavior with Convex functions and `convex/http.ts`.
- Never place Shopify API secrets, access tokens, or merchant data in MCP configuration or prompts.
