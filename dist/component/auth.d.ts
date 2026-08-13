type ConnectionState = {
    status: 'not_installed' | 'ready' | 'missing_scopes' | 'reconnect_required';
    scopes: Array<string>;
    missingScopes: Array<string>;
    accessTokenExpiresAt: number | null;
    refreshTokenExpiresAt: number | null;
};
type InstallationSnapshot = Omit<ConnectionState, 'status'> & {
    installed: boolean;
};
export declare const exchangeSessionToken: import("convex/server").RegisteredAction<"public", {
    sessionToken: string;
}, Promise<{
    shopDomain: string;
    shopifyUserId: string;
    state: ConnectionState;
}>>;
export declare const verifySessionToken: import("convex/server").RegisteredAction<"public", {
    sessionToken: string;
}, Promise<{
    shopDomain: string;
    shopifyUserId: string;
}>>;
export declare const state: import("convex/server").RegisteredQuery<"public", {
    now?: number | undefined;
    shopDomain: string;
}, Promise<ConnectionState>>;
export declare const snapshot: import("convex/server").RegisteredQuery<"public", {
    shopDomain: string;
}, Promise<InstallationSnapshot>>;
export declare const getState: import("convex/server").RegisteredAction<"public", {
    shopDomain: string;
}, Promise<ConnectionState>>;
export {};
//# sourceMappingURL=auth.d.ts.map