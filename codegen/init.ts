import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const CODEGEN_CONFIG = `import { ApiType, shopifyApiProject } from '@shopify/api-codegen-preset'

const apiVersion = '2026-07'
const documents = ['./convex/**/*.{ts,tsx}']

export default {
  schema: \`https://shopify.dev/admin-graphql-direct-proxy/\${apiVersion}\`,
  documents,
  projects: {
    default: shopifyApiProject({
      apiType: ApiType.Admin,
      apiVersion,
      documents,
      outputDir: './convex/types',
      module: '@convex-dev/shopify',
    }),
  },
}
`

export function runInit(): void {
  const projectRoot = process.cwd()
  const configPath = path.join(projectRoot, '.graphqlrc.ts')
  writeOrKeep(projectRoot, configPath, CODEGEN_CONFIG)
  console.log('')
  console.log('Next steps:')
  console.log(
    '  1. Install @graphql-codegen/cli, @shopify/api-codegen-preset, and graphql-config.',
  )
  console.log(
    '  2. Write inline `#graphql` operations beside admin.graphql calls.',
  )
  console.log(
    '  3. Run convex-shopify codegen (add --watch during development).',
  )
  console.log('  4. Create a token-encryption key: convex-shopify generate-key')
}

function writeOrKeep(
  projectRoot: string,
  filePath: string,
  content: string,
): void {
  if (existsSync(filePath)) {
    console.log(`kept existing ${path.relative(projectRoot, filePath)}`)
    return
  }
  writeFileSync(filePath, content, 'utf8')
  console.log(`created ${path.relative(projectRoot, filePath)}`)
}
