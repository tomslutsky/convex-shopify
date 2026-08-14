import { registerStaticRoutes } from '@convex-dev/static-hosting'
import { httpRouter } from 'convex/server'
import { components, internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { corsHeaders, jsonResponse, parseJwk, signAppToken } from './lib/appAuth'
import { receiveShopifyWebhook } from './lib/shopifyWebhookRoute'
import { shopify } from './lib/shopifyApp'

const http = httpRouter()

http.route({
  path: '/auth/shopify',
  method: 'OPTIONS',
  handler: httpAction(() => Promise.resolve(new Response(null, { status: 204, headers: corsHeaders }))),
})

http.route({
  path: '/auth/shopify',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Shopify session token required' }, 401)
    try {
      const { session, shopifyUserId } = await shopify.authenticate.admin(ctx, { sessionToken: authorization.slice(7) })
      if (session.missingScopes.length > 0) {
        return jsonResponse({ error: 'Shopify scopes must be updated', code: 'missing_scopes', missingScopes: session.missingScopes }, 403)
      }
      return jsonResponse({ token: await signAppToken(session.shop, shopifyUserId) })
    } catch (error) {
      console.error('Shopify authentication failed', error instanceof Error ? error.message : 'Unknown error')
      return jsonResponse({ error: 'Shopify authentication failed' }, 401)
    }
  }),
})

http.route({
  path: '/auth/shopify/jwks',
  method: 'GET',
  handler: httpAction(() => {
    const key = parseJwk('APP_AUTH_PUBLIC_JWK')
    return Promise.resolve(jsonResponse({ keys: [{ ...key, kid: key.kid ?? 'app-auth-1', use: 'sig', alg: 'ES256' }] }))
  }),
})

const webhookRoutes = [
  ['/webhooks/app/uninstalled', 'app/uninstalled', internal.webhooks.appUninstalled],
  ['/webhooks/app/scopes-update', 'app/scopes_update', internal.webhooks.appScopesUpdated],
  ['/webhooks/customers/data-request', 'customers/data_request', internal.webhooks.customersDataRequest],
  ['/webhooks/customers/redact', 'customers/redact', internal.webhooks.customersRedact],
  ['/webhooks/shop/redact', 'shop/redact', internal.webhooks.shopRedact],
] as const

for (const [path, topic, handler] of webhookRoutes) {
  http.route({
    path,
    method: 'POST',
    handler: httpAction((ctx, request) => receiveShopifyWebhook(ctx, request, topic, handler)),
  })
}

// Keep the stable Shopify auth/webhook routes above at the root. This final
// catch-all serves static assets and falls back to index.html for SPA routes.
registerStaticRoutes(http, components.staticHosting)

export default http
