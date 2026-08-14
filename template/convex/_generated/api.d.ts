/* eslint-disable */
import type * as http from '../http.js'
import type * as shopify from '../shopify.js'
import type * as stores from '../stores.js'
import type * as uninstall from '../uninstall.js'
import type * as webhooks from '../webhooks.js'
import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server'

declare const fullApi: ApiFromModules<{
  http: typeof http
  shopify: typeof shopify
  stores: typeof stores
  uninstall: typeof uninstall
  webhooks: typeof webhooks
}>
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>
export declare const components: {
  shopify: import('@convex-dev/shopify/_generated/component.js').ComponentApi<'shopify'>
}
