import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const packageRoot = path.resolve(import.meta.dirname, '..')
const temporaryRoot = mkdtempSync(
  path.join(tmpdir(), 'convex-shopify-package-'),
)

try {
  const packOutput = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', temporaryRoot],
    {
      cwd: packageRoot,
      encoding: 'utf8',
    },
  )
  const [{ filename }] = JSON.parse(packOutput)
  const consumerRoot = path.join(temporaryRoot, 'consumer')
  cpSync(path.join(packageRoot, 'example'), consumerRoot, { recursive: true })
  const manifestPath = path.join(consumerRoot, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.dependencies = {
    '@convex-dev/shopify': `file:${path.join(temporaryRoot, filename)}`,
    '@graphql-typed-document-node/core': '^3.2.0',
    convex: '^1.43.0',
    graphql: '>=16.0.0 <18.0.0',
  }
  manifest.devDependencies = {
    '@graphql-codegen/cli': '^6.3.1',
    '@shopify/api-codegen-preset': '^2.0.1',
    'graphql-config': '^5.1.6',
    typescript: 'npm:@typescript/typescript6@^6.0.2',
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  const installedTsconfigPath = path.join(consumerRoot, 'tsconfig.json')
  const installedTsconfig = JSON.parse(
    readFileSync(installedTsconfigPath, 'utf8'),
  )
  delete installedTsconfig.compilerOptions.baseUrl
  delete installedTsconfig.compilerOptions.paths
  writeFileSync(
    installedTsconfigPath,
    `${JSON.stringify(installedTsconfig, null, 2)}\n`,
  )
  copyFileSync(
    path.join(packageRoot, 'example', 'consumer.ts'),
    path.join(consumerRoot, 'consumer.ts'),
  )
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund'],
    {
      cwd: consumerRoot,
      stdio: 'inherit',
    },
  )
  execFileSync('npm', ['exec', '--', 'tsc', '--project', './tsconfig.json'], {
    cwd: consumerRoot,
    stdio: 'inherit',
  })
  execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      "await import('@convex-dev/shopify'); await import('@convex-dev/shopify/partner'); await import('@convex-dev/shopify/pagination'); import.meta.resolve('@convex-dev/shopify/convex.config.js'); await import('@convex-dev/shopify/_generated/component.js')",
    ],
    { cwd: consumerRoot, stdio: 'inherit' },
  )
  const installedCli = path.join(
    consumerRoot,
    'node_modules',
    '@convex-dev',
    'shopify',
    'dist',
    'codegen',
    'cli.js',
  )
  execFileSync(process.execPath, [installedCli, 'init'], {
    cwd: consumerRoot,
    stdio: 'inherit',
  })
  const generatedConfig = path.join(consumerRoot, '.graphqlrc.ts')
  if (!existsSync(generatedConfig)) {
    throw new Error('packed CLI did not create .graphqlrc.ts')
  }
  const convexDirectory = path.join(consumerRoot, 'convex')
  mkdirSync(convexDirectory, { recursive: true })
  writeFileSync(
    path.join(convexDirectory, 'shopifyQuery.ts'),
    [
      "import { shopifyApp } from '@convex-dev/shopify'",
      "import type { ComponentApi } from '@convex-dev/shopify/_generated/component.js'",
      '',
      "const component = null as unknown as ComponentApi<'commerce'>",
      'const shopify = shopifyApp({ component })',
      'const SHOP_QUERY = `#graphql',
      '  query PackedShop { shop { id name } }',
      '`',
      '',
      'async function verifyPackedGeneratedTypes() {',
      '  const ctx = null as unknown as Parameters<typeof shopify.unauthenticated.admin>[0]',
      "  const { admin } = await shopify.unauthenticated.admin(ctx, 'example.myshopify.com')",
      '  const result = await admin.graphql(SHOP_QUERY)',
      '  const id: string | undefined = result.data?.shop.id',
      '  return id',
      '}',
      '',
      'void verifyPackedGeneratedTypes',
      '',
    ].join('\n'),
  )
  execFileSync(process.execPath, [installedCli, 'codegen'], {
    cwd: consumerRoot,
    stdio: 'inherit',
  })
  if (
    !existsSync(
      path.join(consumerRoot, 'convex', 'types', 'admin.generated.d.ts'),
    )
  ) {
    throw new Error('packed CLI did not generate the configured output')
  }
  execFileSync('npm', ['exec', '--', 'tsc', '--project', './tsconfig.json'], {
    cwd: consumerRoot,
    stdio: 'inherit',
  })
  console.log(
    'packed artifact imports, typechecks, initializes Shopify-style codegen, and generates from a clean consumer',
  )
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
