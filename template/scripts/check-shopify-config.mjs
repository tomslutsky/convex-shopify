import { readFile } from 'node:fs/promises'
import { parse } from 'smol-toml'

const source = await readFile('convex/lib/shopifyConfig.ts', 'utf8')
const configured = [...source.matchAll(/'([a-z]+_[a-z_]+)'/g)].map((match) => match[1]).sort()
const runtimeVersion = source.match(/SHOPIFY_ADMIN_API_VERSION\s*=\s*'([^']+)'/)?.[1]
const problems = []
const paths = ['shopify.app.toml']
try { await readFile('shopify.app.development.toml', 'utf8'); paths.push('shopify.app.development.toml') } catch { /* named config is created during setup */ }
for (const path of paths) {
  const toml = await readFile(path, 'utf8')
  try {
    parse(toml)
  } catch {
    problems.push(`${path} is not valid TOML`)
    continue
  }
  const scopes = toml.match(/^scopes\s*=\s*"([^"]*)"/m)?.[1]?.split(',').map((value) => value.trim()).filter(Boolean).sort()
  const tomlVersion = toml.match(/^api_version\s*=\s*"([^"]+)"/m)?.[1]
  if (!scopes || JSON.stringify(scopes) !== JSON.stringify(configured)) problems.push(`${path} scopes differ: TOML=${scopes?.join(',') ?? 'missing'} runtime=${configured.join(',')}`)
  if (!tomlVersion || tomlVersion !== runtimeVersion) problems.push(`${path} API versions differ: TOML=${tomlVersion ?? 'missing'} runtime=${runtimeVersion ?? 'missing'}`)
}
if (problems.length) { process.stderr.write(`${problems.join('\n')}\n`); process.exitCode = 1 }
else process.stdout.write(`Shopify configuration is consistent (${runtimeVersion}; ${configured.join(',')}).\n`)
