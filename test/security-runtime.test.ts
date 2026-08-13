import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { credentialKeyring, decryptCredential, encryptCredential } from '../component/lib/credentialCrypto'
import { ShopifyTransportError, graphql } from '../component/lib/adminClient'
import { exchangeOfflineToken, refreshOfflineToken, verifyShopifySessionToken } from '../component/lib/shopifyAuth'
import { offlineTokenPlan } from '../component/lib/tokenLifecycle'
import { missingScopes } from '../component/installations'
import { withForcedCredentialRefresh } from '../component/admin'
import type { ShopifyTokenRequestError } from '../component/lib/shopifyAuth'

const keyA = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)))
const keyB = btoa(String.fromCharCode(...new Uint8Array(32).fill(2)))
const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env.SHOPIFY_API_KEY = 'api-key'
  process.env.SHOPIFY_API_SECRET = 'api-secret'
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = keyA
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1'
  delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEYS
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const name of ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'SHOPIFY_API_VERSION', 'SHOPIFY_SCOPES', 'SHOPIFY_TOKEN_ENCRYPTION_KEY', 'SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION', 'SHOPIFY_TOKEN_ENCRYPTION_KEYS']) delete process.env[name]
  vi.restoreAllMocks()
})

describe('credential key configuration and rotation', () => {
  test('fails early for missing, malformed, short, and conflicting active keys', () => {
    expect(() => credentialKeyring({ SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION: 'v1' })).toThrow('SHOPIFY_TOKEN_ENCRYPTION_KEY is not configured')
    expect(() => credentialKeyring({ SHOPIFY_TOKEN_ENCRYPTION_KEY: '***', SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION: 'v1' })).toThrow('valid base64')
    expect(() => credentialKeyring({ SHOPIFY_TOKEN_ENCRYPTION_KEY: btoa('short'), SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION: 'v1' })).toThrow('exactly 32 bytes')
    expect(() => credentialKeyring({ SHOPIFY_TOKEN_ENCRYPTION_KEY: keyA, SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION: 'v2', SHOPIFY_TOKEN_ENCRYPTION_KEYS: JSON.stringify({ v2: keyB }) })).toThrow('conflicting historical entry')
  })

  test('decrypts multiple historical versions after v1 to v2 rotation', async () => {
    const v1 = await encryptCredential('v1-token')
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = keyB
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v2'
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEYS = JSON.stringify({ v1: keyA, older: keyA })
    expect(await decryptCredential(v1.encryptedAccessToken, v1.tokenIv, 'v1')).toBe('v1-token')
    const current = await encryptCredential('v2-token')
    expect(current.tokenKeyVersion).toBe('v2')
    expect(await decryptCredential(current.encryptedAccessToken, current.tokenIv, 'v2')).toBe('v2-token')
  })
})

describe('session-token verification', () => {
  test('validates HS256 audience, issuer, destination, subject, and time claims', async () => {
    const token = await new SignJWT({ dest: 'https://example.myshopify.com', iss: 'https://example.myshopify.com/admin' })
      .setProtectedHeader({ alg: 'HS256' }).setAudience('api-key').setSubject('123').setIssuedAt().setNotBefore(Math.floor(Date.now() / 1_000) - 1).setExpirationTime('5m')
      .sign(new TextEncoder().encode('api-secret'))
    await expect(verifyShopifySessionToken(token)).resolves.toMatchObject({ shopDomain: 'example.myshopify.com', shopifyUserId: '123' })
    const wrongIssuer = await new SignJWT({ dest: 'https://example.myshopify.com', iss: 'https://evil.myshopify.com/admin' })
      .setProtectedHeader({ alg: 'HS256' }).setAudience('api-key').setSubject('123').setNotBefore(Math.floor(Date.now() / 1_000) - 1).setExpirationTime('5m')
      .sign(new TextEncoder().encode('api-secret'))
    await expect(verifyShopifySessionToken(wrongIssuer)).rejects.toThrow('issuer')
  })

  test('rejects wrong algorithms, audiences, time windows, destinations, and missing subjects', async () => {
    const secret = new TextEncoder().encode('api-secret')
    const now = Math.floor(Date.now() / 1_000)
    const validClaims = { dest: 'https://example.myshopify.com', iss: 'https://example.myshopify.com/admin' }
    const wrongAlgorithm = await new SignJWT(validClaims).setProtectedHeader({ alg: 'HS512' }).setAudience('api-key').setSubject('123').setNotBefore(now - 1).setExpirationTime('5m').sign(secret)
    const wrongAudience = await new SignJWT(validClaims).setProtectedHeader({ alg: 'HS256' }).setAudience('other-key').setSubject('123').setNotBefore(now - 1).setExpirationTime('5m').sign(secret)
    const expired = await new SignJWT(validClaims).setProtectedHeader({ alg: 'HS256' }).setAudience('api-key').setSubject('123').setNotBefore(now - 120).setExpirationTime(now - 60).sign(secret)
    const notYetValid = await new SignJWT(validClaims).setProtectedHeader({ alg: 'HS256' }).setAudience('api-key').setSubject('123').setNotBefore(now + 60).setExpirationTime(now + 600).sign(secret)
    const badDestination = await new SignJWT({ ...validClaims, dest: 'http://example.myshopify.com' }).setProtectedHeader({ alg: 'HS256' }).setAudience('api-key').setSubject('123').setNotBefore(now - 1).setExpirationTime('5m').sign(secret)
    const missingSubject = await new SignJWT(validClaims).setProtectedHeader({ alg: 'HS256' }).setAudience('api-key').setNotBefore(now - 1).setExpirationTime('5m').sign(secret)
    const nonShopifySubject = await new SignJWT(validClaims).setProtectedHeader({ alg: 'HS256' }).setAudience('api-key').setSubject('user-123').setNotBefore(now - 1).setExpirationTime('5m').sign(secret)
    const missingTiming = await new SignJWT(validClaims).setProtectedHeader({ alg: 'HS256' }).setAudience('api-key').setSubject('123').sign(secret)

    for (const token of [wrongAlgorithm, wrongAudience, expired, notYetValid, badDestination, missingSubject, nonShopifySubject, missingTiming]) {
      await expect(verifyShopifySessionToken(token)).rejects.toThrow()
    }
  })
})

describe('expiring offline-token refresh', () => {
  const input = { apiKey: 'key', apiSecret: 'secret', refreshToken: 'refresh-value', shopDomain: 'example.myshopify.com' }
  const success = { access_token: 'access-next', scope: 'read_products', expires_in: 3600, refresh_token: 'refresh-next', refresh_token_expires_in: 86400 }

  test('performs the initial expiring offline token exchange', async () => {
    let submitted = ''
    const fetcher: typeof fetch = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      submitted = String(init?.body)
      return Promise.resolve(new Response(JSON.stringify(success), { status: 200 }))
    })
    await expect(exchangeOfflineToken({ apiKey: 'key', apiSecret: 'secret', sessionToken: 'session', shopDomain: 'example.myshopify.com' }, { fetch: fetcher })).resolves.toMatchObject({ accessToken: 'access-next', refreshToken: 'refresh-next' })
    expect(submitted).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange')
    expect(submitted).toContain('requested_token_type=urn%3Ashopify%3Aparams%3Aoauth%3Atoken-type%3Aoffline-access-token')
    expect(submitted).toContain('expiring=1')
  })

  test('forces refresh and recognizes refresh-token expiry without using a stale access token', () => {
    const stored = { accessTokenExpiresAt: 20_000, encryptedRefreshToken: 'cipher', refreshTokenIv: 'iv', refreshTokenExpiresAt: 30_000 }
    expect(offlineTokenPlan(stored, 1_000)).toBe('reconnect') // both token expiries fall within the safety skew
    const realistic = { ...stored, accessTokenExpiresAt: 200_000, refreshTokenExpiresAt: 300_000 }
    expect(offlineTokenPlan(realistic, 1_000)).toBe('valid')
    expect(offlineTokenPlan(realistic, 1_000, true)).toBe('refresh')
    expect(offlineTokenPlan({ ...realistic, refreshTokenExpiresAt: 1_000 }, 1_000, true)).toBe('reconnect')
  })

  test('keeps a valid connection and normalizes missing scopes', () => {
    expect(offlineTokenPlan({ accessTokenExpiresAt: 500_000 }, 1_000)).toBe('valid')
    process.env.SHOPIFY_SCOPES = 'read_products,read_customers,write_orders'
    expect(missingScopes('write_products,read_customers')).toEqual(['write_orders'])
  })

  test('retries the same refresh token after response loss and transient 429/5xx', async () => {
    const bodies: Array<string> = []
    const sleeps: Array<number> = []
    let call = 0
    const fetcher: typeof fetch = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(String(init?.body))
      call += 1
      if (call === 1) return Promise.reject(new TypeError('response lost'))
      if (call === 2) return Promise.resolve(new Response(JSON.stringify({ error: 'throttled' }), { status: 429, headers: { 'Retry-After': '2' } }))
      if (call === 3) return Promise.resolve(new Response(JSON.stringify({ error: 'server' }), { status: 503 }))
      return Promise.resolve(new Response(JSON.stringify(success), { status: 200 }))
    })
    await expect(refreshOfflineToken(input, { fetch: fetcher, sleep: (ms) => { sleeps.push(ms); return Promise.resolve() }, random: () => 0, maxAttempts: 4 })).resolves.toMatchObject({ accessToken: 'access-next', refreshToken: 'refresh-next' })
    expect(new Set(bodies).size).toBe(1)
    expect(sleeps).toEqual([125, 2_000, 500])
  })

  test('classifies only Shopify active-refresh-token rejection as definitive', async () => {
    const fetcher: typeof fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: 'invalid_request', error_description: 'This request requires an active refresh_token' }), { status: 401 })))
    await expect(refreshOfflineToken(input, { fetch: fetcher, sleep: () => Promise.resolve() })).rejects.toMatchObject({ kind: 'invalid_refresh_token', retryable: false, status: 401 } satisfies Partial<ShopifyTokenRequestError>)
    const misleadingServerError: typeof fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error_description: 'refresh token expired' }), { status: 503 })))
    await expect(refreshOfflineToken(input, { fetch: misleadingServerError, maxAttempts: 1 })).rejects.toMatchObject({ kind: 'transient', retryable: true, status: 503 } satisfies Partial<ShopifyTokenRequestError>)
  })

  test('aborts timed-out refresh requests and stops at the finite attempt limit', async () => {
    let attempts = 0
    const fetcher: typeof fetch = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      attempts += 1
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    await expect(refreshOfflineToken(input, { fetch: fetcher, timeoutMs: 1, maxAttempts: 2, sleep: () => Promise.resolve() })).rejects.toMatchObject({ kind: 'transient', retryable: true })
    expect(attempts).toBe(2)
  })
})

describe('Admin GraphQL transport', () => {
  test('returns a successful GraphQL envelope without inventing userErrors', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: { mutationResult: { userErrors: [{ message: 'business validation' }] } } }), { status: 200 })))
    const result = await graphql({ storeDomain: 'example.myshopify.com', accessToken: 'secret' }, 'mutation Test { mutationResult { userErrors { message } } }', {})
    expect(result.errors).toEqual([])
    expect(result.data).toEqual({ mutationResult: { userErrors: [{ message: 'business validation' }] } })
  })

  test('returns partial data, structured errors, request/version and throttle metadata', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      data: { shop: { name: 'Example' } },
      errors: [{ message: 'field failed', locations: [{ line: 2, column: 3 }], path: ['shop', 'field'], extensions: { code: 'INTERNAL' } }],
      extensions: { cost: { requestedQueryCost: 10, actualQueryCost: 5, throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 995, restoreRate: 50 } } },
    }), { status: 200, headers: { 'x-request-id': 'request-1', 'x-shopify-api-version': '2026-07' } })))
    const result = await graphql({ storeDomain: 'example.myshopify.com', accessToken: 'secret' }, 'query { shop { name } }', {})
    expect(result.data).toEqual({ shop: { name: 'Example' } })
    expect(result.errors[0]).toMatchObject({ message: 'field failed', path: ['shop', 'field'], extensions: { code: 'INTERNAL' } })
    expect(result.metadata).toMatchObject({ requestId: 'request-1', apiVersion: '2026-07', cost: { requestedQueryCost: 10, actualQueryCost: 5 }, throttleStatus: { currentlyAvailable: 995 } })
  })

  test('preserves top-level errors without data', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ errors: [{ message: 'query failed', extensions: { code: 'ACCESS_DENIED' } }] }), { status: 200 })))
    const result = await graphql({ storeDomain: 'example.myshopify.com', accessToken: 'secret' }, 'query { shop { id } }', {})
    expect(result.data).toBeNull()
    expect(result.errors).toEqual([{ message: 'query failed', locations: [], path: [], extensions: { code: 'ACCESS_DENIED' } }])
  })

  test('classifies HTTP throttling with retry metadata', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ errors: [{ message: 'throttled' }] }), { status: 429, headers: { 'x-request-id': 'throttle-1' } })))
    await expect(graphql({ storeDomain: 'example.myshopify.com', accessToken: 'secret' }, 'query { shop { id } }', {})).rejects.toMatchObject({ kind: 'throttled', retryable: true, responseMetadata: { requestId: 'throttle-1' } })
  })

  test('distinguishes authentication and malformed/non-JSON responses', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('unauthorized', { status: 401 })))
    await expect(graphql({ storeDomain: 'example.myshopify.com', accessToken: 'rejected' }, 'query { shop { id } }', {})).rejects.toMatchObject({ kind: 'authentication', status: 401 } satisfies Partial<ShopifyTransportError>)
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('<html>bad gateway</html>', { status: 200 })))
    await expect(graphql({ storeDomain: 'example.myshopify.com', accessToken: 'secret' }, 'query { shop { id } }', {})).rejects.toMatchObject({ kind: 'malformed_response', status: 200 } satisfies Partial<ShopifyTransportError>)
  })

  test('retries a 401 once only after forcing a different credential', async () => {
    const used: Array<string> = []
    const result = await withForcedCredentialRefresh(
      () => Promise.resolve({ storeDomain: 'example.myshopify.com', accessToken: 'rejected' }),
      () => Promise.resolve({ storeDomain: 'example.myshopify.com', accessToken: 'fresh' }),
      (connection) => {
        used.push(connection.accessToken)
        if (connection.accessToken === 'rejected') {
          return Promise.reject(new ShopifyTransportError('authentication', 'rejected', 401, false, null))
        }
        return Promise.resolve('ok')
      },
    )
    expect(result).toBe('ok')
    expect(used).toEqual(['rejected', 'fresh'])
  })
})
