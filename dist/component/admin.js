import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server.js';
import { ShopifyTokenLifecycleError, ensureFreshConnection } from './lib/tokenLifecycle.js';
import { ShopifyTransportError, graphql } from './lib/adminClient.js';
const metadataValidator = v.object({
    requestId: v.union(v.string(), v.null()), apiVersion: v.union(v.string(), v.null()), httpStatus: v.number(),
    cost: v.union(v.null(), v.object({ requestedQueryCost: v.union(v.number(), v.null()), actualQueryCost: v.union(v.number(), v.null()) })),
    throttleStatus: v.union(v.null(), v.object({
        maximumAvailable: v.union(v.number(), v.null()),
        currentlyAvailable: v.union(v.number(), v.null()),
        restoreRate: v.union(v.number(), v.null()),
    })),
});
const graphQLErrorValidator = v.object({
    message: v.string(),
    locations: v.array(v.object({ line: v.number(), column: v.number() })),
    path: v.array(v.union(v.string(), v.number())),
    extensions: v.record(v.string(), v.any()),
});
function throwComponentError(error) {
    if (error instanceof ConvexError)
        throw error;
    if (error instanceof ShopifyTokenLifecycleError) {
        throw new ConvexError({ code: `SHOPIFY_${error.kind.toUpperCase()}`, kind: error.kind, message: error.message, retryable: error.retryable, status: null, metadata: null });
    }
    if (error instanceof ShopifyTransportError) {
        throw new ConvexError({ code: `SHOPIFY_${error.kind.toUpperCase()}`, kind: error.kind, message: error.message, retryable: error.retryable, status: error.status, metadata: error.responseMetadata });
    }
    throw new ConvexError({ code: 'SHOPIFY_UNEXPECTED', kind: 'unexpected', message: error instanceof Error ? error.message : 'Unexpected Shopify component failure', retryable: false, status: null, metadata: null });
}
function reconnectAfterRejectedRefresh(metadata) {
    throw new ConvexError({ code: 'SHOPIFY_RECONNECT_REQUIRED', kind: 'reconnect_required', message: 'Shopify rejected the newly refreshed Admin API credential. Reconnect the installation.', retryable: false, status: 401, metadata });
}
export async function withForcedCredentialRefresh(initialConnection, forcedConnection, request) {
    const connection = await initialConnection();
    try {
        return await request(connection);
    }
    catch (error) {
        if (!(error instanceof ShopifyTransportError) || error.kind !== 'authentication')
            throw error;
    }
    const refreshed = await forcedConnection();
    try {
        return await request(refreshed);
    }
    catch (error) {
        if (error instanceof ShopifyTransportError && error.kind === 'authentication') {
            reconnectAfterRejectedRefresh(error.responseMetadata);
        }
        throw error;
    }
}
export const gql = action({
    args: { shopDomain: v.string(), query: v.string(), variables: v.record(v.string(), v.any()) },
    returns: v.object({ data: v.any(), errors: v.array(graphQLErrorValidator), metadata: metadataValidator }),
    handler: async (ctx, args) => {
        try {
            return await withForcedCredentialRefresh(() => ensureFreshConnection(ctx, args.shopDomain), () => ensureFreshConnection(ctx, args.shopDomain, { forceRefresh: true }), (connection) => graphql(connection, args.query, args.variables));
        }
        catch (error) {
            throwComponentError(error);
        }
    },
});
//# sourceMappingURL=admin.js.map