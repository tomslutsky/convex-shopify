declare const shopifyCursorBrand: unique symbol

/** An opaque cursor returned by a Shopify GraphQL connection. */
export type ShopifyCursor = string & { readonly [shopifyCursorBrand]: true }

/** Brand a non-empty Shopify connection cursor for use in a subsequent query. */
export function asShopifyCursor(cursor: string): ShopifyCursor {
  if (!cursor) throw new Error('Shopify pagination cursor must not be empty')
  return cursor as ShopifyCursor
}

export type ShopifyPageInfo = {
  hasNextPage: boolean
  endCursor: ShopifyCursor | null
}

export type ShopifyConnectionPage<TNode> = {
  nodes: Array<TNode>
  pageInfo: ShopifyPageInfo
}
