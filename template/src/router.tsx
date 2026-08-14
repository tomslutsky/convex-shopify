import { createRouter } from '@tanstack/react-router'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { routeTree } from './routeTree.gen'
import { createShopifyAuthCoordinator } from './lib/shopify-auth'

export function getRouter() {
  const url = import.meta.env.VITE_CONVEX_URL
  const convexClient = new ConvexReactClient(url || 'https://setup-required.convex.cloud')
  const auth = createShopifyAuthCoordinator(convexClient)
  return createRouter({
    routeTree,
    context: { convexClient, auth },
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultErrorComponent: ({ error }) => <main className="center"><section className="card"><p className="eyebrow">Shopify app</p><h1>Unable to open the app</h1><p>{error.message}</p><button onClick={() => window.location.reload()}>Try again</button></section></main>,
    Wrap: ({ children }) => <ConvexProvider client={convexClient}>{children}</ConvexProvider>,
  })
}

declare module '@tanstack/react-router' {
  interface Register { router: ReturnType<typeof getRouter> }
}
