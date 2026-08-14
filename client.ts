import { print } from 'graphql'
import { createFunctionHandle } from 'convex/server'
import { asShopifyCursor } from './pagination.js'
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import type { ComponentApi } from './component/_generated/component.js'
import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from 'convex/server'

export { asShopifyCursor, type ShopifyCursor } from './pagination.js'

export type SerializableValue =
  | null
  | boolean
  | number
  | string
  | Array<SerializableValue>
  | { [key: string]: SerializableValue }

export type SerializableVariables = Record<string, SerializableValue>

/**
 * Operation maps augmented by Shopify's `@shopify/api-codegen-preset`.
 * Generated `#graphql` strings infer exact variables and results; an operation
 * not seen by codegen remains available with serializable variables and an
 * `unknown` result.
 * `TypedDocumentNode` remains the explicit advanced escape hatch.
 */
export interface AdminQueries {
  [key: string]: { variables: unknown; return: unknown }
  [key: number | symbol]: never
}

export interface AdminMutations {
  [key: string]: { variables: unknown; return: unknown }
  [key: number | symbol]: never
}

export type AdminOperations = AdminQueries & AdminMutations

type IsUnknown<T> = unknown extends T
  ? [keyof T] extends [never]
    ? true
    : false
  : false

type SerializableOperationValue<T> = IsUnknown<T> extends true
  ? SerializableValue
  : T extends null | boolean | number | string
    ? T
    : T extends ReadonlyArray<infer TItem>
      ? Array<SerializableOperationValue<Exclude<TItem, undefined>>>
      : T extends object
        ? { [TKey in keyof T]: SerializableOperationValue<Exclude<T[TKey], undefined>> }
        : never

type AdminOperationVariables<TOperation extends keyof AdminOperations> =
  IsUnknown<AdminOperations[TOperation]['variables']> extends true
    ? SerializableVariables
    : SerializableOperationValue<AdminOperations[TOperation]['variables']>

type AdminGraphQLParameters<TOperation extends keyof AdminOperations> =
  AdminOperations[TOperation]['variables'] extends Record<string, never>
    ? [operation: TOperation, options?: { variables?: Record<string, never> }]
    : [
        operation: TOperation,
        options: { variables: AdminOperationVariables<TOperation> },
      ]

export type ShopifyGraphQLError = {
  message: string
  locations: Array<{ line: number; column: number }>
  path: Array<string | number>
  extensions: Record<string, SerializableValue>
}

export type ShopifyGraphQLCost = {
  requestedQueryCost: number | null
  actualQueryCost: number | null
}

export type ShopifyThrottleStatus = {
  maximumAvailable: number | null
  currentlyAvailable: number | null
  restoreRate: number | null
}

export type ShopifyGraphQLMetadata = {
  requestId: string | null
  apiVersion: string | null
  httpStatus: number
  cost: ShopifyGraphQLCost | null
  throttleStatus: ShopifyThrottleStatus | null
}

export type ShopifyComponentErrorKind =
  | 'not_configured'
  | 'installation_missing'
  | 'transient_refresh_failure'
  | 'invalid_refresh_token'
  | 'expired_refresh_token'
  | 'reconnect_required'
  | 'token_exchange_rejected'
  | 'authentication'
  | 'throttled'
  | 'http'
  | 'timeout'
  | 'network'
  | 'malformed_response'
  | 'unexpected'

/** Serializable data carried by ConvexError across the component boundary. */
export type ShopifyComponentErrorData = {
  code: string
  kind: ShopifyComponentErrorKind
  message: string
  retryable: boolean
  status: number | null
  metadata: ShopifyGraphQLMetadata | null
}

/** Read the serializable error payload returned across a Convex boundary. */
export function shopifyComponentErrorData(
  error: unknown,
): ShopifyComponentErrorData | null {
  if (typeof error !== 'object' || error === null || !('data' in error))
    return null
  const data = (error as { data?: unknown }).data
  if (typeof data !== 'object' || data === null) return null
  const candidate = data as Partial<ShopifyComponentErrorData>
  return typeof candidate.code === 'string' &&
    typeof candidate.kind === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.retryable === 'boolean'
    ? (candidate as ShopifyComponentErrorData)
    : null
}

/**
 * `data` is statically inferred from the document. The component does not
 * runtime-validate Shopify's response against that TypeScript type.
 */
export type ShopifyGraphQLResult<TResult> = {
  data: TResult | null
  errors: Array<ShopifyGraphQLError>
  metadata: ShopifyGraphQLMetadata
}

export type ShopifyConnectionState =
  | {
      status: 'not_installed'
      scopes: Array<string>
      missingScopes: Array<string>
      accessTokenExpiresAt: null
      refreshTokenExpiresAt: null
    }
  | {
      status: 'ready'
      scopes: Array<string>
      missingScopes: []
      accessTokenExpiresAt: number | null
      refreshTokenExpiresAt: number | null
    }
  | {
      status: 'missing_scopes'
      scopes: Array<string>
      missingScopes: Array<string>
      accessTokenExpiresAt: number | null
      refreshTokenExpiresAt: number | null
    }
  | {
      status: 'reconnect_required'
      scopes: Array<string>
      missingScopes: Array<string>
      accessTokenExpiresAt: number | null
      refreshTokenExpiresAt: number | null
    }

export type ShopifyInstallationSnapshot = {
  installed: boolean
  scopes: Array<string>
  missingScopes: Array<string>
  accessTokenExpiresAt: number | null
  refreshTokenExpiresAt: number | null
}

export type ShopifyConnectResult = {
  shopDomain: string
  shopifyUserId: string
  state: Exclude<ShopifyConnectionState, { status: 'not_installed' }>
}

export type VerifiedWebhookDelivery = {
  verified: true
  delivery: {
    rawBody: ArrayBuffer
    payload: unknown
    shopDomain: string
    topic: string
    webhookId: string
  }
}

export type RejectedWebhookDelivery = {
  verified: false
  reason:
    'invalid_hmac' | 'invalid_json' | 'invalid_shop_domain' | 'missing_metadata'
}

export type WebhookVerificationResult =
  VerifiedWebhookDelivery | RejectedWebhookDelivery

type MaybePromise<T> = T | Promise<T>

type QueryCtx = {
  runQuery: <TQuery extends FunctionReference<'query', 'internal'>>(
    query: TQuery,
    ...args: OptionalRestArgs<TQuery>
  ) => Promise<FunctionReturnType<TQuery>>
}

type MutationCtx = {
  runMutation: <TMutation extends FunctionReference<'mutation', 'internal'>>(
    mutation: TMutation,
    ...args: OptionalRestArgs<TMutation>
  ) => Promise<FunctionReturnType<TMutation>>
}

type ActionCtx = {
  runAction: <TAction extends FunctionReference<'action', 'internal'>>(
    action: TAction,
    ...args: OptionalRestArgs<TAction>
  ) => Promise<FunctionReturnType<TAction>>
  runQuery: QueryCtx['runQuery']
  runMutation: MutationCtx['runMutation']
}

export type ShopifyAppOptions<TName extends string | undefined> = {
  component: ComponentApi<TName>
}

export type ShopifySession = {
  /** Shopify-compatible deterministic ID for the shop's offline session. */
  id: string
  shop: string
  isOnline: false
  /** Shopify-compatible comma-separated scope representation. */
  scope: string
  /** Normalized scopes for ergonomic application checks. */
  scopes: Array<string>
  expires: number | null
  refreshTokenExpires: number | null
  missingScopes: Array<string>
}

export type ShopifyAdminGraphQL = <
  TOperation extends keyof AdminOperations = string,
>(
  ...params: AdminGraphQLParameters<TOperation>
) => Promise<ShopifyGraphQLResult<AdminOperations[TOperation]['return']>>

export type ShopifyTypedDocumentGraphQL = {
  <TResult, TVariables extends SerializableVariables>(
    document: TypedDocumentNode<TResult, TVariables>,
    options: { variables: TVariables },
  ): Promise<ShopifyGraphQLResult<TResult>>
}

export type ShopifyAdminContext = {
  graphql: ShopifyAdminGraphQL
  /** Advanced escape hatch for clients using TypedDocumentNode codegen. */
  graphqlDocument: ShopifyTypedDocumentGraphQL
}

export type ShopifyAuthenticatedAdmin = {
  admin: ShopifyAdminContext
  session: ShopifySession
  /** The user subject verified from the incoming Shopify session token. */
  shopifyUserId: string
}

export type ShopifyOfflineAdmin = {
  admin: ShopifyAdminContext
  session: ShopifySession
}

export type ShopifyWebhookContext = {
  shop: string
  topic: string
  payload: unknown
  webhookId: string
  rawBody: ArrayBuffer
  session: ShopifySession | null
}

export type ShopifyWebhookHandlerArgs = {
  webhookId: string
  shopDomain: string
  topic: string
  payload: unknown
}

export type ShopifyWebhookHandler = FunctionReference<
  'mutation',
  'internal',
  ShopifyWebhookHandlerArgs,
  unknown
>

export type ShopifyFailedWebhookDelivery = {
  deliveryId: string
  webhookId: string
  shopDomain: string
  topic: string
  error: string
  completedAt: number
}

export type ShopifyWebhookAuthenticationErrorReason =
  'missing_metadata' | 'invalid_shop_domain' | 'invalid_hmac' | 'invalid_json'

export class ShopifyWebhookAuthenticationError extends Error {
  readonly name = 'ShopifyWebhookAuthenticationError'

  constructor(readonly reason: ShopifyWebhookAuthenticationErrorReason) {
    super(`Shopify webhook authentication failed: ${reason}`)
  }
}

export type ShopifyClientOptions<TAuthorizationContext> = {
  /** Resolve a shop only after authenticating and authorizing the app user. */
  resolveShop: (ctx: TAuthorizationContext) => MaybePromise<string>
}

export type ShopifyGraphQLArgs<
  TResult,
  TVariables extends SerializableVariables,
> = {
  document: TypedDocumentNode<TResult, TVariables>
  variables: TVariables
}

export type ShopifyWebhookRequest = {
  rawBody: ArrayBuffer | Uint8Array | string
  hmac: string
  shopDomain: string
  topic: string
  webhookId: string
}

type RawConnectionState = {
  status?: ShopifyConnectionState['status']
  installed?: boolean
  scopes?: Array<string>
  grantedScopes?: string
  missingScopes?: Array<string>
  accessTokenExpiresAt?: number | null
  refreshTokenExpiresAt?: number | null
}

type RawGraphQLResult = {
  data?: unknown
  errors?: unknown
  metadata?: unknown
}

const SHOP_DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/

/**
 * Create a Shopify-template-shaped facade for a mounted Convex component.
 * Credentials remain component-private; all returned sessions are sanitized.
 */
export function shopifyApp<TName extends string | undefined>(
  options: ShopifyAppOptions<TName>,
) {
  const { component } = options
  const webhookComponent = component as unknown as { webhooks: {
    accept: FunctionReference<'mutation', 'internal', {
      webhookId: string
      shopDomain: string
      topic: string
      payload: unknown
      handler: string
      deduplicate: boolean
    }, { status: 'accepted' | 'duplicate'; deliveryId: string }>
    listFailed: FunctionReference<'query', 'internal', { limit?: number }, Array<ShopifyFailedWebhookDelivery>>
    replay: FunctionReference<'mutation', 'internal', { deliveryId: string }, null>
  } }

  function adminContext(ctx: ActionCtx, shop: string): ShopifyAdminContext {
    const normalizedShop = normalizeShopDomain(shop)
    const graphql = async (
      operation: string | TypedDocumentNode<unknown, SerializableVariables>,
      graphqlOptions: { variables?: SerializableVariables } = {},
    ): Promise<ShopifyGraphQLResult<unknown>> => {
      assertSerializableVariables(graphqlOptions.variables ?? {})
      const raw = await ctx.runAction(component.admin.gql, {
        shopDomain: normalizedShop,
        query: typeof operation === 'string' ? operation : print(operation),
        variables: graphqlOptions.variables ?? {},
      })
      return normalizeGraphQLResult<unknown>(raw)
    }
    return {
      graphql: graphql as unknown as ShopifyAdminGraphQL,
      graphqlDocument: graphql as ShopifyTypedDocumentGraphQL,
    }
  }

  async function loadShopSession(
    ctx: QueryCtx,
    shop: string,
  ): Promise<ShopifySession | null> {
    const normalizedShop = normalizeShopDomain(shop)
    const snapshot = normalizeInstallationSnapshot(
      await ctx.runQuery(component.auth.snapshot, {
        shopDomain: normalizedShop,
      }),
    )
    return snapshot.installed
      ? sessionFromSnapshot(normalizedShop, snapshot)
      : null
  }

  const sessionStorage = {
    loadSession: async (
      ctx: QueryCtx,
      id: string,
    ): Promise<ShopifySession | null> => {
      const shop = shopFromOfflineSessionId(id)
      return shop === null ? null : await loadShopSession(ctx, shop)
    },
    findSessionByShop: async (
      ctx: QueryCtx,
      shop: string,
    ): Promise<ShopifySession | null> => await loadShopSession(ctx, shop),
    deleteSession: async (ctx: MutationCtx, id: string): Promise<boolean> => {
      const shop = shopFromOfflineSessionId(id)
      if (shop === null) return false
      await ctx.runMutation(component.install.uninstall, { shopDomain: shop })
      return true
    },
    deleteSessionsForShop: async (
      ctx: MutationCtx,
      shop: string,
    ): Promise<boolean> => {
      await ctx.runMutation(component.install.uninstall, {
        shopDomain: normalizeShopDomain(shop),
      })
      return true
    },
  }

  return {
    installations: {
      reconcileScopes: async (
        ctx: MutationCtx,
        args: { shopDomain: string; scopes: Array<string> },
      ): Promise<{ installed: boolean; changed: boolean; scopes: Array<string> }> =>
        await ctx.runMutation(component.install.reconcileScopes, {
          shopDomain: normalizeShopDomain(args.shopDomain),
          scopes: args.scopes,
        }),
    },
    authenticate: {
      admin: async (
        ctx: ActionCtx,
        args: { sessionToken: string },
      ): Promise<ShopifyAuthenticatedAdmin> => {
        const raw = await ctx.runAction(
          component.auth.exchangeSessionToken,
          args,
        )
        const candidate = raw as unknown as {
          shopDomain: string
          shopifyUserId: string
          state: RawConnectionState
        }
        const shop = normalizeShopDomain(candidate.shopDomain)
        const state = normalizeConnectionState(candidate.state)
        if (state.status === 'not_installed') {
          throw new Error(
            'Shopify token exchange did not create an offline session',
          )
        }
        if (state.status === 'reconnect_required') {
          throw new Error(
            'Shopify offline session requires merchant reauthorization',
          )
        }
        return {
          admin: adminContext(ctx, shop),
          session: sessionFromState(shop, state),
          shopifyUserId: candidate.shopifyUserId,
        }
      },
      webhook: async (
        ctx: ActionCtx,
        request: Request,
      ): Promise<ShopifyWebhookContext> => {
        const hmac = request.headers.get('x-shopify-hmac-sha256')?.trim()
        const rawShop = request.headers.get('x-shopify-shop-domain')?.trim()
        const rawTopic = request.headers.get('x-shopify-topic')?.trim()
        const webhookId = request.headers.get('x-shopify-webhook-id')?.trim()
        if (!hmac || !rawShop || !rawTopic || !webhookId) {
          throw new ShopifyWebhookAuthenticationError('missing_metadata')
        }
        let shop: string
        try {
          shop = normalizeShopDomain(rawShop)
        } catch {
          throw new ShopifyWebhookAuthenticationError('invalid_shop_domain')
        }
        const rawBody = await request.arrayBuffer()
        const valid = await ctx.runAction(
          component.webhooks.verifyRequestHmac,
          {
            body: rawBody,
            signature: hmac,
          },
        )
        if (!valid) throw new ShopifyWebhookAuthenticationError('invalid_hmac')
        let payload: unknown
        try {
          payload = JSON.parse(new TextDecoder().decode(rawBody)) as unknown
        } catch {
          throw new ShopifyWebhookAuthenticationError('invalid_json')
        }
        return {
          shop,
          topic: normalizeWebhookTopic(rawTopic),
          payload,
          webhookId,
          rawBody,
          session: await loadShopSession(ctx, shop),
        }
      },
    },
    unauthenticated: {
      /** Use only after app code has selected and authorized this shop. */
      admin: async (
        ctx: ActionCtx,
        shop: string,
      ): Promise<ShopifyOfflineAdmin> => {
        const normalizedShop = normalizeShopDomain(shop)
        const state = normalizeConnectionState(
          await ctx.runAction(component.auth.getState, {
            shopDomain: normalizedShop,
          }),
        )
        if (state.status === 'not_installed') {
          throw new Error(
            `No offline Shopify session exists for ${normalizedShop}`,
          )
        }
        if (state.status === 'reconnect_required') {
          throw new Error(
            `Shopify offline session for ${normalizedShop} requires merchant reauthorization`,
          )
        }
        return {
          admin: adminContext(ctx, normalizedShop),
          session: sessionFromState(normalizedShop, state),
        }
      },
    },
    sessionStorage,
    webhooks: {
      accept: async (
        ctx: MutationCtx,
        delivery: ShopifyWebhookContext,
        options: {
          handler: ShopifyWebhookHandler
          deduplicate?: boolean
        },
      ) => {
        const handler = await createFunctionHandle(options.handler)
        return await ctx.runMutation(webhookComponent.webhooks.accept, {
          webhookId: delivery.webhookId,
          shopDomain: delivery.shop,
          topic: delivery.topic,
          payload: delivery.payload,
          handler,
          deduplicate: options.deduplicate ?? true,
        })
      },
      listFailed: async (
        ctx: QueryCtx,
        options: { limit?: number } = {},
      ): Promise<Array<ShopifyFailedWebhookDelivery>> =>
        await ctx.runQuery(webhookComponent.webhooks.listFailed, options),
      replay: async (ctx: MutationCtx, deliveryId: string): Promise<null> =>
        await ctx.runMutation(webhookComponent.webhooks.replay, { deliveryId }),
    },
    operations: {
      credentials: {
        rotate: async (
          ctx: ActionCtx,
          args: {
            cursor?: string | null
            batchSize?: number
            dryRun?: boolean
          } = {},
        ) => await ctx.runAction(component.install.reencrypt, args),
      },
    },
  }
}

/**
 * Create the supported, app-authorized facade for a mounted Shopify component.
 * The mount name is inferred from the supplied generated component reference.
 */
export function createShopifyClient<
  TName extends string | undefined,
  TAuthorizationContext,
>(
  component: ComponentApi<TName>,
  options: ShopifyClientOptions<TAuthorizationContext>,
) {
  async function resolveAuthorizedShop(
    ctx: TAuthorizationContext,
  ): Promise<string> {
    return normalizeShopDomain(await options.resolveShop(ctx))
  }

  function scoped(shopDomain: string) {
    const normalizedShop = normalizeShopDomain(shopDomain)
    return {
      installation: {
        get: async (ctx: ActionCtx): Promise<ShopifyConnectionState> =>
          normalizeConnectionState(
            await ctx.runAction(component.auth.getState, {
              shopDomain: normalizedShop,
            }),
          ),
        snapshot: async (ctx: QueryCtx): Promise<ShopifyInstallationSnapshot> =>
          normalizeInstallationSnapshot(
            await ctx.runQuery(component.auth.snapshot, {
              shopDomain: normalizedShop,
            }),
          ),
        disconnect: async (ctx: MutationCtx): Promise<null> =>
          await ctx.runMutation(component.install.uninstall, {
            shopDomain: normalizedShop,
          }),
      },
      admin: {
        graphql: async <TResult, TVariables extends SerializableVariables>(
          ctx: ActionCtx,
          args: ShopifyGraphQLArgs<TResult, TVariables>,
        ): Promise<ShopifyGraphQLResult<TResult>> => {
          const raw = await ctx.runAction(component.admin.gql, {
            shopDomain: normalizedShop,
            query: print(args.document),
            variables: args.variables,
          })
          return normalizeGraphQLResult<TResult>(raw)
        },
      },
    }
  }

  return {
    auth: {
      connect: async (
        ctx: ActionCtx,
        args: { sessionToken: string },
      ): Promise<ShopifyConnectResult> => {
        const raw = await ctx.runAction(
          component.auth.exchangeSessionToken,
          args,
        )
        const candidate = raw as unknown as {
          shopDomain: string
          shopifyUserId: string
          state?: RawConnectionState
          scopes?: Array<string>
          grantedScopes?: string
          missingScopes?: Array<string>
        }
        const state = normalizeConnectionState(
          candidate.state ?? {
            installed: true,
            scopes: candidate.scopes,
            grantedScopes: candidate.grantedScopes,
            missingScopes: candidate.missingScopes,
          },
        )
        if (state.status === 'not_installed')
          throw new Error(
            'Shopify token exchange did not create an installation',
          )
        return {
          shopDomain: normalizeShopDomain(candidate.shopDomain),
          shopifyUserId: candidate.shopifyUserId,
          state,
        }
      },
      verifySessionToken: async (
        ctx: ActionCtx,
        args: { sessionToken: string },
      ) => await ctx.runAction(component.auth.verifySessionToken, args),
    },
    installation: {
      get: async (
        ctx: TAuthorizationContext & ActionCtx,
      ): Promise<ShopifyConnectionState> =>
        await scoped(await resolveAuthorizedShop(ctx)).installation.get(ctx),
      snapshot: async (
        ctx: TAuthorizationContext & QueryCtx,
      ): Promise<ShopifyInstallationSnapshot> =>
        await scoped(await resolveAuthorizedShop(ctx)).installation.snapshot(
          ctx,
        ),
      disconnect: async (
        ctx: TAuthorizationContext & MutationCtx,
      ): Promise<null> =>
        await scoped(await resolveAuthorizedShop(ctx)).installation.disconnect(
          ctx,
        ),
    },
    admin: {
      graphql: async <TResult, TVariables extends SerializableVariables>(
        ctx: TAuthorizationContext & ActionCtx,
        args: ShopifyGraphQLArgs<TResult, TVariables>,
      ): Promise<ShopifyGraphQLResult<TResult>> =>
        await scoped(await resolveAuthorizedShop(ctx)).admin.graphql(ctx, args),
      cursor: asShopifyCursor,
    },
    webhooks: {
      /** Verify the exact raw body before parsing it. Delivery deduplication remains app-owned. */
      verifyRequest: async (
        ctx: ActionCtx,
        request: ShopifyWebhookRequest,
      ): Promise<WebhookVerificationResult> => {
        if (!request.topic.trim() || !request.webhookId.trim())
          return { verified: false, reason: 'missing_metadata' }
        let shopDomain: string
        try {
          shopDomain = normalizeShopDomain(request.shopDomain)
        } catch {
          return { verified: false, reason: 'invalid_shop_domain' }
        }
        const rawBody = toArrayBuffer(request.rawBody)
        const valid = await ctx.runAction(
          component.webhooks.verifyRequestHmac,
          { body: rawBody, signature: request.hmac },
        )
        if (!valid) return { verified: false, reason: 'invalid_hmac' }
        try {
          const payload: unknown = JSON.parse(new TextDecoder().decode(rawBody))
          return {
            verified: true,
            delivery: {
              rawBody,
              payload,
              shopDomain,
              topic: request.topic,
              webhookId: request.webhookId,
            },
          }
        } catch {
          return { verified: false, reason: 'invalid_json' }
        }
      },
    },
    operations: {
      credentials: {
        rotate: async (
          ctx: ActionCtx,
          args: {
            cursor?: string | null
            batchSize?: number
            dryRun?: boolean
          } = {},
        ) => await ctx.runAction(component.install.reencrypt, args),
      },
    },
    /** Explicit escape hatch for already-authorized multi-shop server workflows. */
    forShop: scoped,
  }
}

function normalizeShopDomain(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!SHOP_DOMAIN.test(normalized))
    throw new Error('Expected a supported *.myshopify.com shop domain')
  return normalized
}

function splitScopes(value: string | undefined): Array<string> {
  return (
    value
      ?.split(',')
      .map((scope) => scope.trim())
      .filter(Boolean) ?? []
  )
}

function normalizeConnectionState(value: unknown): ShopifyConnectionState {
  const raw = (value ?? {}) as RawConnectionState
  const scopes = raw.scopes ?? splitScopes(raw.grantedScopes)
  const missingScopes = raw.missingScopes ?? []
  const status =
    raw.status ??
    (raw.installed === false
      ? 'not_installed'
      : missingScopes.length > 0
        ? 'missing_scopes'
        : 'ready')
  const accessTokenExpiresAt = raw.accessTokenExpiresAt ?? null
  const refreshTokenExpiresAt = raw.refreshTokenExpiresAt ?? null
  if (status === 'not_installed')
    return {
      status,
      scopes,
      missingScopes,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    }
  if (status === 'ready')
    return {
      status,
      scopes,
      missingScopes: [],
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    }
  return {
    status,
    scopes,
    missingScopes,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  }
}

function normalizeInstallationSnapshot(
  value: unknown,
): ShopifyInstallationSnapshot {
  const raw = (value ?? {}) as RawConnectionState
  return {
    installed: raw.installed === true,
    scopes: [...new Set(raw.scopes ?? splitScopes(raw.grantedScopes))].sort(),
    missingScopes: [...new Set(raw.missingScopes ?? [])].sort(),
    accessTokenExpiresAt: raw.accessTokenExpiresAt ?? null,
    refreshTokenExpiresAt: raw.refreshTokenExpiresAt ?? null,
  }
}

function offlineSessionId(shop: string): string {
  return `offline_${normalizeShopDomain(shop)}`
}

function normalizeWebhookTopic(topic: string): string {
  return topic.trim().replaceAll('/', '_').toUpperCase()
}

function shopFromOfflineSessionId(id: string): string | null {
  if (!id.startsWith('offline_')) return null
  try {
    return normalizeShopDomain(id.slice('offline_'.length))
  } catch {
    return null
  }
}

function sessionFromState(
  shop: string,
  state: Exclude<ShopifyConnectionState, { status: 'not_installed' }>,
): ShopifySession {
  const scopes = [...new Set(state.scopes)].sort()
  return {
    id: offlineSessionId(shop),
    shop,
    isOnline: false,
    scope: scopes.join(','),
    scopes,
    expires: state.accessTokenExpiresAt,
    refreshTokenExpires: state.refreshTokenExpiresAt,
    missingScopes: [...new Set(state.missingScopes)].sort(),
  }
}

function sessionFromSnapshot(
  shop: string,
  snapshot: ShopifyInstallationSnapshot,
): ShopifySession {
  const state: Exclude<ShopifyConnectionState, { status: 'not_installed' }> =
    snapshot.missingScopes.length > 0
      ? {
          status: 'missing_scopes',
          scopes: snapshot.scopes,
          missingScopes: snapshot.missingScopes,
          accessTokenExpiresAt: snapshot.accessTokenExpiresAt,
          refreshTokenExpiresAt: snapshot.refreshTokenExpiresAt,
        }
      : {
          status: 'ready',
          scopes: snapshot.scopes,
          missingScopes: [],
          accessTokenExpiresAt: snapshot.accessTokenExpiresAt,
          refreshTokenExpiresAt: snapshot.refreshTokenExpiresAt,
        }
  return sessionFromState(shop, state)
}

function normalizeGraphQLResult<TResult>(
  value: unknown,
): ShopifyGraphQLResult<TResult> {
  if (typeof value !== 'object' || value === null || !('metadata' in value)) {
    throw new Error('Shopify component returned an invalid GraphQL result')
  }
  const raw = value as RawGraphQLResult
  return {
    data: (raw.data ?? null) as TResult | null,
    errors: (Array.isArray(raw.errors)
      ? raw.errors
      : []) as Array<ShopifyGraphQLError>,
    metadata: raw.metadata as ShopifyGraphQLMetadata,
  }
}

function toArrayBuffer(body: ArrayBuffer | Uint8Array | string): ArrayBuffer {
  if (typeof body === 'string') return new TextEncoder().encode(body).buffer
  if (body instanceof ArrayBuffer) return body.slice(0)
  return body.slice().buffer
}

function assertSerializableVariables(
  variables: unknown,
  path = 'variables',
): asserts variables is SerializableVariables {
  if (variables === null || typeof variables !== 'object' || Array.isArray(variables))
    throw new Error('Shopify GraphQL variables must be a serializable object record')
  if (Object.getPrototypeOf(variables) !== Object.prototype)
    throw new Error(`Shopify GraphQL ${path} must be a plain object`)
  for (const [key, value] of Object.entries(variables))
    assertSerializableValue(value, `${path}.${key}`)
}

function assertSerializableValue(
  value: unknown,
  path: string,
): asserts value is SerializableValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) return
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertSerializableValue(entry, `${path}[${index}]`),
    )
    return
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, entry] of Object.entries(value))
      assertSerializableValue(entry, `${path}.${key}`)
    return
  }
  throw new Error(`Shopify GraphQL ${path} must be Convex-serializable`)
}
