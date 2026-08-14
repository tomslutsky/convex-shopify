import { decodeJwt } from 'jose'
import { api } from '../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { ConvexReactClient } from 'convex/react'

let cached: { token: string; expiresAt: number } | null = null
let pending: Promise<string | null> | null = null

async function exchangeToken() {
  if (typeof window === 'undefined' || typeof shopify === 'undefined') return null
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL
  if (!siteUrl) throw new Error('VITE_CONVEX_SITE_URL is not configured')
  const response = await fetch(`${siteUrl}/auth/shopify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await shopify.idToken()}` },
  })
  const body: unknown = await response.json()
  if (response.status === 403 && body && typeof body === 'object' && (body as { code?: unknown }).code === 'missing_scopes') {
    const missing = (body as { missingScopes?: unknown }).missingScopes
    const detail = Array.isArray(missing) && missing.every((scope) => typeof scope === 'string') ? ` (${missing.join(', ')})` : ''
    throw new Error(`Shopify access scopes need approval${detail}. Restart Shopify app dev and reopen the app from Shopify Admin.`)
  }
  if (!response.ok || !body || typeof body !== 'object' || typeof (body as { token?: unknown }).token !== 'string') {
    throw new Error('Could not establish an authenticated Shopify session')
  }
  const token = (body as { token: string }).token
  cached = { token, expiresAt: Date.now() + 4 * 60_000 }
  return token
}

export function fetchAppToken() {
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.token)
  if (pending) return pending
  pending = exchangeToken().finally(() => { pending = null })
  return pending
}

export function createShopifyAuthCoordinator(client: ConvexReactClient) {
  let identity: string | null = null
  let ensurePromise: Promise<FunctionReturnType<typeof api.stores.ensure>> | null = null
  let resolveAuthenticated: (() => void) | null = null
  const authenticated = new Promise<void>((resolve) => { resolveAuthenticated = resolve })
  if (typeof window !== 'undefined') client.setAuth(fetchAppToken, (ready) => { if (ready) resolveAuthenticated?.() })
  return {
    ensureStore() {
      if (!ensurePromise) ensurePromise = fetchAppToken().then(async (token) => {
        if (!token) throw new Error('Open this app from Shopify Admin to continue')
        const claims = decodeJwt(token)
        const fingerprint = `${claims.iss}|${claims.sub}`
        if (identity && identity !== fingerprint) ensurePromise = null
        identity = fingerprint
        await Promise.race([
          authenticated,
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Convex authentication timed out')), 10_000)),
        ])
        return client.mutation(api.stores.ensure, {})
      }).catch((error: unknown) => { ensurePromise = null; throw error })
      return ensurePromise
    },
  }
}

export type ShopifyAuthCoordinator = ReturnType<typeof createShopifyAuthCoordinator>
