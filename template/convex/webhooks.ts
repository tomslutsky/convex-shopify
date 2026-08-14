import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import {
  handleCustomerDataRequest,
  handleCustomerRedaction,
  handleShopRedaction,
} from './lib/compliance'
import { uninstallStore } from './uninstall'
import type { WebhookHandler, WebhookTopic } from './lib/deliveries'

const scopesUpdated: WebhookHandler = () => ({ status: 'processed' })

/** Application-owned routing. Delivery reliability lives in the Shopify component. */
const handlers: Record<WebhookTopic, WebhookHandler> = {
  'app/uninstalled': uninstallStore,
  'app/scopes_update': scopesUpdated,
  'customers/data_request': handleCustomerDataRequest,
  'customers/redact': handleCustomerRedaction,
  'shop/redact': handleShopRedaction,
}

function defineWebhookHandler<TTopic extends WebhookTopic>(topic: TTopic) {
  return internalMutation({
    args: {
      webhookId: v.string(),
      shopDomain: v.string(),
      topic: v.literal(topic),
      payload: v.any(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const outcome = await handlers[topic](ctx, args)
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
}

export const appUninstalled = defineWebhookHandler('app/uninstalled')
export const appScopesUpdated = defineWebhookHandler('app/scopes_update')
export const customersDataRequest = defineWebhookHandler('customers/data_request')
export const customersRedact = defineWebhookHandler('customers/redact')
export const shopRedact = defineWebhookHandler('shop/redact')
