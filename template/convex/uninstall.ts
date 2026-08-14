import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { shopify } from './lib/shopifyApp'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { WebhookHandler } from './lib/deliveries'

const MEMBER_BATCH_SIZE = 100

async function deleteMemberPage(ctx: MutationCtx, storeId: Id<'stores'>): Promise<boolean> {
  const members = await ctx.db
    .query('storeMembers')
    .withIndex('by_storeId', (q) => q.eq('storeId', storeId))
    .take(MEMBER_BATCH_SIZE)
  for (const member of members) await ctx.db.delete('storeMembers', member._id)
  return members.length === MEMBER_BATCH_SIZE
}

export const uninstallStore: WebhookHandler = async (ctx, { shopDomain }) => {
  await shopify.sessionStorage.deleteSessionsForShop(ctx, shopDomain)
  const store = await ctx.db
    .query('stores')
    .withIndex('by_shopDomain', (q) => q.eq('shopDomain', shopDomain))
    .unique()
  if (!store) return { status: 'processed' }
  await ctx.db.patch('stores', store._id, { status: 'uninstalled', updatedAt: Date.now() })
  if (await deleteMemberPage(ctx, store._id)) {
    await ctx.scheduler.runAfter(0, internal.uninstall.deleteMemberBatch, { storeId: store._id })
  }
  return { status: 'processed' }
}

export const deleteMemberBatch = internalMutation({
  args: { storeId: v.id('stores') },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await deleteMemberPage(ctx, args.storeId)) {
      await ctx.scheduler.runAfter(0, internal.uninstall.deleteMemberBatch, args)
    }
    return null
  },
})
