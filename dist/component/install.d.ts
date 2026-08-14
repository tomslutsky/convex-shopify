export declare const uninstall: import("convex/server").RegisteredMutation<"public", {
    shopDomain: string;
}, Promise<null>>;
export declare const reconcileScopes: import("convex/server").RegisteredMutation<"public", {
    shopDomain: string;
    scopes: string[];
}, Promise<{
    installed: boolean;
    changed: boolean;
    scopes: Array<string>;
}>>;
export declare const reencrypt: import("convex/server").RegisteredAction<"public", {
    batchSize?: number | undefined;
    cursor?: string | null | undefined;
    dryRun?: boolean | undefined;
}, Promise<{
    processed: number;
    migrated: number;
    nextCursor: string | null;
    isDone: boolean;
}>>;
//# sourceMappingURL=install.d.ts.map