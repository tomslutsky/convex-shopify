/// <reference types="vite/client" />
import schema from './component/schema.js';
const modules = import.meta.glob('./component/**/*.*s');
/** Register Shopify's component schema and functions with convex-test. */
export function register(t, name = 'shopify') {
    t.registerComponent(name, schema, modules);
}
export default { register };
//# sourceMappingURL=test.js.map