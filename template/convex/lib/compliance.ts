import type { WebhookHandler } from './deliveries'

/**
 * Application-owned compliance contract.
 *
 * The ingress verifies, deduplicates, and durably processes Shopify compliance
 * webhooks, but it cannot know a future app's domain schema. Replace these
 * stubs with bounded, retry-safe deletion/export work before installing the
 * app in a real store. Until then each handler reports `action_required`.
 */
export const complianceContract = {
  'customers/data_request': 'Export every domain record associated with the verified customer and deliver it securely.',
  'customers/redact': 'Delete or irreversibly anonymize every domain record associated with the verified customer.',
  'shop/redact': 'Delete every application-owned record associated with the verified shop.',
} as const

export const handleCustomerDataRequest: WebhookHandler = () => ({
  status: 'action_required',
  requirement: complianceContract['customers/data_request'],
})

export const handleCustomerRedaction: WebhookHandler = () => ({
  status: 'action_required',
  requirement: complianceContract['customers/redact'],
})

export const handleShopRedaction: WebhookHandler = () => ({
  status: 'action_required',
  requirement: complianceContract['shop/redact'],
})
