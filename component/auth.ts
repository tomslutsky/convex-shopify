import { ConvexError, v } from 'convex/values'
import { action, query } from './_generated/server.js'
import { internal } from './_generated/api.js'
import { encryptCredential } from './lib/credentialCrypto.js'
import { ShopifyTokenRequestError, exchangeOfflineToken, requiredEnv, verifyShopifySessionToken } from './lib/shopifyAuth.js'

const stateFields = {
  scopes: v.array(v.string()), missingScopes: v.array(v.string()), accessTokenExpiresAt: v.union(v.number(), v.null()), refreshTokenExpiresAt: v.union(v.number(), v.null()),
}
const connectionState = v.union(
  v.object({ status: v.literal('not_installed'), ...stateFields }),
  v.object({ status: v.literal('ready'), ...stateFields }),
  v.object({ status: v.literal('missing_scopes'), ...stateFields }),
  v.object({ status: v.literal('reconnect_required'), ...stateFields }),
)
const installationSnapshot = v.object({ installed: v.boolean(), ...stateFields })
type ConnectionState = {
  status: 'not_installed' | 'ready' | 'missing_scopes' | 'reconnect_required'
  scopes: Array<string>
  missingScopes: Array<string>
  accessTokenExpiresAt: number | null
  refreshTokenExpiresAt: number | null
}
type InstallationSnapshot = Omit<ConnectionState, 'status'> & { installed: boolean }

function classifyState(installed: boolean, state: Omit<ConnectionState, 'status'>, now: number): ConnectionState {
  if (!installed) return { status: 'not_installed', ...state }
  if (state.missingScopes.length > 0) return { status: 'missing_scopes', ...state }
  if (state.accessTokenExpiresAt !== null && state.accessTokenExpiresAt <= now && (state.refreshTokenExpiresAt === null || state.refreshTokenExpiresAt <= now)) return { status: 'reconnect_required', ...state }
  return { status: 'ready', ...state }
}

function throwAuthError(error: unknown): never {
  if (error instanceof ConvexError) throw error
  if (error instanceof ShopifyTokenRequestError) {
    throw new ConvexError({
      code: 'SHOPIFY_TOKEN_EXCHANGE_REJECTED',
      kind: 'token_exchange_rejected',
      message: error.message,
      retryable: error.retryable,
      status: error.status,
      metadata: null,
    })
  }
  const message = error instanceof Error ? error.message : 'Shopify authentication failed'
  const authenticationFailure = /jwt|session-token|signature|audience|issuer|destination|claim|expired|not before/i.test(message)
  throw new ConvexError({
    code: authenticationFailure ? 'SHOPIFY_AUTHENTICATION' : 'SHOPIFY_UNEXPECTED',
    kind: authenticationFailure ? 'authentication' : 'unexpected',
    message,
    retryable: false,
    status: null,
    metadata: null,
  })
}

export const exchangeSessionToken = action({
  args: { sessionToken: v.string() },
  returns: v.object({ shopDomain: v.string(), shopifyUserId: v.string(), state: connectionState }),
  handler: async (ctx, args): Promise<{ shopDomain: string; shopifyUserId: string; state: ConnectionState }> => {
    try {
      const session = await verifyShopifySessionToken(args.sessionToken)
      const { shopDomain, shopifyUserId } = session
      let installed: boolean = await ctx.runQuery(internal.installations.existsForShop, { shopDomain })
      let stored: Omit<ConnectionState, 'status'> = await ctx.runQuery(internal.installations.state, { shopDomain })
      const accessTokenStale = stored.accessTokenExpiresAt === null || stored.accessTokenExpiresAt <= Date.now() + 60_000
      if (!installed || stored.missingScopes.length > 0 || accessTokenStale) {
        const exchanged = await exchangeOfflineToken({ apiKey: requiredEnv('SHOPIFY_API_KEY'), apiSecret: requiredEnv('SHOPIFY_API_SECRET'), sessionToken: args.sessionToken, shopDomain })
        const now = Date.now()
        const access = await encryptCredential(exchanged.accessToken)
        const refresh = await encryptCredential(exchanged.refreshToken)
        await ctx.runMutation(internal.installations.upsert, {
          shopDomain, scopes: exchanged.scopes, ...access, accessTokenExpiresAt: now + exchanged.expiresIn * 1_000,
          encryptedRefreshToken: refresh.encryptedAccessToken, refreshTokenIv: refresh.tokenIv, refreshTokenExpiresAt: now + exchanged.refreshTokenExpiresIn * 1_000,
        })
        installed = true
        stored = await ctx.runQuery(internal.installations.state, { shopDomain })
      }
      return { shopDomain, shopifyUserId, state: classifyState(installed, stored, Date.now()) }
    } catch (error) {
      throwAuthError(error)
    }
  },
})

// JWT exp/nbf verification depends on wall-clock time and therefore must never
// be exposed as a cacheable Convex query.
export const verifySessionToken = action({
  args: { sessionToken: v.string() },
  returns: v.object({ shopDomain: v.string(), shopifyUserId: v.string() }),
  handler: async (_ctx, args) => {
    try {
      const session = await verifyShopifySessionToken(args.sessionToken)
      return { shopDomain: session.shopDomain, shopifyUserId: session.shopifyUserId }
    } catch (error) {
      throwAuthError(error)
    }
  },
})

export const state = query({
  args: { shopDomain: v.string(), now: v.optional(v.number()) },
  returns: connectionState,
  handler: async (ctx, args): Promise<ConnectionState> => {
    const installed: boolean = await ctx.runQuery(internal.installations.existsForShop, { shopDomain: args.shopDomain })
    const stored: Omit<ConnectionState, 'status'> = await ctx.runQuery(internal.installations.state, { shopDomain: args.shopDomain })
    return classifyState(installed, stored, args.now ?? 0)
  },
})

// Stored facts for reactive application queries. This intentionally performs
// no wall-clock classification, so the result remains safe to cache.
export const snapshot = query({
  args: { shopDomain: v.string() },
  returns: installationSnapshot,
  handler: async (ctx, args): Promise<InstallationSnapshot> =>
    await ctx.runQuery(internal.installations.snapshot, { shopDomain: args.shopDomain }),
})

// The supported facade uses this non-cacheable action for an authoritative
// connection state without making consumers pass an implementation clock.
export const getState = action({
  args: { shopDomain: v.string() },
  returns: connectionState,
  handler: async (ctx, args): Promise<ConnectionState> => {
    const stored: InstallationSnapshot = await ctx.runQuery(internal.installations.snapshot, { shopDomain: args.shopDomain })
    const { installed, ...connectionFacts } = stored
    return classifyState(installed, connectionFacts, Date.now())
  },
})
