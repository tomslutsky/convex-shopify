/* eslint-disable */
import type { ActionBuilder, GenericActionCtx, GenericDatabaseReader, GenericDatabaseWriter, GenericMutationCtx, GenericQueryCtx, HttpActionBuilder, MutationBuilder, QueryBuilder } from 'convex/server'
import type { DataModel } from './dataModel.js'
type Env = {
  readonly APP_AUTH_PRIVATE_JWK: string | undefined
  readonly APP_AUTH_PUBLIC_JWK: string | undefined
  readonly SHOPIFY_API_KEY: string | undefined
  readonly SHOPIFY_API_SECRET: string | undefined
  readonly SHOPIFY_TOKEN_ENCRYPTION_KEY: string | undefined
  readonly SHOPIFY_TOKEN_ENCRYPTION_KEYS: string | undefined
  readonly SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION: string | undefined
  readonly SHOPIFY_SCOPES: string | undefined
}
export declare const query: QueryBuilder<DataModel, 'public'>
export declare const internalQuery: QueryBuilder<DataModel, 'internal'>
export declare const mutation: MutationBuilder<DataModel, 'public'>
export declare const internalMutation: MutationBuilder<DataModel, 'internal'>
export declare const action: ActionBuilder<DataModel, 'public'>
export declare const internalAction: ActionBuilder<DataModel, 'internal'>
export declare const httpAction: HttpActionBuilder
export declare const env: Env
export type QueryCtx = GenericQueryCtx<DataModel>
export type MutationCtx = GenericMutationCtx<DataModel>
export type ActionCtx = GenericActionCtx<DataModel>
export type DatabaseReader = GenericDatabaseReader<DataModel>
export type DatabaseWriter = GenericDatabaseWriter<DataModel>
