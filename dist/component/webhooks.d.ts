export declare const verifyRequestHmac: import("convex/server").RegisteredAction<"public", {
    body: ArrayBuffer;
    signature: string;
}, Promise<boolean>>;
export declare const verify: import("convex/server").RegisteredAction<"public", {
    body: ArrayBuffer;
    signature: string;
}, Promise<boolean>>;
export declare const accept: import("convex/server").RegisteredMutation<"public", {
    shopDomain: string;
    webhookId: string;
    topic: string;
    payload: any;
    handler: string;
    deduplicate: boolean;
}, Promise<{
    status: "duplicate";
    deliveryId: import("convex/values").GenericId<"webhookDeliveries">;
    reason?: undefined;
} | {
    status: "rejected";
    reason: "invalid_lifecycle_payload";
    deliveryId?: undefined;
} | {
    status: "accepted";
    deliveryId: import("convex/values").GenericId<"webhookDeliveries">;
    reason?: undefined;
}>>;
export declare const runDelivery: import("convex/server").RegisteredAction<"public", {
    deliveryId: import("convex/values").GenericId<"webhookDeliveries">;
}, Promise<null>>;
export declare const getDelivery: import("convex/server").RegisteredQuery<"public", {
    deliveryId: import("convex/values").GenericId<"webhookDeliveries">;
}, Promise<{
    webhookId: string;
    shopDomain: string;
    topic: string;
    payload: any;
    handler: string;
    status: "pending" | "succeeded" | "failed";
} | null>>;
export declare const completeDelivery: import("convex/server").RegisteredMutation<"internal", import("@convex-dev/workpool").OnCompleteArgs, null>;
export declare const listFailed: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
}, Promise<{
    deliveryId: import("convex/values").GenericId<"webhookDeliveries">;
    webhookId: string;
    shopDomain: string;
    topic: string;
    error: string;
    completedAt: number;
}[]>>;
export declare const replay: import("convex/server").RegisteredMutation<"public", {
    deliveryId: import("convex/values").GenericId<"webhookDeliveries">;
}, Promise<null>>;
export declare const pruneDeliveries: import("convex/server").RegisteredMutation<"public", {}, Promise<null>>;
//# sourceMappingURL=webhooks.d.ts.map