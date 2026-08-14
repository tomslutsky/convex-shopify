import { ShopifyWebhookAuthenticationError } from '@convex-dev/shopify'
import { registerStaticRoutes } from '@convex-dev/static-hosting'
import { httpRouter } from 'convex/server'
import { components, internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { corsHeaders, jsonResponse, parseJwk, signAppToken } from './lib/appAuth'
import { shouldDeduplicateWebhook, toWebhookTopic } from './lib/deliveries'
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

http.route({
  path: '/webhooks/shopify',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let webhook
    try {
      webhook = await shopify.authenticate.webhook(ctx, request)
    } catch (error) {
      if (error instanceof ShopifyWebhookAuthenticationError) {
        if (error.reason === 'invalid_hmac') return new Response('Invalid webhook signature', { status: 401 })
        if (error.reason === 'invalid_json') return new Response('Invalid JSON', { status: 400 })
        if (error.reason === 'invalid_shop_domain') return new Response('Invalid shop domain', { status: 400 })
        return new Response('Missing webhook metadata', { status: 400 })
      }
      return new Response('Webhook authentication failed', { status: 500 })
    }
    const topic = toWebhookTopic(webhook.topic)
    if (!topic) return new Response('Unsupported webhook topic', { status: 400 })
    await shopify.webhooks.accept(ctx, { ...webhook, topic }, {
      handler: internal.webhooks.process,
      deduplicate: shouldDeduplicateWebhook(topic),
    })
    return new Response(null, { status: 200 })
  }),
})

// Keep the stable Shopify auth/webhook routes above at the root. This final
// catch-all serves static assets and falls back to index.html for SPA routes.
registerStaticRoutes(http, components.staticHosting)

export default http
