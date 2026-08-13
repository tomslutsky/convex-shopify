import schema from './component/schema.js';
import { componentModules } from './componentModules.js';
/** Register Shopify's component schema and functions with convex-test. */
export function register(t, name = 'shopify') {
    t.registerComponent(name, schema, componentModules);
}
export default { register };
//# sourceMappingURL=test.js.map