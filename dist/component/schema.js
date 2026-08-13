import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
// Encrypted per-store Shopify credentials. Ciphertext is AES-GCM encrypted
// with the component's SHOPIFY_TOKEN_ENCRYPTION_KEY (see lib/credentialCrypto)
// and may be re-encrypted onto a new key version without merchant involvement.
export default defineSchema({
    offlineSessions: defineTable({
        shopDomain: v.string(),
        encryptedAccessToken: v.string(),
        tokenIv: v.string(),
        tokenKeyVersion: v.string(),
        scopes: v.string(),
        // Expiring offline token bookkeeping. Shopify token exchange populates
        // these fields for every new session.
        accessTokenExpiresAt: v.optional(v.number()),
        encryptedRefreshToken: v.optional(v.string()),
        refreshTokenIv: v.optional(v.string()),
        refreshTokenExpiresAt: v.optional(v.number()),
        // Incremented whenever credentials change. Refresh persistence uses this
        // as an optimistic compare-and-swap guard for single-use refresh tokens.
        credentialGeneration: v.number(),
        installedAt: v.number(),
        updatedAt: v.number(),
    }).index('by_shopDomain', ['shopDomain']),
});
//# sourceMappingURL=schema.js.map