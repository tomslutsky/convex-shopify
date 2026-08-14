import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import {
  handleCustomerDataRequest,
  handleCustomerRedaction,
  handleShopRedaction,
} from './lib/compliance'
import { webhookTopicValidator } from './lib/deliveries'
import { uninstallStore } from './uninstall'
import type { WebhookHandler, WebhookTopic } from './lib/deliveries'

/** Application-owned routing. Delivery reliability lives in the Shopify component. */
const handlers: Record<WebhookTopic, WebhookHandler> = {
  'app/uninstalled': uninstallStore,
  'customers/data_request': handleCustomerDataRequest,
  'customers/redact': handleCustomerRedaction,
  'shop/redact': handleShopRedaction,
}

export const process = internalMutation({
  args: {
    webhookId: v.string(),
    shopDomain: v.string(),
    topic: webhookTopicValidator,
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const outcome = await handlers[args.topic](ctx, args)
    if (outcome.status === 'action_required') {
      console.warn('Webhook requires app-owned handling', {
        webhookId: args.webhookId,
        topic: args.topic,
        shopDomain: args.shopDomain,
        requirement: outcome.requirement,
      })
    }
    return null
  },
})
