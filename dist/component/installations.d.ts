export declare function normalizeScopes(scopes: string): string[];
export declare function missingScopes(grantedScopes: string): Array<string>;
export declare const upsert: import("convex/server").RegisteredMutation<"internal", {
    accessTokenExpiresAt?: number | undefined;
    encryptedRefreshToken?: string | undefined;
    refreshTokenIv?: string | undefined;
    refreshTokenExpiresAt?: number | undefined;
    shopDomain: string;
    scopes: string;
    encryptedAccessToken: string;
    tokenIv: string;
    tokenKeyVersion: string;
}, Promise<null>>;
export declare const reconcileScopes: import("convex/server").RegisteredMutation<"internal", {
    shopDomain: string;
    scopes: string[];
}, Promise<{
    installed: boolean;
    changed: boolean;
    scopes: string[];
}>>;
export declare const forStore: import("convex/server").RegisteredQuery<"internal", {
    shopDomain: string;
}, Promise<{
    shopDomain: string;
    encryptedAccessToken: string;
    tokenIv: string;
    tokenKeyVersion: string;
    scopes: string;
    credentialGeneration: number;
    accessTokenExpiresAt: number | undefined;
    encryptedRefreshToken: string | undefined;
    refreshTokenIv: string | undefined;
    refreshTokenExpiresAt: number | undefined;
} | null>>;
export declare const state: import("convex/server").RegisteredQuery<"internal", {
    shopDomain: string;
}, Promise<{
    scopes: string[];
    missingScopes: string[];
    accessTokenExpiresAt: number | null;
    refreshTokenExpiresAt: number | null;
}>>;
export declare const snapshot: import("convex/server").RegisteredQuery<"internal", {
    shopDomain: string;
}, Promise<{
    installed: boolean;
    scopes: string[];
    missingScopes: string[];
    accessTokenExpiresAt: number | null;
    refreshTokenExpiresAt: number | null;
}>>;
export declare const existsForShop: import("convex/server").RegisteredQuery<"internal", {
    shopDomain: string;
}, Promise<boolean>>;
export declare const reencryptPage: import("convex/server").RegisteredQuery<"internal", {
    paginationOpts: {
        id?: number;
        endCursor?: string | null;
        maximumRowsRead?: number;
        maximumBytesRead?: number;
        numItems: number;
        cursor: string | null;
    };
}, Promise<{
    page: {
        _id: import("convex/values").GenericId<"offlineSessions">;
        _creationTime: number;
        encryptedAccessToken: string;
        tokenIv: string;
        tokenKeyVersion: string;
        encryptedRefreshToken: string | undefined;
        refreshTokenIv: string | undefined;
        credentialGeneration: number;
    }[];
    isDone: boolean;
    continueCursor: import("convex/server").Cursor;
    splitCursor?: import("convex/server").Cursor | null;
    pageStatus?: "SplitRecommended" | "SplitRequired" | null;
}>>;
export declare const persistReencrypted: import("convex/server").RegisteredMutation<"internal", {
    encryptedRefreshToken?: string | undefined;
    refreshTokenIv?: string | undefined;
    encryptedAccessToken: string;
    tokenIv: string;
    tokenKeyVersion: string;
    sessionId: import("convex/values").GenericId<"offlineSessions">;
    expectedTokenKeyVersion: string;
    expectedGeneration: number;
}, Promise<boolean>>;
export declare const persistRefreshed: import("convex/server").RegisteredMutation<"internal", {
    shopDomain: string;
    scopes: string;
    encryptedAccessToken: string;
    tokenIv: string;
    tokenKeyVersion: string;
    accessTokenExpiresAt: number;
    encryptedRefreshToken: string;
    refreshTokenIv: string;
    refreshTokenExpiresAt: number;
    expectedGeneration: number;
}, Promise<boolean>>;
//# sourceMappingURL=installations.d.ts.map