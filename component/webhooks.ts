import { Workpool } from '@convex-dev/workpool'
import {
  type FunctionHandle,
  type FunctionReference,
  type GenericMutationCtx,
} from 'convex/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api.js'
import { action, mutation, query } from './_generated/server.js'
import { validShopifyWebhook } from './lib/shopifyAuth.js'
import { normalizeScopes } from './installations.js'
import type { DataModel, Id } from './_generated/dataModel.js'
import type { WorkpoolComponent } from '@convex-dev/workpool'

const webhookPool = new Workpool(
  (components as unknown as { webhookWorkpool: WorkpoolComponent })
    .webhookWorkpool,
  {
    maxParallelism: 10,
    retryActionsByDefault: true,
  },
)

const webhookFunctions = internal.webhooks as unknown as {
  runDelivery: FunctionReference<'action', 'internal', { deliveryId: Id<'webhookDeliveries'> }, null>
  getDelivery: FunctionReference<'query', 'internal', { deliveryId: Id<'webhookDeliveries'> }, {
    webhookId: string
    shopDomain: string
    topic: string
    payload: unknown
    handler: string
    status: string
  } | null>
  completeDelivery: typeof internal.webhooks.completeDelivery
  pruneDeliveries: FunctionReference<'mutation', 'internal', Record<string, never>, null>
}

const verifyHmac = async (body: ArrayBuffer, signature: string) =>
  validShopifyWebhook(body, signature)

const deliveryArgs = {
  webhookId: v.string(),
  shopDomain: v.string(),
  topic: v.string(),
  payload: v.any(),
  handler: v.string(),
}

async function enqueue(
  ctx: GenericMutationCtx<DataModel>,
  deliveryId: Id<'webhookDeliveries'>,
) {
  const workId = await webhookPool.enqueueAction(
    ctx,
    webhookFunctions.runDelivery,
    { deliveryId },
    {
      onComplete: webhookFunctions.completeDelivery,
      context: { deliveryId },
    },
  )
  await ctx.db.patch('webhookDeliveries', deliveryId, { workId })
}

async function applyShopifyLifecycle(
  ctx: GenericMutationCtx<DataModel>,
  args: { shopDomain: string; topic: string; payload: unknown },
): Promise<boolean> {
  if (args.topic === 'app/scopes_update' || args.topic === 'APP_SCOPES_UPDATE') {
    if (!args.payload || typeof args.payload !== 'object') return false
    const current = (args.payload as { current?: unknown }).current
    if (!Array.isArray(current) || !current.every((scope): scope is string => typeof scope === 'string')) {
      return false
    }
    const session = await ctx.db
      .query('offlineSessions')
      .withIndex('by_shopDomain', (q) => q.eq('shopDomain', args.shopDomain))
      .unique()
    if (!session) return true
    const scopes = normalizeScopes(current.join(',')).join(',')
    if (session.scopes !== scopes) {
      await ctx.db.patch('offlineSessions', session._id, {
        scopes,
        updatedAt: Date.now(),
      })
    }
    return true
  }

  if (args.topic === 'app/uninstalled' || args.topic === 'APP_UNINSTALLED') {
    const session = await ctx.db
      .query('offlineSessions')
      .withIndex('by_shopDomain', (q) => q.eq('shopDomain', args.shopDomain))
      .unique()
    if (session) await ctx.db.delete('offlineSessions', session._id)
  }
  return true
}

export const verifyRequestHmac = action({
  args: { body: v.bytes(), signature: v.string() },
  returns: v.boolean(),
  handler: async (_ctx, args) => verifyHmac(args.body, args.signature),
})

// Backwards-compatible raw reference. This verifies only the HMAC.
export const verify = action({
  args: { body: v.bytes(), signature: v.string() },
  returns: v.boolean(),
  handler: async (_ctx, args) => verifyHmac(args.body, args.signature),
})

export const accept = mutation({
  args: { ...deliveryArgs, deduplicate: v.boolean() },
  returns: v.union(
    v.object({ status: v.literal('accepted'), deliveryId: v.id('webhookDeliveries') }),
    v.object({ status: v.literal('duplicate'), deliveryId: v.id('webhookDeliveries') }),
    v.object({ status: v.literal('rejected'), reason: v.literal('invalid_lifecycle_payload') }),
  ),
  handler: async (ctx, args) => {
    if (args.deduplicate) {
      const existing = await ctx.db
        .query('webhookDeliveries')
        .withIndex('by_webhookId', (q) => q.eq('webhookId', args.webhookId))
        .unique()
      if (existing) return { status: 'duplicate' as const, deliveryId: existing._id }
    }
    if (!await applyShopifyLifecycle(ctx, args)) {
      return { status: 'rejected' as const, reason: 'invalid_lifecycle_payload' as const }
    }
    const deliveryId = await ctx.db.insert('webhookDeliveries', {
      webhookId: args.webhookId,
      shopDomain: args.shopDomain,
      topic: args.topic,
      payload: args.payload,
      handler: args.handler,
      status: 'pending',
    })
    await enqueue(ctx, deliveryId)
    return { status: 'accepted' as const, deliveryId }
  },
})

export const runDelivery = action({
  args: { deliveryId: v.id('webhookDeliveries') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.runQuery(webhookFunctions.getDelivery, args)
    if (!delivery) return null
    await ctx.runMutation(delivery.handler as FunctionHandle<'mutation'>, {
      webhookId: delivery.webhookId,
      shopDomain: delivery.shopDomain,
      topic: delivery.topic,
      payload: delivery.payload,
    })
    return null
  },
})

export const getDelivery = query({
  args: { deliveryId: v.id('webhookDeliveries') },
  returns: v.union(
    v.null(),
    v.object({ ...deliveryArgs, status: v.string() }),
  ),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get('webhookDeliveries', args.deliveryId)
    if (!delivery) return null
    return {
      webhookId: delivery.webhookId,
      shopDomain: delivery.shopDomain,
      topic: delivery.topic,
      payload: delivery.payload,
      handler: delivery.handler,
      status: delivery.status,
    }
  },
})

export const completeDelivery = webhookPool.defineOnComplete({
  context: v.object({ deliveryId: v.id('webhookDeliveries') }),
  handler: async (ctx, { context, result }) => {
    if (result.kind === 'success') {
      await ctx.db.patch('webhookDeliveries', context.deliveryId, {
        status: 'succeeded',
        completedAt: Date.now(),
        error: undefined,
      })
    } else if (result.kind === 'failed') {
      await ctx.db.patch('webhookDeliveries', context.deliveryId, {
        status: 'failed',
        completedAt: Date.now(),
        error: result.error,
      })
    }
  },
})

export const listFailed = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    deliveryId: v.id('webhookDeliveries'),
    webhookId: v.string(),
    shopDomain: v.string(),
    topic: v.string(),
    error: v.string(),
    completedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 50), 100))
    const rows = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status', (q) => q.eq('status', 'failed'))
      .order('desc')
      .take(limit)
    return rows.map((row) => ({
      deliveryId: row._id,
      webhookId: row.webhookId,
      shopDomain: row.shopDomain,
      topic: row.topic,
      error: row.error ?? 'Unknown delivery failure',
      completedAt: row.completedAt ?? row._creationTime,
    }))
  },
})

export const replay = mutation({
  args: { deliveryId: v.id('webhookDeliveries') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get('webhookDeliveries', args.deliveryId)
    if (!delivery) throw new Error('Webhook delivery not found')
    if (delivery.status !== 'failed') throw new Error('Only failed webhook deliveries can be replayed')
    await ctx.db.patch('webhookDeliveries', delivery._id, {
      status: 'pending',
      error: undefined,
      completedAt: undefined,
    })
    await enqueue(ctx, delivery._id)
    return null
  },
})

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const PRUNE_BATCH_SIZE = 250

export const pruneDeliveries = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS
    for (const status of ['succeeded', 'failed'] as const) {
      const expired = await ctx.db
        .query('webhookDeliveries')
        .withIndex('by_status', (q) =>
          q.eq('status', status).lt('_creationTime', cutoff),
        )
        .take(PRUNE_BATCH_SIZE)
      for (const delivery of expired) await ctx.db.delete('webhookDeliveries', delivery._id)
      if (expired.length === PRUNE_BATCH_SIZE) {
        await ctx.scheduler.runAfter(0, webhookFunctions.pruneDeliveries, {})
        break
      }
    }
    return null
  },
})
