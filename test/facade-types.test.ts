import { expect, expectTypeOf, test } from 'vitest'
import { asShopifyCursor, shopifyApp } from '../client.js'
import { createShopifyPartnerClient } from '../partner.js'
import type { ShopifyGraphQLResult, ShopifySession, ShopifyWebhookAuthenticationError } from '../client.js'
import type { ShopifyPartnerGraphQLResult } from '../partner.js'
import type { ComponentApi } from '../component/_generated/component.js'
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

type ShopResult = { shop: { id: string; name: string } }
type ShopVariables = { first: number; after?: ReturnType<typeof asShopifyCursor> | null }

const customMount = null as unknown as ComponentApi<'merchantShopify'>
const shopDocument = null as unknown as TypedDocumentNode<ShopResult, ShopVariables>
const compileOnly = (): boolean => false

test('template facade preserves custom mount and TypedDocumentNode inference', async () => {
  const shopify = shopifyApp({ component: customMount })
  const partner = createShopifyPartnerClient(customMount)

  if (compileOnly()) {
    const ctx = null as unknown as Parameters<typeof shopify.authenticate.admin>[0]
    const authenticated = await shopify.authenticate.admin(ctx, { sessionToken: 'jwt' })
    expectTypeOf(authenticated.session).toEqualTypeOf<ShopifySession>()
    expectTypeOf(authenticated.shopifyUserId).toEqualTypeOf<string>()
    const result = await authenticated.admin.graphqlDocument(shopDocument, {
      variables: { first: 10, after: asShopifyCursor('next-page') },
    })
    expectTypeOf(result).toEqualTypeOf<ShopifyGraphQLResult<ShopResult>>()

    const offline = await shopify.unauthenticated.admin(ctx, 'example.myshopify.com')
    expectTypeOf(offline.session).toEqualTypeOf<ShopifySession>()
    const stored = await shopify.sessionStorage.findSessionByShop(ctx, 'example.myshopify.com')
    expectTypeOf(stored).toEqualTypeOf<ShopifySession | null>()

    const handler = null as unknown as Parameters<typeof shopify.webhooks.accept>[2]['handler']
    const accepted = await shopify.webhooks.accept(ctx, {
      shop: 'example.myshopify.com', topic: 'PRODUCTS_UPDATE', payload: {},
      webhookId: 'delivery-1', rawBody: new ArrayBuffer(0), session: null,
    }, { handler })
    expectTypeOf(accepted.status).toEqualTypeOf<'accepted' | 'duplicate'>()
    const failed = await shopify.webhooks.listFailed(ctx)
    expectTypeOf(failed[0]!.deliveryId).toEqualTypeOf<string>()
    await shopify.webhooks.replay(ctx, failed[0]!.deliveryId)

    // @ts-expect-error variables must match the TypedDocumentNode
    await authenticated.admin.graphqlDocument(shopDocument, { variables: { first: '10' } })
    const invalidDocument = null as unknown as TypedDocumentNode<ShopResult, { when: Date }>
    // @ts-expect-error variables must be serializable object records
    await authenticated.admin.graphqlDocument(invalidDocument, { variables: { when: new Date() } })

    const partnerCtx = null as unknown as Parameters<typeof partner.graphql>[0]
    const partnerResult = await partner.graphql(partnerCtx, {
      document: shopDocument,
      variables: { first: 10, after: null },
    })
    expectTypeOf(partnerResult).toEqualTypeOf<ShopifyPartnerGraphQLResult<ShopResult>>()
  }

  expect(asShopifyCursor('cursor')).toBe('cursor')
})

test('authenticate.webhook reads official Shopify headers and exact raw body', async () => {
  const component = {
    auth: { snapshot: {} },
    webhooks: { verifyRequestHmac: {} },
  } as unknown as ComponentApi<'merchantShopify'>
  const shopify = shopifyApp({ component })
  const ctx = {
    runAction: (_reference: unknown, args: { signature: string }) => Promise.resolve(args.signature === 'valid'),
    runQuery: () => Promise.resolve({ installed: false, scopes: [], missingScopes: [], accessTokenExpiresAt: null, refreshTokenExpiresAt: null }),
  } as unknown as Parameters<typeof shopify.authenticate.webhook>[0]
  const headers = {
    'x-shopify-hmac-sha256': 'valid',
    'x-shopify-shop-domain': 'Example.myshopify.com',
    'x-shopify-topic': 'products/update',
    'x-shopify-webhook-id': 'delivery-1',
  }
  const result = await shopify.authenticate.webhook(ctx, new Request('https://app.test/webhooks', {
    method: 'POST', headers, body: '{"shop_id":123}',
  }))
  expect(result).toMatchObject({ shop: 'example.myshopify.com', topic: 'PRODUCTS_UPDATE', webhookId: 'delivery-1', payload: { shop_id: 123 }, session: null })
  expect(new TextDecoder().decode(result.rawBody)).toBe('{"shop_id":123}')

  await expect(shopify.authenticate.webhook(ctx, new Request('https://app.test/webhooks', {
    method: 'POST',
    headers: { ...headers, 'x-shopify-hmac-sha256': 'invalid' },
    body: '{}',
  }))).rejects.toMatchObject({ reason: 'invalid_hmac' } satisfies Partial<ShopifyWebhookAuthenticationError>)
})

test('admin.graphql rejects variables that Convex cannot serialize', async () => {
  const component = {
    auth: { getState: {} },
    admin: { gql: {} },
  } as unknown as ComponentApi<'merchantShopify'>
  const shopify = shopifyApp({ component })
  const ctx = {
    runAction: (_reference: unknown, args: Record<string, unknown>) =>
      Promise.resolve(
        'query' in args
          ? {
              data: { shop: { id: 'gid://shopify/Shop/1' } },
              errors: [],
              metadata: {
                requestId: null,
                apiVersion: '2026-07',
                httpStatus: 200,
                cost: null,
                throttleStatus: null,
              },
            }
          : {
              status: 'ready',
              scopes: [],
              missingScopes: [],
              accessTokenExpiresAt: null,
              refreshTokenExpiresAt: null,
            },
      ),
  } as unknown as Parameters<typeof shopify.unauthenticated.admin>[0]
  const { admin } = await shopify.unauthenticated.admin(
    ctx,
    'example.myshopify.com',
  )

  await expect(
    admin.graphql(`#graphql query RuntimeVariables { shop { id } }`, {
      variables: { json: { enabled: true, values: [1, null, 'ok'] } },
    }),
  ).resolves.toMatchObject({ data: { shop: { id: 'gid://shopify/Shop/1' } } })

  const invalidValues: Array<unknown> = [
    new Date(),
    undefined,
    Number.POSITIVE_INFINITY,
    () => undefined,
  ]
  for (const invalid of invalidValues) {
    await expect(
      admin.graphql(`#graphql query InvalidVariables { shop { id } }`, {
        variables: { invalid } as never,
      }),
    ).rejects.toThrow('must be Convex-serializable')
  }
})
