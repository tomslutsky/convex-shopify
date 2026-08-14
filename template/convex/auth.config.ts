import type { AuthConfig } from 'convex/server'

const issuer = process.env.CONVEX_SITE_URL!

export default {
  providers: [{
    type: 'customJwt',
    issuer,
    jwks: `${issuer}/auth/shopify/jwks`,
    algorithm: 'ES256',
    applicationID: 'convex',
  }],
} satisfies AuthConfig
