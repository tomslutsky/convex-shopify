import { ApiType, shopifyApiProject } from '@shopify/api-codegen-preset'
import { SHOPIFY_ADMIN_API_VERSION } from './convex/lib/shopifyConfig'
import type { IGraphQLConfig } from 'graphql-config'

const documents = ['./convex/**/*.{ts,tsx}']
const config: IGraphQLConfig = {
  schema: `https://shopify.dev/admin-graphql-direct-proxy/${SHOPIFY_ADMIN_API_VERSION}`,
  documents,
  projects: {
    default: shopifyApiProject({
      apiType: ApiType.Admin,
      apiVersion: SHOPIFY_ADMIN_API_VERSION,
      documents,
      outputDir: './convex/types',
      module: '@convex-dev/shopify',
    }),
  },
}

export default config
