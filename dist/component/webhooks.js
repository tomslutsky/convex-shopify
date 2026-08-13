import { v } from 'convex/values';
import { action } from './_generated/server';
import { validShopifyWebhook } from './lib/shopifyAuth';
const verifyHmac = async (body, signature) => validShopifyWebhook(body, signature);
export const verifyRequestHmac = action({
    args: { body: v.bytes(), signature: v.string() },
    returns: v.boolean(),
    handler: async (_ctx, args) => verifyHmac(args.body, args.signature),
});
// Backwards-compatible raw reference. This verifies only the HMAC; parsing,
// topic/shop validation, delivery deduplication, and processing remain app-owned.
export const verify = action({
    args: { body: v.bytes(), signature: v.string() },
    returns: v.boolean(),
    handler: async (_ctx, args) => verifyHmac(args.body, args.signature),
});
//# sourceMappingURL=webhooks.js.map