// Keep this explicit so packaged consumers can use the convex-test helper.
// Vite intentionally does not transform import.meta.glob inside dependencies.
export const componentModules = {
  './component/_generated/api.js': () => import('./component/_generated/api.js'),
  './component/_generated/component.js': () => import('./component/_generated/component.js'),
  './component/_generated/dataModel.js': () => import('./component/_generated/dataModel.js'),
  './component/_generated/server.js': () => import('./component/_generated/server.js'),
  './component/admin.js': () => import('./component/admin.js'),
  './component/auth.js': () => import('./component/auth.js'),
  './component/convex.config.js': () => import('./component/convex.config.js'),
  './component/crons.js': () => import('./component/crons.js'),
  './component/install.js': () => import('./component/install.js'),
  './component/installations.js': () => import('./component/installations.js'),
  './component/lib/adminClient.js': () => import('./component/lib/adminClient.js'),
  './component/lib/credentialCrypto.js': () => import('./component/lib/credentialCrypto.js'),
  './component/lib/shopifyAuth.js': () => import('./component/lib/shopifyAuth.js'),
  './component/lib/tokenLifecycle.js': () => import('./component/lib/tokenLifecycle.js'),
  './component/partner.js': () => import('./component/partner.js'),
  './component/schema.js': () => import('./component/schema.js'),
  './component/webhooks.js': () => import('./component/webhooks.js'),
}
