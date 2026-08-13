import type { ShopifyConnection } from './lib/adminClient.js';
export declare function withForcedCredentialRefresh<TResult>(initialConnection: () => Promise<ShopifyConnection>, forcedConnection: () => Promise<ShopifyConnection>, request: (connection: ShopifyConnection) => Promise<TResult>): Promise<TResult>;
export declare const gql: import("convex/server").RegisteredAction<"public", {
    query: string;
    shopDomain: string;
    variables: Record<string, any>;
}, Promise<import("./lib/adminClient.js").ShopifyGraphQLResult>>;
//# sourceMappingURL=admin.d.ts.map