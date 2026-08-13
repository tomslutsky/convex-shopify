import { ConvexError, v } from 'convex/values'
import { action, env } from './_generated/server.js'

const DEFAULT_PARTNER_API_VERSION = '2026-07'
const REQUEST_TIMEOUT_MS = 15_000

const metadataValidator = v.object({
  requestId: v.union(v.string(), v.null()),
  apiVersion: v.union(v.string(), v.null()),
  httpStatus: v.number(),
  cost: v.union(v.null(), v.object({
    requestedQueryCost: v.union(v.number(), v.null()),
    actualQueryCost: v.union(v.number(), v.null()),
  })),
  throttleStatus: v.union(v.null(), v.object({
    maximumAvailable: v.union(v.number(), v.null()),
    currentlyAvailable: v.union(v.number(), v.null()),
    restoreRate: v.union(v.number(), v.null()),
  })),
})

const graphQLErrorValidator = v.object({
  message: v.string(),
  locations: v.array(v.object({ line: v.number(), column: v.number() })),
  path: v.array(v.union(v.string(), v.number())),
  extensions: v.record(v.string(), v.any()),
})

type Metadata = {
  requestId: string | null
  apiVersion: string | null
  httpStatus: number
  cost: { requestedQueryCost: number | null; actualQueryCost: number | null } | null
  throttleStatus: { maximumAvailable: number | null; currentlyAvailable: number | null; restoreRate: number | null } | null
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function responseMetadata(response: Response, body: unknown): Metadata {
  const extensions = record(record(body)?.extensions)
  const cost = record(extensions?.cost)
  const throttle = record(cost?.throttleStatus)
  return {
    requestId: response.headers.get('x-request-id') ?? response.headers.get('x-shopify-request-id'),
    apiVersion: response.headers.get('x-shopify-api-version'),
    httpStatus: response.status,
    cost: cost ? {
      requestedQueryCost: nullableNumber(cost.requestedQueryCost),
      actualQueryCost: nullableNumber(cost.actualQueryCost),
    } : null,
    throttleStatus: throttle ? {
      maximumAvailable: nullableNumber(throttle.maximumAvailable),
      currentlyAvailable: nullableNumber(throttle.currentlyAvailable),
      restoreRate: nullableNumber(throttle.restoreRate),
    } : null,
  }
}

function graphQLErrors(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const error = record(item)
    const locations = Array.isArray(error?.locations)
      ? error.locations.flatMap((location) => {
          const point = record(location)
          return typeof point?.line === 'number' && typeof point.column === 'number'
            ? [{ line: point.line, column: point.column }]
            : []
        })
      : []
    const path = Array.isArray(error?.path)
      ? error.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
      : []
    return {
      message: typeof error?.message === 'string' ? error.message : 'Unknown GraphQL error',
      locations,
      path,
      extensions: record(error?.extensions) ?? {},
    }
  })
}

function componentError(
  kind: 'not_configured' | 'authentication' | 'throttled' | 'http' | 'timeout' | 'network' | 'malformed_response',
  message: string,
  status: number | null,
  retryable: boolean,
  metadata: Metadata | null,
): ConvexError<{
  code: string
  kind: string
  message: string
  retryable: boolean
  status: number | null
  metadata: Metadata | null
}> {
  return new ConvexError({
    code: `SHOPIFY_PARTNER_${kind.toUpperCase()}`,
    kind,
    message,
    retryable,
    status,
    metadata,
  })
}

export const gql = action({
  args: { query: v.string(), variables: v.record(v.string(), v.any()) },
  returns: v.object({
    data: v.any(),
    errors: v.array(graphQLErrorValidator),
    metadata: metadataValidator,
  }),
  handler: async (_ctx, args) => {
    const organizationId = env.SHOPIFY_PARTNER_ORGANIZATION_ID
    const accessToken = env.SHOPIFY_PARTNER_ACCESS_TOKEN
    if (!organizationId || !accessToken) {
      throw componentError('not_configured', 'Shopify Partner API credentials are not configured', null, false, null)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      const version = env.SHOPIFY_PARTNER_API_VERSION ?? DEFAULT_PARTNER_API_VERSION
      response = await fetch(
        `https://partners.shopify.com/${encodeURIComponent(organizationId)}/api/${version}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
          body: JSON.stringify({ query: args.query, variables: args.variables }),
          signal: controller.signal,
        },
      )
    } catch {
      throw componentError(
        controller.signal.aborted ? 'timeout' : 'network',
        controller.signal.aborted ? 'Shopify Partner API request timed out' : 'Shopify Partner API network request failed',
        null,
        true,
        null,
      )
    } finally {
      clearTimeout(timeout)
    }

    const text = await response.text()
    let body: unknown = null
    let parsed = false
    if (text) {
      try {
        body = JSON.parse(text) as unknown
        parsed = true
      } catch {
        parsed = false
      }
    }
    const metadata = responseMetadata(response, body)
    if (response.status === 401) throw componentError('authentication', 'Shopify rejected the Partner API credential', 401, false, metadata)
    if (response.status === 429) throw componentError('throttled', 'Shopify Partner API request was throttled', 429, true, metadata)
    if (!response.ok) throw componentError('http', `Shopify Partner API request failed (${response.status})`, response.status, response.status >= 500, metadata)
    const envelope = record(body)
    if (!parsed || !envelope || (!Object.hasOwn(envelope, 'data') && !Array.isArray(envelope.errors)) || (Object.hasOwn(envelope, 'errors') && !Array.isArray(envelope.errors))) {
      throw componentError('malformed_response', 'Shopify Partner API returned a non-JSON or malformed GraphQL response', response.status, false, metadata)
    }
    return {
      data: Object.hasOwn(envelope, 'data') ? envelope.data ?? null : null,
      errors: graphQLErrors(envelope.errors),
      metadata,
    }
  },
})
