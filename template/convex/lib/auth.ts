import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function requireStoreContext(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Authentication required')
  const member = await ctx.db
    .query('storeMembers')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique()
  if (!member) throw new Error('Store membership has not been initialized')
  const store = await ctx.db.get('stores', member.storeId)
  if (!store || store.status !== 'active') throw new Error('Store is unavailable')
  return { identity, member, store }
}
