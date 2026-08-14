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
        webhookDeliveries: import("convex/server").TableDefinition<import("convex/values").VObject<{
            workId?: string | undefined;
            error?: string | undefined;
            completedAt?: number | undefined;
            shopDomain: string;
            status: "pending" | "succeeded" | "failed";
            webhookId: string;
            topic: string;
            payload: any;
            handler: string;
        }, {
            webhookId: import("convex/values").VString<string, "required">;
            shopDomain: import("convex/values").VString<string, "required">;
            topic: import("convex/values").VString<string, "required">;
            payload: import("convex/values").VAny<any, "required", string>;
            handler: import("convex/values").VString<string, "required">;
            status: import("convex/values").VUnion<"pending" | "succeeded" | "failed", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"succeeded", "required">, import("convex/values").VLiteral<"failed", "required">], "required", never>;
            workId: import("convex/values").VString<string | undefined, "optional">;
            error: import("convex/values").VString<string | undefined, "optional">;
            completedAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "required", "shopDomain" | "status" | "webhookId" | "topic" | "payload" | "handler" | "workId" | "error" | "completedAt" | `payload.${string}`>, {
            by_webhookId: ["webhookId", "_creationTime"];
            by_status: ["status", "_creationTime"];
        }, {}, {}>;
    }, true>;
    modules: {
        './component/_generated/api.js': () => Promise<typeof import("./component/_generated/api.js")>;
        './component/_generated/component.js': () => Promise<typeof import("./component/_generated/component.js")>;
        './component/_generated/dataModel.js': () => Promise<typeof import("./component/_generated/dataModel.js")>;
        './component/_generated/server.js': () => Promise<typeof import("./component/_generated/server.js")>;
        './component/admin.js': () => Promise<typeof import("./component/admin.js")>;
        './component/auth.js': () => Promise<typeof import("./component/auth.js")>;
        './component/convex.config.js': () => Promise<typeof import("./component/convex.config.js")>;
        './component/crons.js': () => Promise<typeof import("./component/crons.js")>;
        './component/install.js': () => Promise<typeof import("./component/install.js")>;
        './component/installations.js': () => Promise<typeof import("./component/installations.js")>;
        './component/lib/adminClient.js': () => Promise<typeof import("./component/lib/adminClient.js")>;
        './component/lib/credentialCrypto.js': () => Promise<typeof import("./component/lib/credentialCrypto.js")>;
        './component/lib/shopifyAuth.js': () => Promise<typeof import("./component/lib/shopifyAuth.js")>;
        './component/lib/tokenLifecycle.js': () => Promise<typeof import("./component/lib/tokenLifecycle.js")>;
        './component/partner.js': () => Promise<typeof import("./component/partner.js")>;
        './component/schema.js': () => Promise<typeof import("./component/schema.js")>;
        './component/webhooks.js': () => Promise<typeof import("./component/webhooks.js")>;
    };
};
export default _default;
//# sourceMappingURL=register.d.ts.map