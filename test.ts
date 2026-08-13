/// <reference types="vite/client" />
import schema from './component/schema.js'
import type { TestConvex } from 'convex-test'
import type { GenericSchema, SchemaDefinition } from 'convex/server'

const modules = import.meta.glob('./component/**/*.*s')

/** Register Shopify's component schema and functions with convex-test. */
export function register<
  TSchema extends SchemaDefinition<GenericSchema, boolean>,
>(t: TestConvex<TSchema>, name = 'shopify'): void {
  t.registerComponent(name, schema, modules)
}

export default { register }
