import type { ShopifyConnection } from './lib/adminClient';
export declare function withForcedCredentialRefresh<TResult>(initialConnection: () => Promise<ShopifyConnection>, forcedConnection: () => Promise<ShopifyConnection>, request: (connection: ShopifyConnection) => Promise<TResult>): Promise<TResult>;
export declare const gql: import("convex/server").RegisteredAction<"public", {
    query: string;
    shopDomain: string;
    variables: Record<string, any>;
}, Promise<import("./lib/adminClient").ShopifyGraphQLResult>>;
//# sourceMappingURL=admin.d.ts.map