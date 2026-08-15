# Release runbook

Automated checks do not deploy or modify a live environment.

1. Run `npm run setup:check`, `npm run config:check`, tests, typecheck, lint,
   and production build.
2. Deploy the selected Convex deployment with `npm run deploy:convex`.
3. Publish the SPA with `npm run publish:static`.
4. Copy `shopify.app.production.example.toml` to the ignored
   `shopify.app.production.toml` and set `application_url` to the resulting
   Convex hosted URL.
5. Verify `/auth/shopify`, `/auth/shopify/jwks`, and every topic-specific
   `/webhooks/...` path use that same origin.
6. Run `npm run config:check`, then link and deploy the named Shopify
   production configuration.
7. Install the app in a development or review store and verify the embedded
   home page, shop identity, and a second-store authorization boundary.
8. Refresh a nested SPA URL directly to verify the static-hosting fallback.
9. Exercise a scope change, repeated webhook ID, uninstall, and all compliance
   topics. Confirm scope state, credential removal, retries, and app-owned
   cleanup.

Do not point development configuration at production. Do not publish until the
compliance handlers cover every app-owned customer and merchant record.
