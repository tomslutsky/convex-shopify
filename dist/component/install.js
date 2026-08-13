import { v } from 'convex/values';
import { action, mutation } from './_generated/server';
import { internal } from './_generated/api';
import { credentialKeyring, decryptCredential, encryptCredential } from './lib/credentialCrypto';
const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
export const uninstall = mutation({
    args: { shopDomain: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        const session = await ctx.db.query('offlineSessions').withIndex('by_shopDomain', (q) => q.eq('shopDomain', args.shopDomain)).unique();
        if (session)
            await ctx.db.delete('offlineSessions', session._id);
        return null;
    },
});
export const reencrypt = action({
    args: { cursor: v.optional(v.union(v.string(), v.null())), batchSize: v.optional(v.number()), dryRun: v.optional(v.boolean()) },
    returns: v.object({ processed: v.number(), migrated: v.number(), nextCursor: v.union(v.string(), v.null()), isDone: v.boolean() }),
    handler: async (ctx, args) => {
        const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
        if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE)
            throw new Error(`batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}`);
        const currentVersion = credentialKeyring().activeVersion;
        const page = await ctx.runQuery(internal.installations.reencryptPage, { paginationOpts: { cursor: args.cursor ?? null, numItems: batchSize } });
        let migrated = 0;
        for (const row of page.page) {
            if (row.tokenKeyVersion === currentVersion)
                continue;
            const plaintext = await decryptCredential(row.encryptedAccessToken, row.tokenIv, row.tokenKeyVersion);
            const encrypted = await encryptCredential(plaintext);
            let refresh = null;
            if (row.encryptedRefreshToken && row.refreshTokenIv) {
                const refreshedPlaintext = await decryptCredential(row.encryptedRefreshToken, row.refreshTokenIv, row.tokenKeyVersion);
                const reencrypted = await encryptCredential(refreshedPlaintext);
                refresh = { encryptedRefreshToken: reencrypted.encryptedAccessToken, refreshTokenIv: reencrypted.tokenIv };
            }
            if (!args.dryRun) {
                const persisted = await ctx.runMutation(internal.installations.persistReencrypted, { sessionId: row._id, expectedTokenKeyVersion: row.tokenKeyVersion, expectedGeneration: row.credentialGeneration, ...encrypted, ...(refresh ?? {}) });
                if (!persisted)
                    continue;
            }
            migrated += 1;
        }
        return { processed: page.page.length, migrated, nextCursor: page.isDone ? null : page.continueCursor, isDone: page.isDone };
    },
});
//# sourceMappingURL=install.js.map