import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  stores: defineTable({
    shopDomain: v.string(),
    displayName: v.string(),
    status: v.union(v.literal('active'), v.literal('uninstalled')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_shopDomain', ['shopDomain']),

  storeMembers: defineTable({
    storeId: v.id('stores'),
    tokenIdentifier: v.string(),
    shopifyUserId: v.string(),
    role: v.literal('member'),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_storeId', ['storeId']),
})
