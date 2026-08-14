import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { ConvexReactClient } from 'convex/react'
import type { ShopifyAuthCoordinator } from '~/lib/shopify-auth'
import appCss from '~/styles/app.css?url'

export const Route = createRootRouteWithContext<{ convexClient: ConvexReactClient; auth: ShopifyAuthCoordinator }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Shopify App Starter' },
      ...(import.meta.env.VITE_SHOPIFY_API_KEY ? [{ name: 'shopify-api-key', content: import.meta.env.VITE_SHOPIFY_API_KEY }] : []),
    ],
    links: [{ rel: 'stylesheet', href: appCss }, { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    scripts: import.meta.env.VITE_SHOPIFY_API_KEY ? [
      { src: 'https://cdn.shopify.com/shopifycloud/app-bridge.js' },
      { src: 'https://cdn.shopify.com/shopifycloud/polaris.js' },
    ] : [],
  }),
  component: () => <html lang="en"><head><HeadContent /></head><body><Outlet /><Scripts /></body></html>,
})
