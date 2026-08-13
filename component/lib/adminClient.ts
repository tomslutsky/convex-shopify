import { env } from '../_generated/server.js'

export type ShopifyConnection = { storeDomain: string; accessToken: string }

const DEFAULT_API_VERSION = '2026-07'
const REQUEST_TIMEOUT_MS = 15_000

export type ShopifyGraphQLErrorValue = {
  message: string
  locations: Array<{ line: number; column: number }>
  path: Array<string | number>
  extensions: Record<string, unknown>
}

export type ShopifyResponseMetadata = {
  requestId: string | null
  apiVersion: string | null
  httpStatus: number
  cost: { requestedQueryCost: number | null; actualQueryCost: number | null } | null
  throttleStatus: { maximumAvailable: number | null; currentlyAvailable: number | null; restoreRate: number | null } | null
}

export type ShopifyGraphQLResult = {
  data: unknown | null
  errors: Array<ShopifyGraphQLErrorValue>
  metadata: ShopifyResponseMetadata
}

export type ShopifyTransportFailureKind = 'authentication' | 'throttled' | 'http' | 'timeout' | 'network' | 'malformed_response'

export class ShopifyTransportError extends Error {
  constructor(
    public readonly kind: ShopifyTransportFailureKind,
    message: string,
    public readonly status: number | null,
    public readonly retryable: boolean,
    public readonly responseMetadata: ShopifyResponseMetadata | null,
  ) {
    super(message)
  }
}

function nullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function metadata(response: Response, body: unknown): ShopifyResponseMetadata {
  const envelope = record(body)
  const extensions = record(envelope?.extensions)
  const cost = record(extensions?.cost)
  const rawThrottleStatus = record(cost?.throttleStatus)
  const firstError = Array.isArray(envelope?.errors) ? record(envelope.errors[0]) : null
  const errorExtensions = record(firstError?.extensions)
  const throttleStatus = rawThrottleStatus ? {
    maximumAvailable: nullableNumber(rawThrottleStatus.maximumAvailable),
    currentlyAvailable: nullableNumber(rawThrottleStatus.currentlyAvailable),
    restoreRate: nullableNumber(rawThrottleStatus.restoreRate),
  } : null
  return {
    requestId: response.headers.get('x-request-id') ?? response.headers.get('x-shopify-request-id') ?? (typeof errorExtensions?.requestId === 'string' ? errorExtensions.requestId : null),
    apiVersion: response.headers.get('x-shopify-api-version'),
    httpStatus: response.status,
    cost: cost ? { requestedQueryCost: nullableNumber(cost.requestedQueryCost), actualQueryCost: nullableNumber(cost.actualQueryCost) } : null,
    throttleStatus,
  }
}

function graphQLErrors(value: unknown): Array<ShopifyGraphQLErrorValue> {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const error = record(item)
    const locations = Array.isArray(error?.locations) ? error.locations.flatMap((location) => {
      const point = record(location)
      return typeof point?.line === 'number' && typeof point.column === 'number' ? [{ line: point.line, column: point.column }] : []
    }) : []
    const path = Array.isArray(error?.path) ? error.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number') : []
    return { message: typeof error?.message === 'string' ? error.message : 'Unknown GraphQL error', locations, path, extensions: record(error?.extensions) ?? {} }
  })
}

async function responseJson(response: Response) {
  const text = await response.text()
  if (!text) return { parsed: false as const, body: null }
  try {
    return { parsed: true as const, body: JSON.parse(text) as unknown }
  } catch {
    return { parsed: false as const, body: null }
  }
}

async function shopifyFetch(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch {
    throw new ShopifyTransportError(controller.signal.aborted ? 'timeout' : 'network', controller.signal.aborted ? 'Shopify Admin API request timed out' : 'Shopify Admin API network request failed', null, true, null)
  } finally {
    clearTimeout(timeout)
  }
}

export async function graphql(connection: ShopifyConnection, query: string, variables: Record<string, unknown>): Promise<ShopifyGraphQLResult> {
  const apiVersion = env.SHOPIFY_API_VERSION ?? DEFAULT_API_VERSION
  const response = await shopifyFetch(`https://${connection.storeDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/graphql-response+json, application/json', 'X-Shopify-Access-Token': connection.accessToken },
    body: JSON.stringify({ query, variables }),
  })
  const decoded = await responseJson(response)
  const responseMetadata = metadata(response, decoded.body)
  if (response.status === 401) throw new ShopifyTransportError('authentication', 'Shopify rejected the Admin API credential', 401, false, responseMetadata)
  if (response.status === 429) throw new ShopifyTransportError('throttled', 'Shopify Admin API request was throttled', 429, true, responseMetadata)
  if (!response.ok) throw new ShopifyTransportError('http', `Shopify Admin API request failed (${response.status})`, response.status, response.status >= 500, responseMetadata)
  if (!decoded.parsed || !record(decoded.body)) throw new ShopifyTransportError('malformed_response', 'Shopify Admin API returned a non-JSON or malformed GraphQL response', response.status, false, responseMetadata)
  const envelope = decoded.body as Record<string, unknown>
  if ((!Object.hasOwn(envelope, 'data') && !Array.isArray(envelope.errors)) || (Object.hasOwn(envelope, 'errors') && !Array.isArray(envelope.errors))) throw new ShopifyTransportError('malformed_response', 'Shopify Admin API returned an invalid GraphQL envelope', response.status, false, responseMetadata)
  return { data: Object.hasOwn(envelope, 'data') ? envelope.data ?? null : null, errors: graphQLErrors(envelope.errors), metadata: responseMetadata }
}
