import shopifyComponent from '@convex-dev/shopify/convex.config'
import staticHosting from '@convex-dev/static-hosting/convex.config'
import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import { SHOPIFY_ADMIN_API_VERSION } from './lib/shopifyConfig'

const app = defineApp({
  env: {
    APP_AUTH_PRIVATE_JWK: v.optional(v.string()),
    APP_AUTH_PUBLIC_JWK: v.optional(v.string()),
    SHOPIFY_API_KEY: v.optional(v.string()),
    SHOPIFY_API_SECRET: v.optional(v.string()),
    SHOPIFY_TOKEN_ENCRYPTION_KEY: v.optional(v.string()),
    SHOPIFY_TOKEN_ENCRYPTION_KEYS: v.optional(v.string()),
    SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION: v.optional(v.string()),
    SHOPIFY_SCOPES: v.optional(v.string()),
  },
})

app.use(shopifyComponent, {
  env: {
    SHOPIFY_API_KEY: app.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: app.env.SHOPIFY_API_SECRET,
    SHOPIFY_TOKEN_ENCRYPTION_KEY: app.env.SHOPIFY_TOKEN_ENCRYPTION_KEY,
    SHOPIFY_TOKEN_ENCRYPTION_KEYS: app.env.SHOPIFY_TOKEN_ENCRYPTION_KEYS,
    SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION: app.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION,
    SHOPIFY_API_VERSION: SHOPIFY_ADMIN_API_VERSION,
    SHOPIFY_SCOPES: app.env.SHOPIFY_SCOPES,
  },
})
app.use(staticHosting)

export default app
