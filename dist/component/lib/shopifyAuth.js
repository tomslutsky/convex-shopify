import { jwtVerify } from 'jose';
import { env } from '../_generated/server';
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;
const MAX_REFRESH_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 30_000;
export function requiredEnv(name) {
    const configured = {
        SHOPIFY_API_KEY: env.SHOPIFY_API_KEY,
        SHOPIFY_API_SECRET: env.SHOPIFY_API_SECRET,
    };
    const value = configured[name];
    if (!value)
        throw new Error(`${name} is not configured`);
    return value;
}
export async function verifyShopifySessionToken(sessionToken) {
    const apiKey = requiredEnv('SHOPIFY_API_KEY');
    const apiSecret = requiredEnv('SHOPIFY_API_SECRET');
    const verified = await jwtVerify(sessionToken, new TextEncoder().encode(apiSecret), { algorithms: ['HS256'], audience: apiKey, clockTolerance: 5 });
    const { dest, sub, iss, exp, nbf } = verified.payload;
    if (typeof dest !== 'string' || typeof sub !== 'string' || !/^\d+$/.test(sub) || typeof iss !== 'string' || typeof exp !== 'number' || typeof nbf !== 'number')
        throw new Error('Invalid Shopify session-token identity or timing claims');
    let destination;
    try {
        destination = new URL(dest);
    }
    catch {
        throw new Error('Invalid Shopify session-token destination');
    }
    if (destination.protocol !== 'https:' || destination.username || destination.password || destination.port || destination.pathname !== '/' || destination.search || destination.hash || !isShopDomain(destination.hostname))
        throw new Error('Invalid Shopify session-token destination');
    const shopDomain = destination.hostname.toLowerCase();
    if (iss !== `https://${shopDomain}/admin`)
        throw new Error('Invalid Shopify session-token issuer');
    return { apiKey, apiSecret, sessionToken, shopDomain, shopifyUserId: sub };
}
export class ShopifyTokenRequestError extends Error {
    kind;
    status;
    retryable;
    constructor(kind, message, status, retryable) {
        super(message);
        this.kind = kind;
        this.status = status;
        this.retryable = retryable;
    }
}
function tokenBody(body) {
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {};
}
function parseExpiringOfflineToken(body, status) {
    const value = tokenBody(body);
    if (typeof value.access_token !== 'string' || value.access_token.length === 0 || typeof value.expires_in !== 'number' || value.expires_in <= 0 || typeof value.refresh_token !== 'string' || value.refresh_token.length === 0 || typeof value.refresh_token_expires_in !== 'number' || value.refresh_token_expires_in <= 0) {
        throw new ShopifyTokenRequestError('exchange_rejected', `Shopify token endpoint returned an invalid success response (${status})`, status, false);
    }
    return { accessToken: value.access_token, scopes: typeof value.scope === 'string' ? value.scope : '', expiresIn: value.expires_in, refreshToken: value.refresh_token, refreshTokenExpiresIn: value.refresh_token_expires_in };
}
function retryAfterMs(response, now) {
    const value = response.headers.get('retry-after');
    if (!value)
        return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0)
        return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS);
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.min(Math.max(0, date - now), MAX_RETRY_DELAY_MS) : null;
}
function rejectedTokenError(body, status, refresh) {
    const value = tokenBody(body);
    const code = typeof value.error === 'string' ? value.error : '';
    const description = typeof value.error_description === 'string' ? value.error_description : typeof value.message === 'string' ? value.message : '';
    const detail = `${code} ${description}`.toLowerCase();
    if (status === 429 || status >= 500)
        return new ShopifyTokenRequestError('transient', `Shopify token endpoint is temporarily unavailable (${status})`, status, true);
    if (refresh && (detail.includes('expired') || detail.includes('expiration')))
        return new ShopifyTokenRequestError('expired_refresh_token', 'Shopify refresh token has expired; reconnect the installation', status, false);
    if (refresh && status === 401 && code === 'invalid_request' && description.includes('This request requires an active refresh_token'))
        return new ShopifyTokenRequestError('invalid_refresh_token', 'Shopify rejected the inactive refresh token; reconnect the installation', status, false);
    return new ShopifyTokenRequestError('exchange_rejected', `Shopify token request was rejected (${status})`, status, false);
}
async function readJson(response) {
    const text = await response.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
async function requestOfflineToken(shopDomain, params, refresh, options = {}) {
    const fetcher = options.fetch ?? fetch;
    const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    const random = options.random ?? Math.random;
    const now = options.now ?? Date.now;
    const timeoutMs = options.timeoutMs ?? TOKEN_REQUEST_TIMEOUT_MS;
    const attempts = refresh ? options.maxAttempts ?? MAX_REFRESH_ATTEMPTS : 1;
    let lastTransient = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetcher(`https://${shopDomain}/admin/oauth/access_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
                body: params,
                signal: controller.signal,
            });
            const body = await readJson(response);
            if (response.ok)
                return parseExpiringOfflineToken(body, response.status);
            const error = rejectedTokenError(body, response.status, refresh);
            if (!error.retryable || attempt + 1 >= attempts)
                throw error;
            lastTransient = error;
            const exponential = Math.min(250 * 2 ** attempt, 4_000);
            await sleep(retryAfterMs(response, now()) ?? Math.round(exponential * (0.5 + random())));
        }
        catch (error) {
            if (error instanceof ShopifyTokenRequestError)
                throw error;
            lastTransient = new ShopifyTokenRequestError('transient', controller.signal.aborted ? 'Shopify token request timed out' : 'Shopify token request failed due to a transient network error', null, true);
            if (attempt + 1 >= attempts)
                throw lastTransient;
            const exponential = Math.min(250 * 2 ** attempt, 4_000);
            await sleep(Math.round(exponential * (0.5 + random())));
        }
        finally {
            clearTimeout(timeout);
        }
    }
    throw lastTransient ?? new ShopifyTokenRequestError('transient', 'Shopify token request failed', null, true);
}
export async function exchangeOfflineToken(input, options) {
    return requestOfflineToken(input.shopDomain, new URLSearchParams({ client_id: input.apiKey, client_secret: input.apiSecret, grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange', subject_token: input.sessionToken, subject_token_type: 'urn:ietf:params:oauth:token-type:id_token', requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token', expiring: '1' }), false, options);
}
export async function refreshOfflineToken(input, options) {
    return requestOfflineToken(input.shopDomain, new URLSearchParams({ client_id: input.apiKey, client_secret: input.apiSecret, grant_type: 'refresh_token', refresh_token: input.refreshToken }), true, options);
}
export function isShopDomain(value) {
    return value !== null && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/i.test(value);
}
export async function validShopifyWebhook(body, provided) {
    if (!provided)
        return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(requiredEnv('SHOPIFY_API_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, body);
    const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));
    if (expected.length !== provided.length)
        return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1)
        difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
    return difference === 0;
}
//# sourceMappingURL=shopifyAuth.js.map