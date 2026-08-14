import { ShopifyWebhookAuthenticationError } from '@convex-dev/shopify'
import { shouldDeduplicateWebhook, toWebhookTopic } from './deliveries'
import { shopify } from './shopifyApp'
import type { ShopifyWebhookHandler } from '@convex-dev/shopify'
import type { ActionCtx } from '../_generated/server'
import type { WebhookTopic } from './deliveries'

export async function receiveShopifyWebhook(
  ctx: ActionCtx,
  request: Request,
  expectedTopic: WebhookTopic,
  handler: ShopifyWebhookHandler,
): Promise<Response> {
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
  if (topic !== expectedTopic) return new Response('Webhook topic does not match endpoint', { status: 400 })
  const result = await shopify.webhooks.accept(ctx, { ...webhook, topic }, {
    handler,
    deduplicate: shouldDeduplicateWebhook(topic),
  })
  if (result.status === 'rejected') return new Response('Invalid Shopify lifecycle payload', { status: 400 })
  return new Response(null, { status: 200 })
}
