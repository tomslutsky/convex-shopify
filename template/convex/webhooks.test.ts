/// <reference types="vite/client" />
import { register as registerShopify } from '@convex-dev/shopify/test'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import batchWorkerSchema from '../../node_modules/@convex-dev/batch-worker/dist/component/schema.js'
import workpoolSchema from '../../node_modules/@convex-dev/workpool/dist/component/schema.js'
import schema from './schema'
import type { FunctionReference } from 'convex/server'

const modules = import.meta.glob('./**/*.ts')
const workpoolModules = import.meta.glob('../../node_modules/@convex-dev/workpool/dist/component/**/*.js')
const batchWorkerModules = import.meta.glob('../../node_modules/@convex-dev/batch-worker/dist/component/**/*.js')
const secret = 'test-only-webhook-secret'
const childReference = Symbol.for('toReferencePath')

function componentMutation(path: string): FunctionReference<'mutation', 'internal'> {
  return { [childReference]: `_reference/childComponent/shopify/${path}` } as unknown as FunctionReference<'mutation', 'internal'>
}

function componentQuery(path: string): FunctionReference<'query', 'public'> {
  return { [childReference]: `_reference/childComponent/shopify/${path}` } as unknown as FunctionReference<'query', 'public'>
}

function backend() {
  const t = convexTest(schema as never, modules)
  registerShopify(t as never)
  t.registerComponent('shopify/webhookWorkpool', workpoolSchema, workpoolModules)
  t.registerComponent('shopify/webhookWorkpool/batchWorker', batchWorkerSchema, batchWorkerModules)
  return t
}

function drain(t: ReturnType<typeof backend>) {
  return t.finishAllScheduledFunctions(vi.runAllTimers)
}

async function signature(body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  return btoa(String.fromCharCode(...signed))
}

async function webhook(t: ReturnType<typeof backend>, id: string, topic: string, valid = true, payload: unknown = {}) {
  const body = JSON.stringify(payload)
  const paths: Record<string, string> = {
    'app/uninstalled': '/webhooks/app/uninstalled',
    'app/scopes_update': '/webhooks/app/scopes-update',
    'customers/data_request': '/webhooks/customers/data-request',
    'customers/redact': '/webhooks/customers/redact',
    'shop/redact': '/webhooks/shop/redact',
  }
  return t.fetch(paths[topic] ?? '/webhooks/app/uninstalled', { method: 'POST', body, headers: {
    'content-type': 'application/json', 'x-shopify-topic': topic,
    'x-shopify-shop-domain': 'alpha.myshopify.com', 'x-shopify-webhook-id': id,
    'x-shopify-hmac-sha256': valid ? await signature(body) : 'invalid',
  } })
}

beforeEach(() => { process.env.SHOPIFY_API_SECRET = secret })
afterEach(() => {
  delete process.env.SHOPIFY_API_SECRET
  vi.useRealTimers()
})

describe('verified webhook ingress', () => {
  test('rejects invalid HMAC before persisting delivery state', async () => {
    const t = backend()
    expect((await webhook(t, 'forged', 'app/uninstalled', false)).status).toBe(401)
  })

  test('rejects a valid webhook delivered to the wrong topic endpoint', async () => {
    const t = backend()
    const body = '{}'
    const response = await t.fetch('/webhooks/app/uninstalled', { method: 'POST', body, headers: {
      'content-type': 'application/json', 'x-shopify-topic': 'app/scopes_update',
      'x-shopify-shop-domain': 'alpha.myshopify.com', 'x-shopify-webhook-id': 'wrong-route',
      'x-shopify-hmac-sha256': await signature(body),
    } })
    expect(response.status).toBe(400)
  })

  test('persists delivery deduplication across repeated requests', async () => {
    vi.useFakeTimers()
    const t = backend()
    const storeId = await t.run((ctx) => ctx.db.insert('stores', {
      shopDomain: 'alpha.myshopify.com', displayName: 'Alpha', status: 'active',
      createdAt: 1, updatedAt: 1,
    }))
    expect((await webhook(t, 'same-id', 'app/uninstalled')).status).toBe(200)
    await drain(t)
    await t.run((ctx) => ctx.db.insert('storeMembers', {
      storeId, tokenIdentifier: 'issuer|late-user', shopifyUserId: 'late-user',
      role: 'member', createdAt: 2, lastSeenAt: 2,
    }))
    expect((await webhook(t, 'same-id', 'app/uninstalled')).status).toBe(200)
    await drain(t)
    expect(await t.run((ctx) => ctx.db.query('storeMembers').take(10))).toHaveLength(1)
  })

  test('uninstall removes component credentials and app memberships', async () => {
    vi.useFakeTimers()
    const t = backend()
    await t.mutation(componentMutation('installations/upsert'), { shopDomain: 'alpha.myshopify.com', scopes: 'read_products', encryptedAccessToken: 'ciphertext', tokenIv: 'iv', tokenKeyVersion: 'v1' })
    const storeId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('stores', { shopDomain: 'alpha.myshopify.com', displayName: 'Alpha', status: 'active', createdAt: 1, updatedAt: 1 })
      await ctx.db.insert('storeMembers', { storeId: id, tokenIdentifier: 'issuer|user', shopifyUserId: 'user', role: 'member', createdAt: 1, lastSeenAt: 1 })
      return id
    })
    expect((await webhook(t, 'uninstall', 'app/uninstalled')).status).toBe(200)
    await drain(t)
    await expect(t.query(componentQuery('auth/snapshot'), { shopDomain: 'alpha.myshopify.com' })).resolves.toMatchObject({ installed: false })
    expect((await t.run((ctx) => ctx.db.get('stores', storeId)))?.status).toBe('uninstalled')
    expect(await t.run((ctx) => ctx.db.query('storeMembers').take(10))).toEqual([])
  })

  test('scope updates reconcile granted scopes idempotently', async () => {
    vi.useFakeTimers()
    const t = backend()
    await t.mutation(componentMutation('installations/upsert'), {
      shopDomain: 'alpha.myshopify.com', scopes: 'read_products',
      encryptedAccessToken: 'ciphertext', tokenIv: 'iv', tokenKeyVersion: 'v1',
    })

    const payload = { id: 1234, previous: ['read_products'], current: ['write_products', 'read_orders'], updated_at: '2026-08-14T00:00:00Z' }
    expect((await webhook(t, 'scopes-1', 'app/scopes_update', true, payload)).status).toBe(200)
    await drain(t)
    await expect(t.query(componentQuery('auth/snapshot'), { shopDomain: 'alpha.myshopify.com' })).resolves.toMatchObject({
      installed: true,
      scopes: ['read_orders', 'write_products'],
      missingScopes: [],
    })

    expect((await webhook(t, 'scopes-2', 'app/scopes_update', true, payload)).status).toBe(200)
    await drain(t)
    await expect(t.query(componentQuery('auth/snapshot'), { shopDomain: 'alpha.myshopify.com' })).resolves.toMatchObject({
      installed: true,
      scopes: ['read_orders', 'write_products'],
      missingScopes: [],
    })
  })

  test('scope updates before token exchange are an idempotent no-op', async () => {
    vi.useFakeTimers()
    const t = backend()
    expect((await webhook(t, 'scopes-before-install', 'app/scopes_update', true, { current: ['read_products'] })).status).toBe(200)
    await drain(t)
    await expect(t.query(componentQuery('auth/snapshot'), { shopDomain: 'alpha.myshopify.com' })).resolves.toMatchObject({ installed: false, scopes: [] })
  })

  test('rejects malformed scope lifecycle payloads without changing component state', async () => {
    const t = backend()
    await t.mutation(componentMutation('installations/upsert'), {
      shopDomain: 'alpha.myshopify.com', scopes: 'read_products',
      encryptedAccessToken: 'ciphertext', tokenIv: 'iv', tokenKeyVersion: 'v1',
    })
    expect((await webhook(t, 'bad-scopes', 'app/scopes_update', true, { current: ['read_orders', 42] })).status).toBe(400)
    await expect(t.query(componentQuery('auth/snapshot'), { shopDomain: 'alpha.myshopify.com' })).resolves.toMatchObject({
      installed: true,
      scopes: ['read_products'],
    })
  })
})
