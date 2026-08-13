import schema from './component/schema.js';
import { componentModules } from './componentModules.js';
export function register(t, name = 'shopify') {
    t.registerComponent(name, schema, componentModules);
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
export default { register, schema, modules: componentModules };
//# sourceMappingURL=register.js.map