import { access, readFile } from 'node:fs/promises'

const issues = []
let toml = await readFile('shopify.app.toml', 'utf8')
try { toml = await readFile('shopify.app.development.toml', 'utf8') } catch { /* use the template-safe base config */ }
if (toml.includes('REPLACE_WITH_SHOPIFY_CLIENT_ID')) issues.push('Link a Shopify app: npx shopify app config link --config development')
if (toml.includes('example.invalid')) issues.push('Let Shopify CLI update development URLs, and configure production URLs before release')
try {
  const local = await readFile('.env.local', 'utf8')
  for (const name of ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL', 'VITE_SHOPIFY_API_KEY']) if (!new RegExp(`^${name}=.+`, 'm').test(local)) issues.push(`Set ${name} in .env.local`)
} catch { issues.push('Run npx convex dev to create/link a project and generate .env.local') }
try { await access('convex/types/admin.generated.d.ts') } catch { issues.push('Run npm run shopify:codegen') }
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
if (!packageJson.dependencies?.['@convex-dev/static-hosting']) issues.push('Install @convex-dev/static-hosting')
if (!packageJson.scripts?.['publish:static']?.includes('--dist dist/client')) issues.push('Restore the publish:static script for the TanStack SPA output')
const convexConfig = await readFile('convex/convex.config.ts', 'utf8')
if (!convexConfig.includes("app.use(staticHosting)")) issues.push('Mount the static-hosting component in convex/convex.config.ts')
const viteConfig = await readFile('vite.config.ts', 'utf8')
if (!viteConfig.includes('spa: { enabled: true }')) issues.push('Keep TanStack Start configured in SPA mode')
if (issues.length) {
  process.stdout.write(`Setup is incomplete:\n${issues.map((item) => `- ${item}`).join('\n')}\n`)
  process.exitCode = 1
} else process.stdout.write('Local configuration and static-hosting wiring look ready. Use the release runbook before publishing.\n')
