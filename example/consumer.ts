import { shopifyApp } from '@convex-dev/shopify'
import type { ComponentApi } from '@convex-dev/shopify/_generated/component.js'

declare const mountedAsCommerce: ComponentApi<'commerce'>

// The generated component reference carries any custom Convex mount name.
export const shopify = shopifyApp({ component: mountedAsCommerce })

// Embedded request:
// const { admin, session, shopifyUserId } =
//   await shopify.authenticate.admin(ctx, { sessionToken })
// await admin.graphql(`#graphql\nquery Shop { shop { id } }`, { variables: {} })

// Trusted background workflow (shop must come from app-owned authorization):
// const { admin } = await shopify.unauthenticated.admin(ctx, shopDomain)
