import { print } from 'graphql';
/**
 * Create an organization-scoped Partner API client. Its credentials are
 * independent from merchant installations and are not persisted by the
 * component.
 */
export function createShopifyPartnerClient(component) {
    return {
        graphql: async (ctx, args) => {
            const raw = await ctx.runAction(component.partner.gql, {
                query: print(args.document),
                variables: args.variables,
            });
            if (!raw.metadata)
                throw new Error('Shopify component returned an invalid Partner GraphQL result');
            return { data: raw.data ?? null, errors: raw.errors ?? [], metadata: raw.metadata };
        },
    };
}
//# sourceMappingURL=partner.js.map