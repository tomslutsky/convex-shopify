/** Brand a non-empty Shopify connection cursor for use in a subsequent query. */
export function asShopifyCursor(cursor) {
    if (!cursor)
        throw new Error('Shopify pagination cursor must not be empty');
    return cursor;
}
//# sourceMappingURL=pagination.js.map