import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => ({ store: await context.auth.ensureStore() }),
  // Shopify Admin already links the app name to `/`; add s-app-nav only when
  // the app gains another top-level destination.
  component: Outlet,
})
