import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { shopify } from './lib/shopifyApp'

export const shopIdentity = action({
  args: {},
  returns: v.object({ id: v.string(), name: v.string(), myshopifyDomain: v.string() }),
  handler: async (ctx) => {
    const shopDomain = await ctx.runQuery(internal.stores.authorizedShop, {})
    const { admin } = await shopify.unauthenticated.admin(ctx, shopDomain)
    const response = await admin.graphql(`#graphql
      query StarterShopIdentity {
        shop { id name myshopifyDomain }
      }
    `, { variables: {} })
    const candidate = (response.data as { shop?: unknown } | null)?.shop
    if (
      response.errors.length > 0 ||
      typeof candidate !== 'object' || candidate === null ||
      !('id' in candidate) || typeof candidate.id !== 'string' ||
      !('name' in candidate) || typeof candidate.name !== 'string' ||
      !('myshopifyDomain' in candidate) || typeof candidate.myshopifyDomain !== 'string'
    ) throw new Error('Shopify did not return a valid shop identity')
    return {
      id: candidate.id,
      name: candidate.name,
      myshopifyDomain: candidate.myshopifyDomain,
    }
  },
})
