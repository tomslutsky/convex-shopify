/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */
import type { FunctionReference } from "convex/server";
/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> = {
    admin: {
        gql: FunctionReference<"action", "internal", {
            query: string;
            shopDomain: string;
            variables: Record<string, any>;
        }, {
            data: any;
            errors: Array<{
                extensions: Record<string, any>;
                locations: Array<{
                    column: number;
                    line: number;
                }>;
                message: string;
                path: Array<string | number>;
            }>;
            metadata: {
                apiVersion: string | null;
                cost: null | {
                    actualQueryCost: number | null;
                    requestedQueryCost: number | null;
                };
                httpStatus: number;
                requestId: string | null;
                throttleStatus: null | {
                    currentlyAvailable: number | null;
                    maximumAvailable: number | null;
                    restoreRate: number | null;
                };
            };
        }, Name>;
    };
    auth: {
        exchangeSessionToken: FunctionReference<"action", "internal", {
            sessionToken: string;
        }, {
            shopDomain: string;
            shopifyUserId: string;
            state: {
                accessTokenExpiresAt: number | null;
                missingScopes: Array<string>;
                refreshTokenExpiresAt: number | null;
                scopes: Array<string>;
                status: "not_installed";
            } | {
                accessTokenExpiresAt: number | null;
                missingScopes: Array<string>;
                refreshTokenExpiresAt: number | null;
                scopes: Array<string>;
                status: "ready";
            } | {
                accessTokenExpiresAt: number | null;
                missingScopes: Array<string>;
                refreshTokenExpiresAt: number | null;
                scopes: Array<string>;
                status: "missing_scopes";
            } | {
                accessTokenExpiresAt: number | null;
                missingScopes: Array<string>;
                refreshTokenExpiresAt: number | null;
                scopes: Array<string>;
                status: "reconnect_required";
            };
        }, Name>;
        getState: FunctionReference<"action", "internal", {
            shopDomain: string;
        }, {
            accessTokenExpiresAt: number | null;
            missingScopes: Array<string>;
            refreshTokenExpiresAt: number | null;
            scopes: Array<string>;
            status: "not_installed";
        } | {
            accessTokenExpiresAt: number | null;
            missingScopes: Array<string>;
            refreshTokenExpiresAt: number | null;
            scopes: Array<string>;
            status: "ready";
        } | {
            accessTokenExpiresAt: number | null;
            missingScopes: Array<string>;
            refreshTokenExpiresAt: number | null;
            scopes: Array<string>;
            status: "missing_scopes";
        } | {
            accessTokenExpiresAt: number | null;
            missingScopes: Array<string>;
            refreshTokenExpiresAt: number | null;
            scopes: Array<string>;
            status: "reconnect_required";
        }, Name>;
        snapshot: FunctionReference<"query", "internal", {
            shopDomain: string;
        }, {
            accessTokenExpiresAt: number | null;
            installed: boolean;
            missingScopes: Array<string>;
            refreshTokenExpiresAt: number | null;
            scopes: Array<string>;
        }, Name>;
        state: FunctionReference<"query", "internal", {
            now?: number;
            shopDomain: string;
        }, {
            accessTokenExpiresAt: number | null;
            missingScopes: Array<string>;
            refreshTokenExpiresAt: number | null;
            scopes: Array<string>;
            status: "not_installed";
        } | {
            accessTokenExpiresAt: number | null;
            missingScopes: Array<string>;
            refreshTokenExpiresAt: number | null;
            scopes: Array<string>;
            status: "ready";
        } | {
            accessTokenExpiresAt: number | null;
            missingScopes: Array<string>;
            refreshTokenExpiresAt: number | null;
            scopes: Array<string>;
            status: "missing_scopes";
        } | {
            accessTokenExpiresAt: number | null;
            missingScopes: Array<string>;
            refreshTokenExpiresAt: number | null;
            scopes: Array<string>;
            status: "reconnect_required";
        }, Name>;
        verifySessionToken: FunctionReference<"action", "internal", {
            sessionToken: string;
        }, {
            shopDomain: string;
            shopifyUserId: string;
        }, Name>;
    };
    install: {
        reencrypt: FunctionReference<"action", "internal", {
            batchSize?: number;
            cursor?: string | null;
            dryRun?: boolean;
        }, {
            isDone: boolean;
            migrated: number;
            nextCursor: string | null;
            processed: number;
        }, Name>;
        uninstall: FunctionReference<"mutation", "internal", {
            shopDomain: string;
        }, null, Name>;
    };
    partner: {
        gql: FunctionReference<"action", "internal", {
            query: string;
            variables: Record<string, any>;
        }, {
            data: any;
            errors: Array<{
                extensions: Record<string, any>;
                locations: Array<{
                    column: number;
                    line: number;
                }>;
                message: string;
                path: Array<string | number>;
            }>;
            metadata: {
                apiVersion: string | null;
                cost: null | {
                    actualQueryCost: number | null;
                    requestedQueryCost: number | null;
                };
                httpStatus: number;
                requestId: string | null;
                throttleStatus: null | {
                    currentlyAvailable: number | null;
                    maximumAvailable: number | null;
                    restoreRate: number | null;
                };
            };
        }, Name>;
    };
    webhooks: {
        verify: FunctionReference<"action", "internal", {
            body: ArrayBuffer;
            signature: string;
        }, boolean, Name>;
        verifyRequestHmac: FunctionReference<"action", "internal", {
            body: ArrayBuffer;
            signature: string;
        }, boolean, Name>;
    };
};
//# sourceMappingURL=component.d.ts.map