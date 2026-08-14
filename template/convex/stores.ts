import { v } from 'convex/values'
import { internalQuery, mutation, query } from './_generated/server'
import { requireStoreContext } from './lib/auth'
import { shopify } from './lib/shopifyApp'

function requiredStringClaim(identity: Record<string, unknown>, name: string) {
  const value = identity[name]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Authenticated token is missing ${name}`)
  return value
}

const contextValidator = v.object({
  storeId: v.id('stores'),
  shopDomain: v.string(),
  displayName: v.string(),
  role: v.literal('member'),
})

export const ensure = mutation({
  args: {},
  returns: contextValidator,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Authentication required')
    const claims = identity as unknown as Record<string, unknown>
    const shopDomain = requiredStringClaim(claims, 'shopDomain').toLowerCase()
    const shopifyUserId = requiredStringClaim(claims, 'shopifyUserId')
    const session = await shopify.sessionStorage.findSessionByShop(ctx, shopDomain)
    if (!session || session.missingScopes.length > 0) throw new Error('Shopify connection is not ready')

    const now = Date.now()
    const existingMember = await ctx.db
      .query('storeMembers')
      .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique()
    if (existingMember) {
      const store = await ctx.db.get('stores', existingMember.storeId)
      if (!store || store.shopDomain !== shopDomain) throw new Error('Authenticated identity does not match its store membership')
      if (store.status !== 'active') await ctx.db.patch('stores', store._id, { status: 'active', updatedAt: now })
      await ctx.db.patch('storeMembers', existingMember._id, { lastSeenAt: now })
      return { storeId: store._id, shopDomain, displayName: store.displayName, role: existingMember.role }
    }

    let store = await ctx.db.query('stores').withIndex('by_shopDomain', (q) => q.eq('shopDomain', shopDomain)).unique()
    const role = 'member' as const
    if (!store) {
      const storeId = await ctx.db.insert('stores', {
        shopDomain,
        displayName: shopDomain.replace(/\.myshopify\.com$/, ''),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      store = (await ctx.db.get('stores', storeId))!
    } else if (store.status !== 'active') {
      await ctx.db.patch('stores', store._id, { status: 'active', updatedAt: now })
    }
    await ctx.db.insert('storeMembers', {
      storeId: store._id,
      tokenIdentifier: identity.tokenIdentifier,
      shopifyUserId,
      role,
      createdAt: now,
      lastSeenAt: now,
    })
    return { storeId: store._id, shopDomain, displayName: store.displayName, role }
  },
})

export const current = query({
  args: {},
  returns: contextValidator,
  handler: async (ctx) => {
    const { member, store } = await requireStoreContext(ctx)
    return { storeId: store._id, shopDomain: store.shopDomain, displayName: store.displayName, role: member.role }
  },
})

export const get = query({
  args: { storeId: v.id('stores') },
  returns: contextValidator,
  handler: async (ctx, args) => {
    const { member, store } = await requireStoreContext(ctx)
    if (store._id !== args.storeId) throw new Error('Store not found')
    return { storeId: store._id, shopDomain: store.shopDomain, displayName: store.displayName, role: member.role }
  },
})

export const authorizedShop = internalQuery({
  args: {},
  returns: v.string(),
  handler: async (ctx) => (await requireStoreContext(ctx)).store.shopDomain,
})
