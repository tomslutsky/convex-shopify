import { defineComponent } from 'convex/server';
import { v } from 'convex/values';
const component = defineComponent('shopify', {
    env: {
        SHOPIFY_API_KEY: v.optional(v.string()),
        SHOPIFY_API_SECRET: v.optional(v.string()),
        SHOPIFY_TOKEN_ENCRYPTION_KEY: v.optional(v.string()),
        SHOPIFY_TOKEN_ENCRYPTION_KEYS: v.optional(v.string()),
        SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION: v.optional(v.string()),
        SHOPIFY_API_VERSION: v.optional(v.string()),
        SHOPIFY_SCOPES: v.optional(v.string()),
        SHOPIFY_PARTNER_ORGANIZATION_ID: v.optional(v.string()),
        SHOPIFY_PARTNER_ACCESS_TOKEN: v.optional(v.string()),
        SHOPIFY_PARTNER_API_VERSION: v.optional(v.string()),
    },
});
export default component;
//# sourceMappingURL=convex.config.js.map