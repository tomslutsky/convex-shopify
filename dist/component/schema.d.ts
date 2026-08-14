declare const _default: import("convex/server").SchemaDefinition<{
    offlineSessions: import("convex/server").TableDefinition<import("convex/values").VObject<{
        accessTokenExpiresAt?: number | undefined;
        encryptedRefreshToken?: string | undefined;
        refreshTokenIv?: string | undefined;
        refreshTokenExpiresAt?: number | undefined;
        shopDomain: string;
        scopes: string;
        encryptedAccessToken: string;
        tokenIv: string;
        tokenKeyVersion: string;
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
    }, "required", "shopDomain" | "scopes" | "encryptedAccessToken" | "tokenIv" | "tokenKeyVersion" | "accessTokenExpiresAt" | "encryptedRefreshToken" | "refreshTokenIv" | "refreshTokenExpiresAt" | "credentialGeneration" | "installedAt" | "updatedAt">, {
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
export default _default;
//# sourceMappingURL=schema.d.ts.map