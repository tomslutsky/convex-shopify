import { print } from 'graphql';
import { createFunctionHandle } from 'convex/server';
import { asShopifyCursor } from './pagination.js';
export { asShopifyCursor } from './pagination.js';
/** Read the serializable error payload returned across a Convex boundary. */
export function shopifyComponentErrorData(error) {
    if (typeof error !== 'object' || error === null || !('data' in error))
        return null;
    const data = error.data;
    if (typeof data !== 'object' || data === null)
        return null;
    const candidate = data;
    return typeof candidate.code === 'string' &&
        typeof candidate.kind === 'string' &&
        typeof candidate.message === 'string' &&
        typeof candidate.retryable === 'boolean'
        ? candidate
        : null;
}
export class ShopifyWebhookAuthenticationError extends Error {
    reason;
    name = 'ShopifyWebhookAuthenticationError';
    constructor(reason) {
        super(`Shopify webhook authentication failed: ${reason}`);
        this.reason = reason;
    }
}
const SHOP_DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;
/**
 * Create a Shopify-template-shaped facade for a mounted Convex component.
 * Credentials remain component-private; all returned sessions are sanitized.
 */
export function shopifyApp(options) {
    const { component } = options;
    const webhookComponent = component;
    function adminContext(ctx, shop) {
        const normalizedShop = normalizeShopDomain(shop);
        const graphql = async (operation, graphqlOptions = {}) => {
            assertSerializableVariables(graphqlOptions.variables ?? {});
            const raw = await ctx.runAction(component.admin.gql, {
                shopDomain: normalizedShop,
                query: typeof operation === 'string' ? operation : print(operation),
                variables: graphqlOptions.variables ?? {},
            });
            return normalizeGraphQLResult(raw);
        };
        return {
            graphql: graphql,
            graphqlDocument: graphql,
        };
    }
    async function loadShopSession(ctx, shop) {
        const normalizedShop = normalizeShopDomain(shop);
        const snapshot = normalizeInstallationSnapshot(await ctx.runQuery(component.auth.snapshot, {
            shopDomain: normalizedShop,
        }));
        return snapshot.installed
            ? sessionFromSnapshot(normalizedShop, snapshot)
            : null;
    }
    const sessionStorage = {
        loadSession: async (ctx, id) => {
            const shop = shopFromOfflineSessionId(id);
            return shop === null ? null : await loadShopSession(ctx, shop);
        },
        findSessionByShop: async (ctx, shop) => await loadShopSession(ctx, shop),
        deleteSession: async (ctx, id) => {
            const shop = shopFromOfflineSessionId(id);
            if (shop === null)
                return false;
            await ctx.runMutation(component.install.uninstall, { shopDomain: shop });
            return true;
        },
        deleteSessionsForShop: async (ctx, shop) => {
            await ctx.runMutation(component.install.uninstall, {
                shopDomain: normalizeShopDomain(shop),
            });
            return true;
        },
    };
    return {
        installation: {
            snapshot: async (ctx, shop) => normalizeInstallationSnapshot(await ctx.runQuery(component.auth.snapshot, {
                shopDomain: normalizeShopDomain(shop),
            })),
        },
        authenticate: {
            admin: async (ctx, args) => {
                const raw = await ctx.runAction(component.auth.exchangeSessionToken, args);
                const candidate = raw;
                const shop = normalizeShopDomain(candidate.shopDomain);
                const state = normalizeConnectionState(candidate.state);
                if (state.status === 'not_installed') {
                    throw new Error('Shopify token exchange did not create an offline session');
                }
                if (state.status === 'reconnect_required') {
                    throw new Error('Shopify offline session requires merchant reauthorization');
                }
                return {
                    admin: adminContext(ctx, shop),
                    session: sessionFromState(shop, state),
                    shopifyUserId: candidate.shopifyUserId,
                };
            },
            webhook: async (ctx, request) => {
                const hmac = request.headers.get('x-shopify-hmac-sha256')?.trim();
                const rawShop = request.headers.get('x-shopify-shop-domain')?.trim();
                const rawTopic = request.headers.get('x-shopify-topic')?.trim();
                const webhookId = request.headers.get('x-shopify-webhook-id')?.trim();
                if (!hmac || !rawShop || !rawTopic || !webhookId) {
                    throw new ShopifyWebhookAuthenticationError('missing_metadata');
                }
                let shop;
                try {
                    shop = normalizeShopDomain(rawShop);
                }
                catch {
                    throw new ShopifyWebhookAuthenticationError('invalid_shop_domain');
                }
                const rawBody = await request.arrayBuffer();
                const valid = await ctx.runAction(component.webhooks.verifyRequestHmac, {
                    body: rawBody,
                    signature: hmac,
                });
                if (!valid)
                    throw new ShopifyWebhookAuthenticationError('invalid_hmac');
                let payload;
                try {
                    payload = JSON.parse(new TextDecoder().decode(rawBody));
                }
                catch {
                    throw new ShopifyWebhookAuthenticationError('invalid_json');
                }
                return {
                    shop,
                    topic: normalizeWebhookTopic(rawTopic),
                    payload,
                    webhookId,
                    rawBody,
                    session: await loadShopSession(ctx, shop),
                };
            },
        },
        unauthenticated: {
            /** Use only after app code has selected and authorized this shop. */
            admin: async (ctx, shop) => {
                const normalizedShop = normalizeShopDomain(shop);
                const state = normalizeConnectionState(await ctx.runAction(component.auth.getState, {
                    shopDomain: normalizedShop,
                }));
                if (state.status === 'not_installed') {
                    throw new Error(`No offline Shopify session exists for ${normalizedShop}`);
                }
                if (state.status === 'reconnect_required') {
                    throw new Error(`Shopify offline session for ${normalizedShop} requires merchant reauthorization`);
                }
                return {
                    admin: adminContext(ctx, normalizedShop),
                    session: sessionFromState(normalizedShop, state),
                };
            },
        },
        sessionStorage,
        webhooks: {
            accept: async (ctx, delivery, options) => {
                const handler = await createFunctionHandle(options.handler);
                return await ctx.runMutation(webhookComponent.webhooks.accept, {
                    webhookId: delivery.webhookId,
                    shopDomain: delivery.shop,
                    topic: delivery.topic,
                    payload: delivery.payload,
                    handler,
                    deduplicate: options.deduplicate ?? true,
                });
            },
            listFailed: async (ctx, options = {}) => await ctx.runQuery(webhookComponent.webhooks.listFailed, options),
            replay: async (ctx, deliveryId) => await ctx.runMutation(webhookComponent.webhooks.replay, { deliveryId }),
        },
        operations: {
            credentials: {
                rotate: async (ctx, args = {}) => await ctx.runAction(component.install.reencrypt, args),
            },
        },
    };
}
/**
 * Create the supported, app-authorized facade for a mounted Shopify component.
 * The mount name is inferred from the supplied generated component reference.
 */
export function createShopifyClient(component, options) {
    async function resolveAuthorizedShop(ctx) {
        return normalizeShopDomain(await options.resolveShop(ctx));
    }
    function scoped(shopDomain) {
        const normalizedShop = normalizeShopDomain(shopDomain);
        return {
            installation: {
                get: async (ctx) => normalizeConnectionState(await ctx.runAction(component.auth.getState, {
                    shopDomain: normalizedShop,
                })),
                snapshot: async (ctx) => normalizeInstallationSnapshot(await ctx.runQuery(component.auth.snapshot, {
                    shopDomain: normalizedShop,
                })),
                disconnect: async (ctx) => await ctx.runMutation(component.install.uninstall, {
                    shopDomain: normalizedShop,
                }),
            },
            admin: {
                graphql: async (ctx, args) => {
                    const raw = await ctx.runAction(component.admin.gql, {
                        shopDomain: normalizedShop,
                        query: print(args.document),
                        variables: args.variables,
                    });
                    return normalizeGraphQLResult(raw);
                },
            },
        };
    }
    return {
        auth: {
            connect: async (ctx, args) => {
                const raw = await ctx.runAction(component.auth.exchangeSessionToken, args);
                const candidate = raw;
                const state = normalizeConnectionState(candidate.state ?? {
                    installed: true,
                    scopes: candidate.scopes,
                    grantedScopes: candidate.grantedScopes,
                    missingScopes: candidate.missingScopes,
                });
                if (state.status === 'not_installed')
                    throw new Error('Shopify token exchange did not create an installation');
                return {
                    shopDomain: normalizeShopDomain(candidate.shopDomain),
                    shopifyUserId: candidate.shopifyUserId,
                    state,
                };
            },
            verifySessionToken: async (ctx, args) => await ctx.runAction(component.auth.verifySessionToken, args),
        },
        installation: {
            get: async (ctx) => await scoped(await resolveAuthorizedShop(ctx)).installation.get(ctx),
            snapshot: async (ctx) => await scoped(await resolveAuthorizedShop(ctx)).installation.snapshot(ctx),
            disconnect: async (ctx) => await scoped(await resolveAuthorizedShop(ctx)).installation.disconnect(ctx),
        },
        admin: {
            graphql: async (ctx, args) => await scoped(await resolveAuthorizedShop(ctx)).admin.graphql(ctx, args),
            cursor: asShopifyCursor,
        },
        webhooks: {
            /** Verify the exact raw body before parsing it. Delivery deduplication remains app-owned. */
            verifyRequest: async (ctx, request) => {
                if (!request.topic.trim() || !request.webhookId.trim())
                    return { verified: false, reason: 'missing_metadata' };
                let shopDomain;
                try {
                    shopDomain = normalizeShopDomain(request.shopDomain);
                }
                catch {
                    return { verified: false, reason: 'invalid_shop_domain' };
                }
                const rawBody = toArrayBuffer(request.rawBody);
                const valid = await ctx.runAction(component.webhooks.verifyRequestHmac, { body: rawBody, signature: request.hmac });
                if (!valid)
                    return { verified: false, reason: 'invalid_hmac' };
                try {
                    const payload = JSON.parse(new TextDecoder().decode(rawBody));
                    return {
                        verified: true,
                        delivery: {
                            rawBody,
                            payload,
                            shopDomain,
                            topic: request.topic,
                            webhookId: request.webhookId,
                        },
                    };
                }
                catch {
                    return { verified: false, reason: 'invalid_json' };
                }
            },
        },
        operations: {
            credentials: {
                rotate: async (ctx, args = {}) => await ctx.runAction(component.install.reencrypt, args),
            },
        },
        /** Explicit escape hatch for already-authorized multi-shop server workflows. */
        forShop: scoped,
    };
}
function normalizeShopDomain(value) {
    const normalized = value.trim().toLowerCase();
    if (!SHOP_DOMAIN.test(normalized))
        throw new Error('Expected a supported *.myshopify.com shop domain');
    return normalized;
}
function splitScopes(value) {
    return (value
        ?.split(',')
        .map((scope) => scope.trim())
        .filter(Boolean) ?? []);
}
function normalizeConnectionState(value) {
    const raw = (value ?? {});
    const scopes = raw.scopes ?? splitScopes(raw.grantedScopes);
    const missingScopes = raw.missingScopes ?? [];
    const status = raw.status ??
        (raw.installed === false
            ? 'not_installed'
            : missingScopes.length > 0
                ? 'missing_scopes'
                : 'ready');
    const accessTokenExpiresAt = raw.accessTokenExpiresAt ?? null;
    const refreshTokenExpiresAt = raw.refreshTokenExpiresAt ?? null;
    if (status === 'not_installed')
        return {
            status,
            scopes,
            missingScopes,
            accessTokenExpiresAt: null,
            refreshTokenExpiresAt: null,
        };
    if (status === 'ready')
        return {
            status,
            scopes,
            missingScopes: [],
            accessTokenExpiresAt,
            refreshTokenExpiresAt,
        };
    return {
        status,
        scopes,
        missingScopes,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
    };
}
function normalizeInstallationSnapshot(value) {
    const raw = (value ?? {});
    return {
        installed: raw.installed === true,
        scopes: [...new Set(raw.scopes ?? splitScopes(raw.grantedScopes))].sort(),
        missingScopes: [...new Set(raw.missingScopes ?? [])].sort(),
        accessTokenExpiresAt: raw.accessTokenExpiresAt ?? null,
        refreshTokenExpiresAt: raw.refreshTokenExpiresAt ?? null,
    };
}
function offlineSessionId(shop) {
    return `offline_${normalizeShopDomain(shop)}`;
}
function normalizeWebhookTopic(topic) {
    return topic.trim().replaceAll('/', '_').toUpperCase();
}
function shopFromOfflineSessionId(id) {
    if (!id.startsWith('offline_'))
        return null;
    try {
        return normalizeShopDomain(id.slice('offline_'.length));
    }
    catch {
        return null;
    }
}
function sessionFromState(shop, state) {
    const scopes = [...new Set(state.scopes)].sort();
    return {
        id: offlineSessionId(shop),
        shop,
        isOnline: false,
        scope: scopes.join(','),
        scopes,
        expires: state.accessTokenExpiresAt,
        refreshTokenExpires: state.refreshTokenExpiresAt,
        missingScopes: [...new Set(state.missingScopes)].sort(),
    };
}
function sessionFromSnapshot(shop, snapshot) {
    const state = snapshot.missingScopes.length > 0
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
        };
    return sessionFromState(shop, state);
}
function normalizeGraphQLResult(value) {
    if (typeof value !== 'object' || value === null || !('metadata' in value)) {
        throw new Error('Shopify component returned an invalid GraphQL result');
    }
    const raw = value;
    return {
        data: (raw.data ?? null),
        errors: (Array.isArray(raw.errors)
            ? raw.errors
            : []),
        metadata: raw.metadata,
    };
}
function toArrayBuffer(body) {
    if (typeof body === 'string')
        return new TextEncoder().encode(body).buffer;
    if (body instanceof ArrayBuffer)
        return body.slice(0);
    return body.slice().buffer;
}
function assertSerializableVariables(variables, path = 'variables') {
    if (variables === null || typeof variables !== 'object' || Array.isArray(variables))
        throw new Error('Shopify GraphQL variables must be a serializable object record');
    if (Object.getPrototypeOf(variables) !== Object.prototype)
        throw new Error(`Shopify GraphQL ${path} must be a plain object`);
    for (const [key, value] of Object.entries(variables))
        assertSerializableValue(value, `${path}.${key}`);
}
function assertSerializableValue(value, path) {
    if (value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value)))
        return;
    if (Array.isArray(value)) {
        value.forEach((entry, index) => assertSerializableValue(entry, `${path}[${index}]`));
        return;
    }
    if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        for (const [key, entry] of Object.entries(value))
            assertSerializableValue(entry, `${path}.${key}`);
        return;
    }
    throw new Error(`Shopify GraphQL ${path} must be Convex-serializable`);
}
//# sourceMappingURL=client.js.map