export type ShopifyConnection = {
    storeDomain: string;
    accessToken: string;
};
export type ShopifyGraphQLErrorValue = {
    message: string;
    locations: Array<{
        line: number;
        column: number;
    }>;
    path: Array<string | number>;
    extensions: Record<string, unknown>;
};
export type ShopifyResponseMetadata = {
    requestId: string | null;
    apiVersion: string | null;
    httpStatus: number;
    cost: {
        requestedQueryCost: number | null;
        actualQueryCost: number | null;
    } | null;
    throttleStatus: {
        maximumAvailable: number | null;
        currentlyAvailable: number | null;
        restoreRate: number | null;
    } | null;
};
export type ShopifyGraphQLResult = {
    data: unknown | null;
    errors: Array<ShopifyGraphQLErrorValue>;
    metadata: ShopifyResponseMetadata;
};
export type ShopifyTransportFailureKind = 'authentication' | 'throttled' | 'http' | 'timeout' | 'network' | 'malformed_response';
export declare class ShopifyTransportError extends Error {
    readonly kind: ShopifyTransportFailureKind;
    readonly status: number | null;
    readonly retryable: boolean;
    readonly responseMetadata: ShopifyResponseMetadata | null;
    constructor(kind: ShopifyTransportFailureKind, message: string, status: number | null, retryable: boolean, responseMetadata: ShopifyResponseMetadata | null);
}
export declare function graphql(connection: ShopifyConnection, query: string, variables: Record<string, unknown>): Promise<ShopifyGraphQLResult>;
//# sourceMappingURL=adminClient.d.ts.map