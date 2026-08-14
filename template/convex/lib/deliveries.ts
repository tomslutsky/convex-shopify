import { v } from 'convex/values'
import type { MutationCtx } from '../_generated/server'

export const webhookTopics = [
  'app/uninstalled',
  'customers/data_request',
  'customers/redact',
  'shop/redact',
] as const

export type WebhookTopic = (typeof webhookTopics)[number]

const webhookPolicies: Record<WebhookTopic, { deduplicate: boolean }> = {
  'app/uninstalled': { deduplicate: true },
  'customers/data_request': { deduplicate: true },
  'customers/redact': { deduplicate: true },
  'shop/redact': { deduplicate: true },
}

export const webhookTopicValidator = v.union(...webhookTopics.map((topic) => v.literal(topic)))

export type WebhookDelivery = {
  webhookId: string
  shopDomain: string
  topic: WebhookTopic
  payload: unknown
}

export type WebhookOutcome =
  | { status: 'processed' }
  | { status: 'action_required'; requirement: string }

export type WebhookHandler = (
  ctx: MutationCtx,
  delivery: WebhookDelivery,
) => WebhookOutcome | Promise<WebhookOutcome>

const shopifyTopicMap = {
  APP_UNINSTALLED: 'app/uninstalled',
  CUSTOMERS_DATA_REQUEST: 'customers/data_request',
  CUSTOMERS_REDACT: 'customers/redact',
  SHOP_REDACT: 'shop/redact',
} satisfies Record<string, WebhookTopic>

export function toWebhookTopic(shopifyTopic: string): WebhookTopic | null {
  return (shopifyTopicMap as Record<string, WebhookTopic>)[shopifyTopic] ?? null
}

export function shouldDeduplicateWebhook(topic: WebhookTopic): boolean {
  return webhookPolicies[topic].deduplicate
}
