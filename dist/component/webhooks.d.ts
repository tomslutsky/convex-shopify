export declare const verifyRequestHmac: import("convex/server").RegisteredAction<"public", {
    body: ArrayBuffer;
    signature: string;
}, Promise<boolean>>;
export declare const verify: import("convex/server").RegisteredAction<"public", {
    body: ArrayBuffer;
    signature: string;
}, Promise<boolean>>;
//# sourceMappingURL=webhooks.d.ts.map