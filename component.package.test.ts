/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { componentRef } from './register.js'
import { register } from './test.js'
import { validShopifyWebhook } from './component/lib/shopifyAuth.js'
import { decryptCredential, encryptCredential } from './component/lib/credentialCrypto.js'
import schema from './component/schema.js'
import type { ComponentApi } from './component/_generated/component.js'
import type { internal } from './component/_generated/api.js'

const toReferencePath = Symbol.for('toReferencePath')
const appModules = import.meta.glob('./component/**/*.ts')

function mountedReference<TReference>(name: string, path: string): TReference {
  return {
    [toReferencePath]: `_reference/childComponent/${name}/${path}`,
  } as unknown as TReference
}

async function webhookSignature(body: ArrayBuffer, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, body))
  return btoa(String.fromCharCode(...signature))
}

describe('packaged Shopify component', () => {
  const secret = 'component-test-secret'

  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = secret
    process.env.SHOPIFY_API_KEY = 'component-api-key'
  })

  afterEach(() => {
    delete process.env.SHOPIFY_API_SECRET
    delete process.env.SHOPIFY_API_KEY
    delete process.env.SHOPIFY_SCOPES
    delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY
    delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION
    delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEYS
    delete process.env.SHOPIFY_PARTNER_ORGANIZATION_ID
    delete process.env.SHOPIFY_PARTNER_ACCESS_TOKEN
    delete process.env.SHOPIFY_PARTNER_API_VERSION
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('registers under a custom mount name and disconnects idempotently', async () => {
    const t = convexTest(schema, appModules)
    register(t, 'commerce')
    await t.mutation(componentRef('installations/upsert', 'commerce'), {
      shopDomain: 'custom-mount.myshopify.com',
      scopes: 'read_products',
      encryptedAccessToken: 'ciphertext',
      tokenIv: 'iv',
      tokenKeyVersion: 'v1',
    })

    const disconnect = mountedReference<
      ComponentApi<'commerce'>['install']['uninstall']
    >('commerce', 'install/uninstall')
    await expect(
      t.mutation(disconnect, { shopDomain: 'custom-mount.myshopify.com' }),
    ).resolves.toBeNull()
    await expect(
      t.mutation(disconnect, { shopDomain: 'custom-mount.myshopify.com' }),
    ).resolves.toBeNull()
  })

  test('accepts a valid webhook HMAC and rejects an invalid one', async () => {
    const body = new TextEncoder().encode('{"shop_id":123}').buffer
    const signature = await webhookSignature(body, secret)

    await expect(validShopifyWebhook(body, signature)).resolves.toBe(true)
    await expect(validShopifyWebhook(body, 'invalid')).resolves.toBe(false)
  })

  test('connects once, persists the expiring token pair, and reuses a valid installation', async () => {
    const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = key
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1'
    process.env.SHOPIFY_SCOPES = 'read_products,read_customers'
    const now = Math.floor(Date.now() / 1_000)
    const sessionToken = await new SignJWT({ dest: 'https://connect.myshopify.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://connect.myshopify.com/admin')
      .setAudience('component-api-key')
      .setSubject('42')
      .setIssuedAt(now)
      .setNotBefore(now - 1)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(secret))
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      access_token: 'access-token',
      scope: 'read_products',
      expires_in: 3_600,
      refresh_token: 'refresh-token',
      refresh_token_expires_in: 7_776_000,
    }), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    const t = convexTest(schema, appModules)
    register(t, 'commerce')
    const connect = mountedReference<ComponentApi<'commerce'>['auth']['exchangeSessionToken']>('commerce', 'auth/exchangeSessionToken')

    const first = await t.action(connect, { sessionToken })
    expect(first).toMatchObject({ shopDomain: 'connect.myshopify.com', shopifyUserId: '42', state: { status: 'missing_scopes', scopes: ['read_products'], missingScopes: ['read_customers'] } })
    process.env.SHOPIFY_SCOPES = 'read_products'
    const second = await t.action(connect, { sessionToken })
    expect(second.state).toMatchObject({ status: 'ready', scopes: ['read_products'], missingScopes: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('returns structured Partner GraphQL errors/metadata and classifies throttle/malformed responses', async () => {
    process.env.SHOPIFY_PARTNER_ORGANIZATION_ID = 'organization-1'
    process.env.SHOPIFY_PARTNER_ACCESS_TOKEN = 'partner-secret'
    const t = convexTest(schema, appModules)
    register(t, 'commerce')
    const partner = mountedReference<ComponentApi<'commerce'>['partner']['gql']>('commerce', 'partner/gql')
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      data: { organization: { name: 'Example' } },
      errors: [{ message: 'partial warning', path: ['organization'], extensions: { code: 'WARNING' } }],
      extensions: { cost: { requestedQueryCost: 4, actualQueryCost: 3, throttleStatus: { maximumAvailable: 100, currentlyAvailable: 97, restoreRate: 10 } } },
    }), { status: 200, headers: { 'x-request-id': 'partner-request-1', 'x-shopify-api-version': '2026-07' } }))))
    await expect(t.action(partner, { query: 'query { organization { name } }', variables: {} })).resolves.toMatchObject({
      data: { organization: { name: 'Example' } },
      errors: [{ message: 'partial warning', path: ['organization'], extensions: { code: 'WARNING' } }],
      metadata: { requestId: 'partner-request-1', apiVersion: '2026-07', cost: { actualQueryCost: 3 }, throttleStatus: { currentlyAvailable: 97 } },
    })

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"errors":[]}', { status: 429 }))))
    await expect(t.action(partner, { query: 'query { organization { name } }', variables: {} })).rejects.toMatchObject({ data: { kind: 'throttled', retryable: true, status: 429 } })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('<html>bad</html>', { status: 200 }))))
    await expect(t.action(partner, { query: 'query { organization { name } }', variables: {} })).rejects.toMatchObject({ data: { kind: 'malformed_response', status: 200 } })
  })

  test('refreshes and atomically persists an expired token pair under concurrent Admin actions', async () => {
    const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(8)))
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = key
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1'
    const oldAccess = await encryptCredential('expired-access')
    const oldRefresh = await encryptCredential('refresh-once')
    const t = convexTest(schema, appModules)
    register(t, 'commerce')
    const upsert = mountedReference<typeof internal.installations.upsert>('commerce', 'installations/upsert')
    const stored = mountedReference<typeof internal.installations.forStore>('commerce', 'installations/forStore')
    const admin = mountedReference<ComponentApi<'commerce'>['admin']['gql']>('commerce', 'admin/gql')
    await t.mutation(upsert, {
      shopDomain: 'refresh.myshopify.com', scopes: 'read_products', ...oldAccess,
      accessTokenExpiresAt: Date.now() - 1,
      encryptedRefreshToken: oldRefresh.encryptedAccessToken,
      refreshTokenIv: oldRefresh.tokenIv,
      refreshTokenExpiresAt: Date.now() + 600_000,
    })
    let refreshRequests = 0
    vi.stubGlobal('fetch', vi.fn((url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/admin/oauth/access_token')) {
        refreshRequests += 1
        return Promise.resolve(new Response(JSON.stringify({ access_token: 'fresh-access', scope: 'read_products', expires_in: 3_600, refresh_token: 'fresh-refresh', refresh_token_expires_in: 7_776_000 }), { status: 200 }))
      }
      expect(new Headers(init?.headers).get('x-shopify-access-token')).toBe('fresh-access')
      return Promise.resolve(new Response(JSON.stringify({ data: { shop: { id: 'gid://shopify/Shop/1' } } }), { status: 200 }))
    }))
    await Promise.all([
      t.action(admin, { shopDomain: 'refresh.myshopify.com', query: 'query { shop { id } }', variables: {} }),
      t.action(admin, { shopDomain: 'refresh.myshopify.com', query: 'query { shop { id } }', variables: {} }),
    ])
    expect(refreshRequests).toBeGreaterThanOrEqual(1)
    const session = await t.query(stored, { shopDomain: 'refresh.myshopify.com' })
    expect(session?.credentialGeneration).toBe(2)
    await expect(decryptCredential(session!.encryptedAccessToken, session!.tokenIv, session!.tokenKeyVersion)).resolves.toBe('fresh-access')
    await expect(decryptCredential(session!.encryptedRefreshToken!, session!.refreshTokenIv!, session!.tokenKeyVersion)).resolves.toBe('fresh-refresh')
  })

  test('forces one refresh after Admin 401 and retries with the new credential', async () => {
    const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)))
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = key
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1'
    const access = await encryptCredential('rejected-access')
    const refresh = await encryptCredential('refresh-after-401')
    const t = convexTest(schema, appModules)
    register(t, 'commerce')
    const upsert = mountedReference<typeof internal.installations.upsert>('commerce', 'installations/upsert')
    const admin = mountedReference<ComponentApi<'commerce'>['admin']['gql']>('commerce', 'admin/gql')
    await t.mutation(upsert, {
      shopDomain: 'forced.myshopify.com', scopes: 'read_products', ...access,
      accessTokenExpiresAt: Date.now() + 600_000,
      encryptedRefreshToken: refresh.encryptedAccessToken,
      refreshTokenIv: refresh.tokenIv,
      refreshTokenExpiresAt: Date.now() + 1_200_000,
    })
    const adminTokens: Array<string | null> = []
    vi.stubGlobal('fetch', vi.fn((url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/admin/oauth/access_token')) {
        return Promise.resolve(new Response(JSON.stringify({ access_token: 'forced-fresh-access', scope: 'read_products', expires_in: 3_600, refresh_token: 'forced-fresh-refresh', refresh_token_expires_in: 7_776_000 }), { status: 200 }))
      }
      const token = new Headers(init?.headers).get('x-shopify-access-token')
      adminTokens.push(token)
      return token === 'rejected-access'
        ? Promise.resolve(new Response('{"errors":[]}', { status: 401 }))
        : Promise.resolve(new Response(JSON.stringify({ data: { shop: { id: 'gid://shopify/Shop/2' } } }), { status: 200 }))
    }))
    await expect(t.action(admin, { shopDomain: 'forced.myshopify.com', query: 'query { shop { id } }', variables: {} })).resolves.toMatchObject({ data: { shop: { id: 'gid://shopify/Shop/2' } }, errors: [] })
    expect(adminTokens).toEqual(['rejected-access', 'forced-fresh-access'])
  })

  test('reports ready, missing-scope, and reconnect-required connection states', async () => {
    process.env.SHOPIFY_SCOPES = 'read_products,read_customers'
    const t = convexTest(schema, appModules)
    register(t, 'commerce')
    const upsert = mountedReference<typeof internal.installations.upsert>('commerce', 'installations/upsert')
    const state = mountedReference<ComponentApi<'commerce'>['auth']['state']>('commerce', 'auth/state')
    const getState = mountedReference<ComponentApi<'commerce'>['auth']['getState']>('commerce', 'auth/getState')
    const snapshot = mountedReference<ComponentApi<'commerce'>['auth']['snapshot']>('commerce', 'auth/snapshot')

    await t.mutation(upsert, {
      shopDomain: 'state.myshopify.com',
      scopes: 'read_products',
      encryptedAccessToken: 'ciphertext',
      tokenIv: 'iv',
      tokenKeyVersion: 'v1',
      accessTokenExpiresAt: 20_000,
      encryptedRefreshToken: 'refresh',
      refreshTokenIv: 'refresh-iv',
      refreshTokenExpiresAt: 30_000,
    })
    await expect(t.query(state, { shopDomain: 'state.myshopify.com', now: 1_000 })).resolves.toMatchObject({ status: 'missing_scopes', scopes: ['read_products'], missingScopes: ['read_customers'] })

    await t.mutation(upsert, {
      shopDomain: 'state.myshopify.com',
      scopes: 'read_products,read_customers',
      encryptedAccessToken: 'ciphertext',
      tokenIv: 'iv',
      tokenKeyVersion: 'v1',
      accessTokenExpiresAt: 20_000,
      encryptedRefreshToken: 'refresh',
      refreshTokenIv: 'refresh-iv',
      refreshTokenExpiresAt: 30_000,
    })
    await expect(t.query(state, { shopDomain: 'state.myshopify.com', now: 1_000 })).resolves.toMatchObject({ status: 'ready', missingScopes: [] })
    await expect(t.query(state, { shopDomain: 'state.myshopify.com', now: 40_000 })).resolves.toMatchObject({ status: 'reconnect_required' })
    await expect(t.query(snapshot, { shopDomain: 'state.myshopify.com' })).resolves.toMatchObject({ installed: true, scopes: ['read_customers', 'read_products'] })

    await t.mutation(upsert, {
      shopDomain: 'expired-state.myshopify.com',
      scopes: 'read_products,read_customers',
      encryptedAccessToken: 'ciphertext',
      tokenIv: 'iv',
      tokenKeyVersion: 'v1',
      accessTokenExpiresAt: 1,
      encryptedRefreshToken: 'refresh',
      refreshTokenIv: 'refresh-iv',
      refreshTokenExpiresAt: 1,
    })
    await expect(t.action(getState, { shopDomain: 'expired-state.myshopify.com' })).resolves.toMatchObject({ status: 'reconnect_required' })
  })

  test('uses credential-generation compare-and-swap for concurrent refresh persistence', async () => {
    const t = convexTest(schema, appModules)
    register(t, 'commerce')
    const upsert = mountedReference<typeof internal.installations.upsert>('commerce', 'installations/upsert')
    const persist = mountedReference<typeof internal.installations.persistRefreshed>('commerce', 'installations/persistRefreshed')
    await t.mutation(upsert, { shopDomain: 'cas.myshopify.com', scopes: 'read_products', encryptedAccessToken: 'old', tokenIv: 'old-iv', tokenKeyVersion: 'v1' })
    const next = {
      shopDomain: 'cas.myshopify.com', expectedGeneration: 1, scopes: 'read_products',
      encryptedAccessToken: 'new', tokenIv: 'new-iv', tokenKeyVersion: 'v2', accessTokenExpiresAt: 100_000,
      encryptedRefreshToken: 'new-refresh', refreshTokenIv: 'new-refresh-iv', refreshTokenExpiresAt: 200_000,
    }
    await expect(t.mutation(persist, next)).resolves.toBe(true)
    await expect(t.mutation(persist, next)).resolves.toBe(false)
  })

  test('rotates every row through opaque one-row cursors and reruns idempotently', async () => {
    const keyV1 = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)))
    const keyV2 = btoa(String.fromCharCode(...new Uint8Array(32).fill(2)))
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = keyV1
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1'
    const t = convexTest(schema, appModules)
    register(t, 'commerce')
    const upsert = mountedReference<typeof internal.installations.upsert>('commerce', 'installations/upsert')
    const rotate = mountedReference<ComponentApi<'commerce'>['install']['reencrypt']>('commerce', 'install/reencrypt')
    for (const shop of ['first.myshopify.com', 'second.myshopify.com', 'third.myshopify.com']) {
      const access = await encryptCredential(`access-${shop}`)
      await t.mutation(upsert, { shopDomain: shop, scopes: 'read_products', ...access })
    }
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = keyV2
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v2'
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEYS = JSON.stringify({ v1: keyV1 })

    let cursor: string | null = null
    let migrated = 0
    do {
      const page: { processed: number; migrated: number; nextCursor: string | null; isDone: boolean } = await t.action(rotate, { cursor, batchSize: 1 })
      migrated += page.migrated
      cursor = page.nextCursor
      if (page.isDone) break
    } while (cursor !== null)
    expect(migrated).toBe(3)
    await expect(t.action(rotate, { cursor: null, batchSize: 100 })).resolves.toMatchObject({ processed: 3, migrated: 0, isDone: true })
    await expect(t.action(rotate, { batchSize: 0 })).rejects.toThrow('between 1 and 100')
    await expect(t.action(rotate, { batchSize: 101 })).rejects.toThrow('between 1 and 100')
  })
})
