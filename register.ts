import schema from './component/schema.js'
import { componentModules } from './componentModules.js'
import type { TestConvex } from 'convex-test'
import type { GenericSchema, SchemaDefinition } from 'convex/server'
import type { internal as componentInternal } from './component/_generated/api.js'

export function register(t: TestConvex<SchemaDefinition<GenericSchema, boolean>>, name = 'shopify') {
  t.registerComponent(name, schema, componentModules)
}

const toReferencePath = Symbol.for('toReferencePath')

// Component-internal functions can't be called directly from tests (their
// references carry no component path), so wrap a module/function path into a
// reference rooted at the registered "shopify" component.
type InstallationUpsertReference =
  typeof componentInternal.installations.upsert

/**
 * App-test-only reference for seeding an installation. Package consumers
 * should use the registration-only helper exported from `@convex-dev/shopify/test`.
 */
export function componentRef(
  path: 'installations/upsert',
  name = 'shopify',
): InstallationUpsertReference {
  return {
    [toReferencePath]: `_reference/childComponent/${name}/${path}`,
  } as unknown as InstallationUpsertReference
}

export default { register, schema, modules: componentModules }
