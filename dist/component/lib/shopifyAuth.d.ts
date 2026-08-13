export declare function requiredEnv(name: string): string;
export declare function verifyShopifySessionToken(sessionToken: string): Promise<{
    apiKey: string;
    apiSecret: string;
    sessionToken: string;
    shopDomain: string;
    shopifyUserId: string;
}>;
export type ExpiringOfflineToken = {
    accessToken: string;
    scopes: string;
    expiresIn: number;
    refreshToken: string;
    refreshTokenExpiresIn: number;
};
export type TokenFailureKind = 'transient' | 'invalid_refresh_token' | 'expired_refresh_token' | 'exchange_rejected';
export declare class ShopifyTokenRequestError extends Error {
    readonly kind: TokenFailureKind;
    readonly status: number | null;
    readonly retryable: boolean;
    constructor(kind: TokenFailureKind, message: string, status: number | null, retryable: boolean);
}
type RequestOptions = {
    fetch?: typeof fetch;
    sleep?: (milliseconds: number) => Promise<void>;
    random?: () => number;
    now?: () => number;
    timeoutMs?: number;
    maxAttempts?: number;
};
export declare function exchangeOfflineToken(input: {
    apiKey: string;
    apiSecret: string;
    sessionToken: string;
    shopDomain: string;
}, options?: RequestOptions): Promise<ExpiringOfflineToken>;
export declare function refreshOfflineToken(input: {
    apiKey: string;
    apiSecret: string;
    refreshToken: string;
    shopDomain: string;
}, options?: RequestOptions): Promise<ExpiringOfflineToken>;
export declare function isShopDomain(value: string | null): value is string;
export declare function validShopifyWebhook(body: ArrayBuffer, provided: string | null): Promise<boolean>;
export {};
//# sourceMappingURL=shopifyAuth.d.ts.map