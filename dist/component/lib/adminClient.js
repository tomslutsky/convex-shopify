import { env } from '../_generated/server.js';
const DEFAULT_API_VERSION = '2026-07';
const REQUEST_TIMEOUT_MS = 15_000;
export class ShopifyTransportError extends Error {
    kind;
    status;
    retryable;
    responseMetadata;
    constructor(kind, message, status, retryable, responseMetadata) {
        super(message);
        this.kind = kind;
        this.status = status;
        this.retryable = retryable;
        this.responseMetadata = responseMetadata;
    }
}
function nullableNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function record(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}
function metadata(response, body) {
    const envelope = record(body);
    const extensions = record(envelope?.extensions);
    const cost = record(extensions?.cost);
    const rawThrottleStatus = record(cost?.throttleStatus);
    const firstError = Array.isArray(envelope?.errors) ? record(envelope.errors[0]) : null;
    const errorExtensions = record(firstError?.extensions);
    const throttleStatus = rawThrottleStatus ? {
        maximumAvailable: nullableNumber(rawThrottleStatus.maximumAvailable),
        currentlyAvailable: nullableNumber(rawThrottleStatus.currentlyAvailable),
        restoreRate: nullableNumber(rawThrottleStatus.restoreRate),
    } : null;
    return {
        requestId: response.headers.get('x-request-id') ?? response.headers.get('x-shopify-request-id') ?? (typeof errorExtensions?.requestId === 'string' ? errorExtensions.requestId : null),
        apiVersion: response.headers.get('x-shopify-api-version'),
        httpStatus: response.status,
        cost: cost ? { requestedQueryCost: nullableNumber(cost.requestedQueryCost), actualQueryCost: nullableNumber(cost.actualQueryCost) } : null,
        throttleStatus,
    };
}
function graphQLErrors(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((item) => {
        const error = record(item);
        const locations = Array.isArray(error?.locations) ? error.locations.flatMap((location) => {
            const point = record(location);
            return typeof point?.line === 'number' && typeof point.column === 'number' ? [{ line: point.line, column: point.column }] : [];
        }) : [];
        const path = Array.isArray(error?.path) ? error.path.filter((part) => typeof part === 'string' || typeof part === 'number') : [];
        return { message: typeof error?.message === 'string' ? error.message : 'Unknown GraphQL error', locations, path, extensions: record(error?.extensions) ?? {} };
    });
}
async function responseJson(response) {
    const text = await response.text();
    if (!text)
        return { parsed: false, body: null };
    try {
        return { parsed: true, body: JSON.parse(text) };
    }
    catch {
        return { parsed: false, body: null };
    }
}
async function shopifyFetch(url, init, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    catch {
        throw new ShopifyTransportError(controller.signal.aborted ? 'timeout' : 'network', controller.signal.aborted ? 'Shopify Admin API request timed out' : 'Shopify Admin API network request failed', null, true, null);
    }
    finally {
        clearTimeout(timeout);
    }
}
export async function graphql(connection, query, variables) {
    const apiVersion = env.SHOPIFY_API_VERSION ?? DEFAULT_API_VERSION;
    const response = await shopifyFetch(`https://${connection.storeDomain}/admin/api/${apiVersion}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/graphql-response+json, application/json', 'X-Shopify-Access-Token': connection.accessToken },
        body: JSON.stringify({ query, variables }),
    });
    const decoded = await responseJson(response);
    const responseMetadata = metadata(response, decoded.body);
    if (response.status === 401)
        throw new ShopifyTransportError('authentication', 'Shopify rejected the Admin API credential', 401, false, responseMetadata);
    if (response.status === 429)
        throw new ShopifyTransportError('throttled', 'Shopify Admin API request was throttled', 429, true, responseMetadata);
    if (!response.ok)
        throw new ShopifyTransportError('http', `Shopify Admin API request failed (${response.status})`, response.status, response.status >= 500, responseMetadata);
    if (!decoded.parsed || !record(decoded.body))
        throw new ShopifyTransportError('malformed_response', 'Shopify Admin API returned a non-JSON or malformed GraphQL response', response.status, false, responseMetadata);
    const envelope = decoded.body;
    if ((!Object.hasOwn(envelope, 'data') && !Array.isArray(envelope.errors)) || (Object.hasOwn(envelope, 'errors') && !Array.isArray(envelope.errors)))
        throw new ShopifyTransportError('malformed_response', 'Shopify Admin API returned an invalid GraphQL envelope', response.status, false, responseMetadata);
    return { data: Object.hasOwn(envelope, 'data') ? envelope.data ?? null : null, errors: graphQLErrors(envelope.errors), metadata: responseMetadata };
}
//# sourceMappingURL=adminClient.js.map