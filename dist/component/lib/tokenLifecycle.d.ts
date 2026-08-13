import type { ShopifyConnection } from './adminClient';
import type { ActionCtx } from '../_generated/server';
export declare const EXPIRY_SKEW_MS = 60000;
export type StoredOfflineToken = {
    accessTokenExpiresAt?: number;
    encryptedRefreshToken?: string;
    refreshTokenIv?: string;
    refreshTokenExpiresAt?: number;
};
export type OfflineTokenPlan = 'valid' | 'refresh' | 'reconnect';
export declare function offlineTokenPlan(installation: StoredOfflineToken, now: number, forceRefresh?: boolean): OfflineTokenPlan;
export type TokenLifecycleFailureKind = 'installation_missing' | 'transient_refresh_failure' | 'invalid_refresh_token' | 'expired_refresh_token' | 'reconnect_required' | 'token_exchange_rejected';
export declare class ShopifyTokenLifecycleError extends Error {
    readonly kind: TokenLifecycleFailureKind;
    readonly retryable: boolean;
    constructor(kind: TokenLifecycleFailureKind, message: string, retryable: boolean);
}
export declare function ensureFreshConnection(ctx: ActionCtx, shopDomain: string, options?: {
    forceRefresh?: boolean;
}): Promise<ShopifyConnection>;
//# sourceMappingURL=tokenLifecycle.d.ts.map