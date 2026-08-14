import { createFileRoute } from '@tanstack/react-router'
import { useAppBridge } from '@shopify/app-bridge-react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/_authenticated/')({
  loader: async ({ context }) => context.convexClient.action(api.shopify.shopIdentity, {}),
  component: Home,
})

function Home() {
  const shop = Route.useLoaderData()
  const { store } = Route.useRouteContext()

  return <AppHome shop={shop} role={store.role} />
}

function AppHome({ shop, role }: { shop: { name: string; myshopifyDomain: string }; role: string }) {
  const shopify = useAppBridge()

  return <s-page heading={shop.name}>
    <s-badge slot="accessory" tone="success">Connected</s-badge>
    <s-banner heading="Your embedded app is ready" tone="success">
      Shopify App Bridge, Polaris, Convex authentication, and Admin GraphQL are connected.
    </s-banner>
    <s-section heading="Store connection">
      <s-stack gap="base">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(12rem, 1fr))" gap="base">
          <s-stack gap="small-200">
            <s-text color="subdued">Shop domain</s-text>
            <s-text type="strong">{shop.myshopifyDomain}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Member role</s-text>
            <s-text type="strong">{role}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Admin GraphQL</s-text>
            <s-badge tone="success">Connected</s-badge>
          </s-stack>
        </s-grid>
      </s-stack>
    </s-section>
    <s-section heading="Start building">
      <s-stack gap="base">
        <s-paragraph>
          Replace this page with your product. Keep Shopify credentials inside the component and derive every store scope from the authenticated identity.
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Add your app-owned schema and authorization rules.</s-list-item>
          <s-list-item>Build Admin API operations with typed inline #graphql documents.</s-list-item>
          <s-list-item>Complete the compliance webhook handlers for your domain data.</s-list-item>
        </s-unordered-list>
        <s-stack direction="inline" gap="base">
          <s-button variant="primary" onClick={() => shopify.toast.show('App Bridge is connected')}>Test App Bridge</s-button>
          <s-button href="https://shopify.dev/docs/api/app-home" target="_blank">App Home documentation</s-button>
        </s-stack>
      </s-stack>
    </s-section>
  </s-page>
}
