/// <reference types="vite/client" />
import { register as registerShopify } from '@convex-dev/shopify/test'
import { convexTest } from 'convex-test'
import { exportJWK, generateKeyPair, importJWK, jwtVerify } from 'jose'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import { parseJwk, signAppToken } from './lib/appAuth'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

function backend() {
  const t = convexTest(schema as never, modules)
  registerShopify(t as never)
  return t
}

function identity(t: ReturnType<typeof backend>, subject: string) {
  return t.withIdentity({ issuer: 'https://app.test', subject, tokenIdentifier: `https://app.test|${subject}`, shopDomain: `${subject}.myshopify.com`, shopifyUserId: subject })
}

async function seedStore(t: ReturnType<typeof backend>, subject: string) {
  return t.run(async (ctx) => {
    const now = 1
    const storeId = await ctx.db.insert('stores', { shopDomain: `${subject}.myshopify.com`, displayName: subject, status: 'active', createdAt: now, updatedAt: now })
    await ctx.db.insert('storeMembers', { storeId, tokenIdentifier: `https://app.test|${subject}`, shopifyUserId: subject, role: 'member', createdAt: now, lastSeenAt: now })
    return storeId
  })
}

describe('application authorization', () => {
  test('rejects unauthenticated access', async () => {
    await expect(backend().query(api.stores.current, {})).rejects.toThrow('Authentication required')
  })

  test('rejects cross-store access even when the caller supplies a valid store id', async () => {
    const t = backend()
    await seedStore(t, 'alice')
    const otherStoreId = await seedStore(t, 'bob')
    await expect(identity(t, 'alice').query(api.stores.get, { storeId: otherStoreId })).rejects.toThrow('Store not found')
  })
})

describe('short-lived app JWT', () => {
  beforeEach(async () => {
    const pair = await generateKeyPair('ES256', { extractable: true })
    process.env.CONVEX_SITE_URL = 'https://auth.example.test'
    process.env.APP_AUTH_PRIVATE_JWK = JSON.stringify({ ...(await exportJWK(pair.privateKey)), kid: 'app-auth-1' })
    process.env.APP_AUTH_PUBLIC_JWK = JSON.stringify({ ...(await exportJWK(pair.publicKey)), kid: 'app-auth-1' })
  })
  afterEach(() => {
    delete process.env.CONVEX_SITE_URL
    delete process.env.APP_AUTH_PRIVATE_JWK
    delete process.env.APP_AUTH_PUBLIC_JWK
  })

  test('accepts its own token and rejects a forged token', async () => {
    const publicKey = await importJWK(parseJwk('APP_AUTH_PUBLIC_JWK'), 'ES256')
    const token = await signAppToken('alpha.myshopify.com', '42')
    await expect(jwtVerify(token, publicKey, { issuer: process.env.CONVEX_SITE_URL, audience: 'convex' })).resolves.toMatchObject({ payload: { shopDomain: 'alpha.myshopify.com' } })

    const attacker = await generateKeyPair('ES256')
    const forged = await new (await import('jose')).SignJWT({ shopDomain: 'alpha.myshopify.com', shopifyUserId: '42' })
      .setProtectedHeader({ alg: 'ES256', kid: 'app-auth-1' }).setIssuer(process.env.CONVEX_SITE_URL!).setAudience('convex').setSubject('alpha.myshopify.com:42').setExpirationTime('5m').sign(attacker.privateKey)
    await expect(jwtVerify(forged, publicKey, { issuer: process.env.CONVEX_SITE_URL, audience: 'convex' })).rejects.toThrow()
  })

  test('rejects private material in the public JWKS key', () => {
    process.env.APP_AUTH_PUBLIC_JWK = process.env.APP_AUTH_PRIVATE_JWK
    expect(() => parseJwk('APP_AUTH_PUBLIC_JWK')).toThrow('must not contain private key material')
  })
})
