import type { TestConvex } from 'convex-test';
import type { GenericSchema, SchemaDefinition } from 'convex/server';
/** Register Shopify's component schema and functions with convex-test. */
export declare function register<TSchema extends SchemaDefinition<GenericSchema, boolean>>(t: TestConvex<TSchema>, name?: string): void;
declare const _default: {
    register: typeof register;
};
export default _default;
//# sourceMappingURL=test.d.ts.map