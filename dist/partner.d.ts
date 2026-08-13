import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ComponentApi } from './component/_generated/component.js';
import type { SerializableVariables, ShopifyGraphQLError, ShopifyGraphQLMetadata } from './client.js';
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server';
type ActionCtx = {
    runAction: <TAction extends FunctionReference<'action', 'internal'>>(action: TAction, ...args: OptionalRestArgs<TAction>) => Promise<FunctionReturnType<TAction>>;
};
export type ShopifyPartnerGraphQLResult<TResult> = {
    data: TResult | null;
    errors: Array<ShopifyGraphQLError>;
    metadata: ShopifyGraphQLMetadata;
};
/**
 * Create an organization-scoped Partner API client. Its credentials are
 * independent from merchant installations and are not persisted by the
 * component.
 */
export declare function createShopifyPartnerClient<TName extends string | undefined>(component: ComponentApi<TName>): {
    graphql: <TResult, TVariables extends SerializableVariables>(ctx: ActionCtx, args: {
        document: TypedDocumentNode<TResult, TVariables>;
        variables: TVariables;
    }) => Promise<ShopifyPartnerGraphQLResult<TResult>>;
};
export {};
//# sourceMappingURL=partner.d.ts.map