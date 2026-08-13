type Metadata = {
    requestId: string | null;
    apiVersion: string | null;
    httpStatus: number;
    cost: {
        requestedQueryCost: number | null;
        actualQueryCost: number | null;
    } | null;
    throttleStatus: {
        maximumAvailable: number | null;
        currentlyAvailable: number | null;
        restoreRate: number | null;
    } | null;
};
export declare const gql: import("convex/server").RegisteredAction<"public", {
    query: string;
    variables: Record<string, any>;
}, Promise<{
    data: {} | null;
    errors: {
        message: string;
        locations: {
            line: number;
            column: number;
        }[];
        path: (string | number)[];
        extensions: Record<string, unknown>;
    }[];
    metadata: Metadata;
}>>;
export {};
//# sourceMappingURL=partner.d.ts.map