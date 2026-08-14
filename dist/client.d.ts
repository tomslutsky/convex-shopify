import { asShopifyCursor } from './pagination.js';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ComponentApi } from './component/_generated/component.js';
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server';
export { asShopifyCursor, type ShopifyCursor } from './pagination.js';
export type SerializableValue = null | boolean | number | string | Array<SerializableValue> | {
    [key: string]: SerializableValue;
};
export type SerializableVariables = Record<string, SerializableValue>;
/**
 * Operation maps augmented by Shopify's `@shopify/api-codegen-preset`.
 * Generated `#graphql` strings infer exact variables and results; an operation
 * not seen by codegen remains available with serializable variables and an
 * `unknown` result.
 * `TypedDocumentNode` remains the explicit advanced escape hatch.
 */
export interface AdminQueries {
    [key: string]: {
        variables: unknown;
        return: unknown;
    };
    [key: number | symbol]: never;
}
export interface AdminMutations {
    [key: string]: {
        variables: unknown;
        return: unknown;
    };
    [key: number | symbol]: never;
}
export type AdminOperations = AdminQueries & AdminMutations;
type IsUnknown<T> = unknown extends T ? [keyof T] extends [never] ? true : false : false;
type SerializableOperationValue<T> = IsUnknown<T> extends true ? SerializableValue : T extends null | boolean | number | string ? T : T extends ReadonlyArray<infer TItem> ? Array<SerializableOperationValue<Exclude<TItem, undefined>>> : T extends object ? {
    [TKey in keyof T]: SerializableOperationValue<Exclude<T[TKey], undefined>>;
} : never;
type AdminOperationVariables<TOperation extends keyof AdminOperations> = IsUnknown<AdminOperations[TOperation]['variables']> extends true ? SerializableVariables : SerializableOperationValue<AdminOperations[TOperation]['variables']>;
type AdminGraphQLParameters<TOperation extends keyof AdminOperations> = AdminOperations[TOperation]['variables'] extends Record<string, never> ? [operation: TOperation, options?: {
    variables?: Record<string, never>;
}] : [
    operation: TOperation,
    options: {
        variables: AdminOperationVariables<TOperation>;
    }
];
export type ShopifyGraphQLError = {
    message: string;
    locations: Array<{
        line: number;
        column: number;
    }>;
    path: Array<string | number>;
    extensions: Record<string, SerializableValue>;
};
export type ShopifyGraphQLCost = {
    requestedQueryCost: number | null;
    actualQueryCost: number | null;
};
export type ShopifyThrottleStatus = {
    maximumAvailable: number | null;
    currentlyAvailable: number | null;
    restoreRate: number | null;
};
export type ShopifyGraphQLMetadata = {
    requestId: string | null;
    apiVersion: string | null;
    httpStatus: number;
    cost: ShopifyGraphQLCost | null;
    throttleStatus: ShopifyThrottleStatus | null;
};
export type ShopifyComponentErrorKind = 'not_configured' | 'installation_missing' | 'transient_refresh_failure' | 'invalid_refresh_token' | 'expired_refresh_token' | 'reconnect_required' | 'token_exchange_rejected' | 'authentication' | 'throttled' | 'http' | 'timeout' | 'network' | 'malformed_response' | 'unexpected';
/** Serializable data carried by ConvexError across the component boundary. */
export type ShopifyComponentErrorData = {
    code: string;
    kind: ShopifyComponentErrorKind;
    message: string;
    retryable: boolean;
    status: number | null;
    metadata: ShopifyGraphQLMetadata | null;
};
/** Read the serializable error payload returned across a Convex boundary. */
export declare function shopifyComponentErrorData(error: unknown): ShopifyComponentErrorData | null;
/**
 * `data` is statically inferred from the document. The component does not
 * runtime-validate Shopify's response against that TypeScript type.
 */
export type ShopifyGraphQLResult<TResult> = {
    data: TResult | null;
    errors: Array<ShopifyGraphQLError>;
    metadata: ShopifyGraphQLMetadata;
};
export type ShopifyConnectionState = {
    status: 'not_installed';
    scopes: Array<string>;
    missingScopes: Array<string>;
    accessTokenExpiresAt: null;
    refreshTokenExpiresAt: null;
} | {
    status: 'ready';
    scopes: Array<string>;
    missingScopes: [];
    accessTokenExpiresAt: number | null;
    refreshTokenExpiresAt: number | null;
} | {
    status: 'missing_scopes';
    scopes: Array<string>;
    missingScopes: Array<string>;
    accessTokenExpiresAt: number | null;
    refreshTokenExpiresAt: number | null;
} | {
    status: 'reconnect_required';
    scopes: Array<string>;
    missingScopes: Array<string>;
    accessTokenExpiresAt: number | null;
    refreshTokenExpiresAt: number | null;
};
export type ShopifyInstallationSnapshot = {
    installed: boolean;
    scopes: Array<string>;
    missingScopes: Array<string>;
    accessTokenExpiresAt: number | null;
    refreshTokenExpiresAt: number | null;
};
export type ShopifyConnectResult = {
    shopDomain: string;
    shopifyUserId: string;
    state: Exclude<ShopifyConnectionState, {
        status: 'not_installed';
    }>;
};
export type VerifiedWebhookDelivery = {
    verified: true;
    delivery: {
        rawBody: ArrayBuffer;
        payload: unknown;
        shopDomain: string;
        topic: string;
        webhookId: string;
    };
};
export type RejectedWebhookDelivery = {
    verified: false;
    reason: 'invalid_hmac' | 'invalid_json' | 'invalid_shop_domain' | 'missing_metadata';
};
export type WebhookVerificationResult = VerifiedWebhookDelivery | RejectedWebhookDelivery;
type MaybePromise<T> = T | Promise<T>;
type QueryCtx = {
    runQuery: <TQuery extends FunctionReference<'query', 'internal'>>(query: TQuery, ...args: OptionalRestArgs<TQuery>) => Promise<FunctionReturnType<TQuery>>;
};
type MutationCtx = {
    runMutation: <TMutation extends FunctionReference<'mutation', 'internal'>>(mutation: TMutation, ...args: OptionalRestArgs<TMutation>) => Promise<FunctionReturnType<TMutation>>;
};
type ActionCtx = {
    runAction: <TAction extends FunctionReference<'action', 'internal'>>(action: TAction, ...args: OptionalRestArgs<TAction>) => Promise<FunctionReturnType<TAction>>;
    runQuery: QueryCtx['runQuery'];
    runMutation: MutationCtx['runMutation'];
};
export type ShopifyAppOptions<TName extends string | undefined> = {
    component: ComponentApi<TName>;
};
export type ShopifySession = {
    /** Shopify-compatible deterministic ID for the shop's offline session. */
    id: string;
    shop: string;
    isOnline: false;
    /** Shopify-compatible comma-separated scope representation. */
    scope: string;
    /** Normalized scopes for ergonomic application checks. */
    scopes: Array<string>;
    expires: number | null;
    refreshTokenExpires: number | null;
    missingScopes: Array<string>;
};
export type ShopifyAdminGraphQL = <TOperation extends keyof AdminOperations = string>(...params: AdminGraphQLParameters<TOperation>) => Promise<ShopifyGraphQLResult<AdminOperations[TOperation]['return']>>;
export type ShopifyTypedDocumentGraphQL = {
    <TResult, TVariables extends SerializableVariables>(document: TypedDocumentNode<TResult, TVariables>, options: {
        variables: TVariables;
    }): Promise<ShopifyGraphQLResult<TResult>>;
};
export type ShopifyAdminContext = {
    graphql: ShopifyAdminGraphQL;
    /** Advanced escape hatch for clients using TypedDocumentNode codegen. */
    graphqlDocument: ShopifyTypedDocumentGraphQL;
};
export type ShopifyAuthenticatedAdmin = {
    admin: ShopifyAdminContext;
    session: ShopifySession;
    /** The user subject verified from the incoming Shopify session token. */
    shopifyUserId: string;
};
export type ShopifyOfflineAdmin = {
    admin: ShopifyAdminContext;
    session: ShopifySession;
};
export type ShopifyWebhookContext = {
    shop: string;
    topic: string;
    payload: unknown;
    webhookId: string;
    rawBody: ArrayBuffer;
    session: ShopifySession | null;
};
export type ShopifyWebhookHandlerArgs = {
    webhookId: string;
    shopDomain: string;
    topic: string;
    payload: unknown;
};
export type ShopifyWebhookHandler = FunctionReference<'mutation', 'internal', ShopifyWebhookHandlerArgs, unknown>;
export type ShopifyFailedWebhookDelivery = {
    deliveryId: string;
    webhookId: string;
    shopDomain: string;
    topic: string;
    error: string;
    completedAt: number;
};
export type ShopifyWebhookAuthenticationErrorReason = 'missing_metadata' | 'invalid_shop_domain' | 'invalid_hmac' | 'invalid_json';
export declare class ShopifyWebhookAuthenticationError extends Error {
    readonly reason: ShopifyWebhookAuthenticationErrorReason;
    readonly name = "ShopifyWebhookAuthenticationError";
    constructor(reason: ShopifyWebhookAuthenticationErrorReason);
}
export type ShopifyClientOptions<TAuthorizationContext> = {
    /** Resolve a shop only after authenticating and authorizing the app user. */
    resolveShop: (ctx: TAuthorizationContext) => MaybePromise<string>;
};
export type ShopifyGraphQLArgs<TResult, TVariables extends SerializableVariables> = {
    document: TypedDocumentNode<TResult, TVariables>;
    variables: TVariables;
};
export type ShopifyWebhookRequest = {
    rawBody: ArrayBuffer | Uint8Array | string;
    hmac: string;
    shopDomain: string;
    topic: string;
    webhookId: string;
};
/**
 * Create a Shopify-template-shaped facade for a mounted Convex component.
 * Credentials remain component-private; all returned sessions are sanitized.
 */
export declare function shopifyApp<TName extends string | undefined>(options: ShopifyAppOptions<TName>): {
    installation: {
        snapshot: (ctx: QueryCtx, shop: string) => Promise<ShopifyInstallationSnapshot>;
    };
    authenticate: {
        admin: (ctx: ActionCtx, args: {
            sessionToken: string;
        }) => Promise<ShopifyAuthenticatedAdmin>;
        webhook: (ctx: ActionCtx, request: Request) => Promise<ShopifyWebhookContext>;
    };
    unauthenticated: {
        /** Use only after app code has selected and authorized this shop. */
        admin: (ctx: ActionCtx, shop: string) => Promise<ShopifyOfflineAdmin>;
    };
    sessionStorage: {
        loadSession: (ctx: QueryCtx, id: string) => Promise<ShopifySession | null>;
        findSessionByShop: (ctx: QueryCtx, shop: string) => Promise<ShopifySession | null>;
        deleteSession: (ctx: MutationCtx, id: string) => Promise<boolean>;
        deleteSessionsForShop: (ctx: MutationCtx, shop: string) => Promise<boolean>;
    };
    webhooks: {
        accept: (ctx: MutationCtx, delivery: ShopifyWebhookContext, options: {
            handler: ShopifyWebhookHandler;
            deduplicate?: boolean;
        }) => Promise<{
            status: "accepted" | "duplicate";
            deliveryId: string;
        } | {
            status: "rejected";
            reason: "invalid_lifecycle_payload";
        }>;
        listFailed: (ctx: QueryCtx, options?: {
            limit?: number;
        }) => Promise<Array<ShopifyFailedWebhookDelivery>>;
        replay: (ctx: MutationCtx, deliveryId: string) => Promise<null>;
    };
    operations: {
        credentials: {
            rotate: (ctx: ActionCtx, args?: {
                cursor?: string | null;
                batchSize?: number;
                dryRun?: boolean;
            }) => Promise<{
                isDone: boolean;
                migrated: number;
                nextCursor: string | null;
                processed: number;
            }>;
        };
    };
};
/**
 * Create the supported, app-authorized facade for a mounted Shopify component.
 * The mount name is inferred from the supplied generated component reference.
 */
export declare function createShopifyClient<TName extends string | undefined, TAuthorizationContext>(component: ComponentApi<TName>, options: ShopifyClientOptions<TAuthorizationContext>): {
    auth: {
        connect: (ctx: ActionCtx, args: {
            sessionToken: string;
        }) => Promise<ShopifyConnectResult>;
        verifySessionToken: (ctx: ActionCtx, args: {
            sessionToken: string;
        }) => Promise<{
            shopDomain: string;
            shopifyUserId: string;
        }>;
    };
    installation: {
        get: (ctx: TAuthorizationContext & ActionCtx) => Promise<ShopifyConnectionState>;
        snapshot: (ctx: TAuthorizationContext & QueryCtx) => Promise<ShopifyInstallationSnapshot>;
        disconnect: (ctx: TAuthorizationContext & MutationCtx) => Promise<null>;
    };
    admin: {
        graphql: <TResult, TVariables extends SerializableVariables>(ctx: TAuthorizationContext & ActionCtx, args: ShopifyGraphQLArgs<TResult, TVariables>) => Promise<ShopifyGraphQLResult<TResult>>;
        cursor: typeof asShopifyCursor;
    };
    webhooks: {
        /** Verify the exact raw body before parsing it. Delivery deduplication remains app-owned. */
        verifyRequest: (ctx: ActionCtx, request: ShopifyWebhookRequest) => Promise<WebhookVerificationResult>;
    };
    operations: {
        credentials: {
            rotate: (ctx: ActionCtx, args?: {
                cursor?: string | null;
                batchSize?: number;
                dryRun?: boolean;
            }) => Promise<{
                isDone: boolean;
                migrated: number;
                nextCursor: string | null;
                processed: number;
            }>;
        };
    };
    /** Explicit escape hatch for already-authorized multi-shop server workflows. */
    forShop: (shopDomain: string) => {
        installation: {
            get: (ctx: ActionCtx) => Promise<ShopifyConnectionState>;
            snapshot: (ctx: QueryCtx) => Promise<ShopifyInstallationSnapshot>;
            disconnect: (ctx: MutationCtx) => Promise<null>;
        };
        admin: {
            graphql: <TResult, TVariables extends SerializableVariables>(ctx: ActionCtx, args: ShopifyGraphQLArgs<TResult, TVariables>) => Promise<ShopifyGraphQLResult<TResult>>;
        };
    };
};
//# sourceMappingURL=client.d.ts.map