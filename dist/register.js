/// <reference types="vite/client" />
import schema from './component/schema.js';
const modules = import.meta.glob('./component/**/*.*s');
export function register(t, name = 'shopify') {
    t.registerComponent(name, schema, modules);
}
const toReferencePath = Symbol.for('toReferencePath');
/**
 * App-test-only reference for seeding an installation. Package consumers
 * should use the registration-only helper exported from `@convex-dev/shopify/test`.
 */
export function componentRef(path, name = 'shopify') {
    return {
        [toReferencePath]: `_reference/childComponent/${name}/${path}`,
    };
}
export default { register, schema, modules };
//# sourceMappingURL=register.js.map