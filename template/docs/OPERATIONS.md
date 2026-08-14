# Manual smoke test

Automated checks intentionally require no live service. Before releasing an app:

1. Copy `shopify.app.production.example.toml` only when preparing production. Link a development-only Shopify configuration and a fresh Convex development project.
2. Set all environment values and confirm `npm run setup:check` succeeds.
3. Run `shopify app dev --config development` and install from Shopify Admin.
4. Confirm the home page displays the correct shop identity.
5. Confirm a second store cannot access the first store's IDs.
6. Send a signed test webhook twice with the same webhook ID and confirm only one delivery row exists.
7. Uninstall and confirm component credentials and memberships disappear.
8. Implement and exercise customer data request, customer redaction, and shop redaction for every app-owned domain table.

Do not point the development configuration at production. Production environment creation, secrets, URL changes, and deployment require a separate reviewed runbook.
