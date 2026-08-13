import { internal } from '../_generated/api'
import { decryptCredential, encryptCredential } from './credentialCrypto'
import { ShopifyTokenRequestError, refreshOfflineToken, requiredEnv } from './shopifyAuth'
import type { ExpiringOfflineToken } from './shopifyAuth'
import type { ShopifyConnection } from './adminClient'
import type { ActionCtx } from '../_generated/server'

export const EXPIRY_SKEW_MS = 60_000

export type StoredOfflineToken = {
  accessTokenExpiresAt?: number
  encryptedRefreshToken?: string
  refreshTokenIv?: string
  refreshTokenExpiresAt?: number
}

export type OfflineTokenPlan = 'valid' | 'refresh' | 'reconnect'

export function offlineTokenPlan(installation: StoredOfflineToken, now: number, forceRefresh = false): OfflineTokenPlan {
  if (installation.accessTokenExpiresAt === undefined) return 'reconnect'
  if (!forceRefresh && installation.accessTokenExpiresAt - EXPIRY_SKEW_MS > now) return 'valid'
  if (installation.encryptedRefreshToken && installation.refreshTokenIv && (installation.refreshTokenExpiresAt ?? 0) - EXPIRY_SKEW_MS > now) return 'refresh'
  return 'reconnect'
}

export type TokenLifecycleFailureKind = 'installation_missing' | 'transient_refresh_failure' | 'invalid_refresh_token' | 'expired_refresh_token' | 'reconnect_required' | 'token_exchange_rejected'

export class ShopifyTokenLifecycleError extends Error {
  constructor(public readonly kind: TokenLifecycleFailureKind, message: string, public readonly retryable: boolean) {
    super(message)
  }
}

type StoredInstallation = StoredOfflineToken & {
  shopDomain: string
  encryptedAccessToken: string
  tokenIv: string
  tokenKeyVersion: string
  scopes: string
  credentialGeneration: number
}

async function latestConnection(ctx: ActionCtx, shopDomain: string): Promise<ShopifyConnection> {
  const latest: StoredInstallation | null = await ctx.runQuery(internal.installations.forStore, { shopDomain })
  if (!latest) throw new ShopifyTokenLifecycleError('installation_missing', 'Shopify installation is missing', false)
  return { storeDomain: latest.shopDomain, accessToken: await decryptCredential(latest.encryptedAccessToken, latest.tokenIv, latest.tokenKeyVersion) }
}

async function persistTokens(ctx: ActionCtx, installation: StoredInstallation, tokens: ExpiringOfflineToken): Promise<ShopifyConnection> {
  const now = Date.now()
  const access = await encryptCredential(tokens.accessToken)
  const refresh = await encryptCredential(tokens.refreshToken)
  const persisted: boolean = await ctx.runMutation(internal.installations.persistRefreshed, {
    shopDomain: installation.shopDomain,
    expectedGeneration: installation.credentialGeneration,
    scopes: tokens.scopes || installation.scopes,
    ...access,
    accessTokenExpiresAt: now + tokens.expiresIn * 1_000,
    encryptedRefreshToken: refresh.encryptedAccessToken,
    refreshTokenIv: refresh.tokenIv,
    refreshTokenExpiresAt: now + tokens.refreshTokenExpiresIn * 1_000,
  })
  // Another action won the single-use refresh-token race. Never overwrite its
  // newer token pair; use the credential it committed instead.
  return persisted ? { storeDomain: installation.shopDomain, accessToken: tokens.accessToken } : latestConnection(ctx, installation.shopDomain)
}

function lifecycleFailure(error: unknown): ShopifyTokenLifecycleError {
  if (!(error instanceof ShopifyTokenRequestError)) return new ShopifyTokenLifecycleError('transient_refresh_failure', 'Shopify credential refresh failed unexpectedly', true)
  if (error.kind === 'transient') return new ShopifyTokenLifecycleError('transient_refresh_failure', error.message, true)
  if (error.kind === 'invalid_refresh_token') return new ShopifyTokenLifecycleError('invalid_refresh_token', error.message, false)
  if (error.kind === 'expired_refresh_token') return new ShopifyTokenLifecycleError('expired_refresh_token', error.message, false)
  return new ShopifyTokenLifecycleError('token_exchange_rejected', error.message, false)
}

export async function ensureFreshConnection(ctx: ActionCtx, shopDomain: string, options: { forceRefresh?: boolean } = {}): Promise<ShopifyConnection> {
  const installation: StoredInstallation | null = await ctx.runQuery(internal.installations.forStore, { shopDomain })
  if (!installation) throw new ShopifyTokenLifecycleError('installation_missing', 'Shopify installation is missing', false)
  const now = Date.now()
  const plan = offlineTokenPlan(installation, now, options.forceRefresh)
  if (plan === 'valid') return { storeDomain: installation.shopDomain, accessToken: await decryptCredential(installation.encryptedAccessToken, installation.tokenIv, installation.tokenKeyVersion) }
  if (plan === 'reconnect') {
    const expired = installation.refreshTokenExpiresAt !== undefined && installation.refreshTokenExpiresAt - EXPIRY_SKEW_MS <= now
    throw new ShopifyTokenLifecycleError(expired ? 'expired_refresh_token' : 'reconnect_required', expired ? 'Shopify refresh token expired. Reconnect the store in Shopify admin to continue.' : 'Shopify credentials cannot be refreshed. Reconnect the store in Shopify admin to continue.', false)
  }

  const credentials = { apiKey: requiredEnv('SHOPIFY_API_KEY'), apiSecret: requiredEnv('SHOPIFY_API_SECRET'), shopDomain: installation.shopDomain }
  try {
    const refreshToken = await decryptCredential(installation.encryptedRefreshToken!, installation.refreshTokenIv!, installation.tokenKeyVersion)
    return await persistTokens(ctx, installation, await refreshOfflineToken({ ...credentials, refreshToken }))
  } catch (error) {
    // If a concurrent action rotated the refresh token while this request was
    // in flight, its persisted credential is authoritative even if Shopify
    // rejected our now-stale refresh token.
    const latest: StoredInstallation | null = await ctx.runQuery(internal.installations.forStore, { shopDomain })
    if (latest && latest.credentialGeneration !== installation.credentialGeneration) return latestConnection(ctx, shopDomain)
    if (error instanceof ShopifyTokenRequestError) throw lifecycleFailure(error)
    throw error
  }
}
