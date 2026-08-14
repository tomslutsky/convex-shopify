import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { v } from 'convex/values';
import { env, internalMutation, internalQuery } from './_generated/server.js';
function requiredScopes() {
    return normalizeScopes(env.SHOPIFY_SCOPES ?? '');
}
export function normalizeScopes(scopes) {
    return [...new Set(scopes.split(',').map((scope) => scope.trim()).filter(Boolean))].sort();
}
export function missingScopes(grantedScopes) {
    const granted = new Set(normalizeScopes(grantedScopes));
    return requiredScopes().filter((scope) => !granted.has(scope) && !(scope.startsWith('read_') && granted.has(`write_${scope.slice('read_'.length)}`)));
}
export const upsert = internalMutation({
    args: {
        shopDomain: v.string(), encryptedAccessToken: v.string(), tokenIv: v.string(), tokenKeyVersion: v.string(), scopes: v.string(),
        accessTokenExpiresAt: v.optional(v.number()), encryptedRefreshToken: v.optional(v.string()), refreshTokenIv: v.optional(v.string()), refreshTokenExpiresAt: v.optional(v.number()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db.query('offlineSessions').withIndex('by_shopDomain', (q) => q.eq('shopDomain', args.shopDomain)).unique();
        const now = Date.now();
        const value = {
            encryptedAccessToken: args.encryptedAccessToken, tokenIv: args.tokenIv, tokenKeyVersion: args.tokenKeyVersion, scopes: normalizeScopes(args.scopes).join(','),
            ...(args.accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt: args.accessTokenExpiresAt } : {}),
            ...(args.encryptedRefreshToken !== undefined && args.refreshTokenIv !== undefined ? { encryptedRefreshToken: args.encryptedRefreshToken, refreshTokenIv: args.refreshTokenIv } : {}),
            ...(args.refreshTokenExpiresAt !== undefined ? { refreshTokenExpiresAt: args.refreshTokenExpiresAt } : {}),
            credentialGeneration: (existing?.credentialGeneration ?? 0) + 1,
        };
        if (existing)
            await ctx.db.patch('offlineSessions', existing._id, { ...value, updatedAt: now });
        else
            await ctx.db.insert('offlineSessions', { shopDomain: args.shopDomain, ...value, installedAt: now, updatedAt: now });
        return null;
    },
});
const installationValue = v.object({
    shopDomain: v.string(), encryptedAccessToken: v.string(), tokenIv: v.string(), tokenKeyVersion: v.string(), scopes: v.string(), credentialGeneration: v.number(),
    accessTokenExpiresAt: v.optional(v.number()), encryptedRefreshToken: v.optional(v.string()), refreshTokenIv: v.optional(v.string()), refreshTokenExpiresAt: v.optional(v.number()),
});
export const forStore = internalQuery({
    args: { shopDomain: v.string() },
    returns: v.union(v.null(), installationValue),
    handler: async (ctx, args) => {
        const session = await ctx.db.query('offlineSessions').withIndex('by_shopDomain', (q) => q.eq('shopDomain', args.shopDomain)).unique();
        if (!session)
            return null;
        return {
            shopDomain: session.shopDomain, encryptedAccessToken: session.encryptedAccessToken, tokenIv: session.tokenIv, tokenKeyVersion: session.tokenKeyVersion, scopes: session.scopes, credentialGeneration: session.credentialGeneration ?? 0,
            accessTokenExpiresAt: session.accessTokenExpiresAt, encryptedRefreshToken: session.encryptedRefreshToken, refreshTokenIv: session.refreshTokenIv, refreshTokenExpiresAt: session.refreshTokenExpiresAt,
        };
    },
});
export const state = internalQuery({
    args: { shopDomain: v.string() },
    returns: v.object({
        scopes: v.array(v.string()), missingScopes: v.array(v.string()), accessTokenExpiresAt: v.union(v.number(), v.null()), refreshTokenExpiresAt: v.union(v.number(), v.null()),
    }),
    handler: async (ctx, args) => {
        const session = await ctx.db.query('offlineSessions').withIndex('by_shopDomain', (q) => q.eq('shopDomain', args.shopDomain)).unique();
        return session
            ? { scopes: normalizeScopes(session.scopes), missingScopes: missingScopes(session.scopes), accessTokenExpiresAt: session.accessTokenExpiresAt ?? null, refreshTokenExpiresAt: session.refreshTokenExpiresAt ?? null }
            : { scopes: [], missingScopes: [], accessTokenExpiresAt: null, refreshTokenExpiresAt: null };
    },
});
export const snapshot = internalQuery({
    args: { shopDomain: v.string() },
    returns: v.object({
        installed: v.boolean(), scopes: v.array(v.string()), missingScopes: v.array(v.string()), accessTokenExpiresAt: v.union(v.number(), v.null()), refreshTokenExpiresAt: v.union(v.number(), v.null()),
    }),
    handler: async (ctx, args) => {
        const session = await ctx.db.query('offlineSessions').withIndex('by_shopDomain', (q) => q.eq('shopDomain', args.shopDomain)).unique();
        return session
            ? { installed: true, scopes: normalizeScopes(session.scopes), missingScopes: missingScopes(session.scopes), accessTokenExpiresAt: session.accessTokenExpiresAt ?? null, refreshTokenExpiresAt: session.refreshTokenExpiresAt ?? null }
            : { installed: false, scopes: [], missingScopes: [], accessTokenExpiresAt: null, refreshTokenExpiresAt: null };
    },
});
export const existsForShop = internalQuery({
    args: { shopDomain: v.string() },
    returns: v.boolean(),
    handler: async (ctx, args) => (await ctx.db.query('offlineSessions').withIndex('by_shopDomain', (q) => q.eq('shopDomain', args.shopDomain)).unique()) !== null,
});
const reencryptRow = v.object({
    _id: v.id('offlineSessions'), _creationTime: v.number(),
    encryptedAccessToken: v.string(), tokenIv: v.string(), tokenKeyVersion: v.string(), encryptedRefreshToken: v.optional(v.string()), refreshTokenIv: v.optional(v.string()),
    credentialGeneration: v.number(),
});
export const reencryptPage = internalQuery({
    args: { paginationOpts: paginationOptsValidator },
    returns: paginationResultValidator(reencryptRow),
    handler: async (ctx, args) => {
        const result = await ctx.db.query('offlineSessions').order('asc').paginate(args.paginationOpts);
        return { ...result, page: result.page.map((row) => ({ _id: row._id, _creationTime: row._creationTime, encryptedAccessToken: row.encryptedAccessToken, tokenIv: row.tokenIv, tokenKeyVersion: row.tokenKeyVersion, encryptedRefreshToken: row.encryptedRefreshToken, refreshTokenIv: row.refreshTokenIv, credentialGeneration: row.credentialGeneration ?? 0 })) };
    },
});
export const persistReencrypted = internalMutation({
    args: { sessionId: v.id('offlineSessions'), expectedTokenKeyVersion: v.string(), expectedGeneration: v.number(), encryptedAccessToken: v.string(), tokenIv: v.string(), tokenKeyVersion: v.string(), encryptedRefreshToken: v.optional(v.string()), refreshTokenIv: v.optional(v.string()) },
    returns: v.boolean(),
    handler: async (ctx, args) => {
        const session = await ctx.db.get('offlineSessions', args.sessionId);
        if (!session || session.tokenKeyVersion !== args.expectedTokenKeyVersion || (session.credentialGeneration ?? 0) !== args.expectedGeneration)
            return false;
        await ctx.db.patch('offlineSessions', args.sessionId, {
            encryptedAccessToken: args.encryptedAccessToken, tokenIv: args.tokenIv, tokenKeyVersion: args.tokenKeyVersion,
            ...(args.encryptedRefreshToken !== undefined && args.refreshTokenIv !== undefined ? { encryptedRefreshToken: args.encryptedRefreshToken, refreshTokenIv: args.refreshTokenIv } : {}),
            credentialGeneration: (session.credentialGeneration ?? 0) + 1,
            updatedAt: Date.now(),
        });
        return true;
    },
});
export const persistRefreshed = internalMutation({
    args: {
        shopDomain: v.string(), expectedGeneration: v.number(), encryptedAccessToken: v.string(), tokenIv: v.string(), tokenKeyVersion: v.string(), scopes: v.string(), accessTokenExpiresAt: v.number(), encryptedRefreshToken: v.string(), refreshTokenIv: v.string(), refreshTokenExpiresAt: v.number(),
    },
    returns: v.boolean(),
    handler: async (ctx, args) => {
        const session = await ctx.db.query('offlineSessions').withIndex('by_shopDomain', (q) => q.eq('shopDomain', args.shopDomain)).unique();
        if (!session || (session.credentialGeneration ?? 0) !== args.expectedGeneration)
            return false;
        await ctx.db.patch('offlineSessions', session._id, {
            encryptedAccessToken: args.encryptedAccessToken, tokenIv: args.tokenIv, tokenKeyVersion: args.tokenKeyVersion, scopes: normalizeScopes(args.scopes).join(','), accessTokenExpiresAt: args.accessTokenExpiresAt,
            encryptedRefreshToken: args.encryptedRefreshToken, refreshTokenIv: args.refreshTokenIv, refreshTokenExpiresAt: args.refreshTokenExpiresAt,
            credentialGeneration: args.expectedGeneration + 1, updatedAt: Date.now(),
        });
        return true;
    },
});
//# sourceMappingURL=installations.js.map