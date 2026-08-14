# Release runbook

Automated checks intentionally require no live service. For a reviewed release:

1. Confirm the selected Convex deployment and secrets, run `npm run setup:check`, then deploy the backend with `npm run deploy:convex`.
2. Publish the SPA with `npm run publish:static`. Verify the root and a client-side deep link at `https://<production-deployment-name>.convex.site`; both should render the app.
3. Set `application_url` in the ignored `shopify.app.production.toml` to that hosted URL. Verify `/auth/shopify`, `/auth/shopify/jwks`, and every topic-specific `/webhooks/...` path remain on the same origin, then run `npm run config:check` and deploy the linked production configuration with Shopify CLI.
4. Install or reopen the app from Shopify Admin. Confirm the embedded home page displays the correct shop identity and a second store cannot access the first store's IDs.
5. Open a nested SPA URL directly and refresh it to verify the static-hosting fallback.
6. Change an approved scope in a development/review installation. Confirm `app/scopes_update` is delivered and the component snapshot reports the normalized current scopes and correct missing scopes.
7. Send a signed webhook twice with the same webhook ID and confirm it is handled once. Exercise `app/uninstalled` and verify component credentials and memberships disappear.
8. Implement and exercise customer data request, customer redaction, and shop redaction for every app-owned domain table before storing merchant or customer data.

Do not point the development configuration at production. Production environment creation, secrets, URL changes, and deployment require a separate reviewed runbook.
