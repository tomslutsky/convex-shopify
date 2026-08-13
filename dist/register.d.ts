import type { TestConvex } from 'convex-test';
import type { GenericSchema, SchemaDefinition } from 'convex/server';
import type { internal as componentInternal } from './component/_generated/api.js';
export declare function register(t: TestConvex<SchemaDefinition<GenericSchema, boolean>>, name?: string): void;
type InstallationUpsertReference = typeof componentInternal.installations.upsert;
/**
 * App-test-only reference for seeding an installation. Package consumers
 * should use the registration-only helper exported from `@convex-dev/shopify/test`.
 */
export declare function componentRef(path: 'installations/upsert', name?: string): InstallationUpsertReference;
declare const _default: {
    register: typeof register;
    schema: SchemaDefinition<{
        offlineSessions: import("convex/server").TableDefinition<import("convex/values").VObject<{
            accessTokenExpiresAt?: number | undefined;
            encryptedRefreshToken?: string | undefined;
            refreshTokenIv?: string | undefined;
            refreshTokenExpiresAt?: number | undefined;
            shopDomain: string;
            encryptedAccessToken: string;
            tokenIv: string;
            tokenKeyVersion: string;
            scopes: string;
            credentialGeneration: number;
            installedAt: number;
            updatedAt: number;
        }, {
            shopDomain: import("convex/values").VString<string, "required">;
            encryptedAccessToken: import("convex/values").VString<string, "required">;
            tokenIv: import("convex/values").VString<string, "required">;
            tokenKeyVersion: import("convex/values").VString<string, "required">;
            scopes: import("convex/values").VString<string, "required">;
            accessTokenExpiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
            encryptedRefreshToken: import("convex/values").VString<string | undefined, "optional">;
            refreshTokenIv: import("convex/values").VString<string | undefined, "optional">;
            refreshTokenExpiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
            credentialGeneration: import("convex/values").VFloat64<number, "required">;
            installedAt: import("convex/values").VFloat64<number, "required">;
            updatedAt: import("convex/values").VFloat64<number, "required">;
        }, "required", "shopDomain" | "encryptedAccessToken" | "tokenIv" | "tokenKeyVersion" | "scopes" | "accessTokenExpiresAt" | "encryptedRefreshToken" | "refreshTokenIv" | "refreshTokenExpiresAt" | "credentialGeneration" | "installedAt" | "updatedAt">, {
            by_shopDomain: ["shopDomain", "_creationTime"];
        }, {}, {}>;
    }, true>;
    modules: Record<string, () => Promise<unknown>>;
};
export default _default;
//# sourceMappingURL=register.d.ts.map