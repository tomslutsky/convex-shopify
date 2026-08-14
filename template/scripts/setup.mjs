import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import process from 'node:process'

const flags = new Set(process.argv.slice(2))
const known = new Set(['--yes', '--check', '--dry-run', '--skip-shopify', '--skip-convex', '--skip-secrets', '--skip-codegen', '--help'])
const dryRun = flags.has('--dry-run')
const assumeYes = flags.has('--yes')
for (const flag of flags) if (!known.has(flag)) fail(`Unknown option: ${flag}`)

if (flags.has('--help')) {
  console.log(`usage: npm run setup -- [options]

Interactive by default and safe to rerun after an interrupted setup.

  --yes           accept setup-step defaults
  --check         only report configuration status
  --dry-run       print commands without running them
  --skip-shopify  do not link a Shopify app
  --skip-convex   do not create or select a Convex project
  --skip-secrets  do not configure Convex environment values
  --skip-codegen  do not run Shopify GraphQL codegen`)
  process.exit(0)
}

if (flags.has('--check')) {
  run('node', ['scripts/check-setup.mjs'])
  process.exit(0)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })

try {
  console.log('\nShopify + Convex setup\n')
  requireCommand('node')
  requireCommand('npm')
  requireCommand('git')

  if (!flags.has('--skip-shopify') && await confirm('Link or create the Shopify app configuration now?', true)) {
    run('npx', ['shopify', 'app', 'config', 'link', '--config', 'development'])
    run('node', ['scripts/sync-shopify-config.mjs', 'development'])
  }
  if (!flags.has('--skip-convex') && await confirm('Create or select a Convex development project now?', true)) {
    run('npx', ['convex', 'dev', '--once'])
  }
  if (!flags.has('--skip-secrets') && await confirm('Generate keys and configure Convex environment values now?', true)) {
    if (!existsSync('.env.local') && !dryRun) fail('Missing .env.local. Run the Convex project step first, then rerun npm run setup.')
    configureSecrets()
  }
  if (!flags.has('--skip-codegen') && await confirm('Generate Shopify Admin GraphQL types now?', true)) {
    run('npm', ['run', 'shopify:codegen'])
  }

  run('npm', ['run', 'config:check'])
  if (!dryRun) run('npm', ['run', 'setup:check'], { allowFailure: true })
  console.log('\nSetup finished. Start the embedded app with:\n\n  npx shopify app dev --config development\n')
  console.log('For production, follow docs/OPERATIONS.md. The reviewed flow deploys Convex first, then publishes dist/client with npm run publish:static.\n')
} finally {
  rl.close()
}

async function confirm(question, defaultValue) {
  if (assumeYes) return true
  const answer = (await rl.question(`${question}${defaultValue ? ' [Y/n] ' : ' [y/N] '}`)).trim().toLowerCase()
  if (!answer) return defaultValue
  return answer === 'y' || answer === 'yes'
}

function configureSecrets() {
  const authFile = '.env.auth-keys.local'
  const encryptionFile = '.shopify-token-encryption-key'
  try {
    if (!dryRun) {
      if (!existsSync(authFile)) run('npm', ['run', 'auth:keys'])
      run('npx', ['convex', 'env', 'set', '--from-file', authFile])
    } else console.log(`$ npm run auth:keys\n$ npx convex env set --from-file ${authFile}`)

    const shopifyConfig = firstExisting(['shopify.app.development.toml', 'shopify.app.toml'])
    const clientId = shopifyConfig ? readFileSync(shopifyConfig, 'utf8').match(/^client_id\s*=\s*"([^"]+)"/m)?.[1] : null
    if (clientId && !clientId.startsWith('REPLACE_')) {
      setPublicEnv('SHOPIFY_API_KEY', clientId)
      upsertLocalEnv('VITE_SHOPIFY_API_KEY', clientId)
    } else if (!dryRun) console.warn('No linked Shopify client ID found; set SHOPIFY_API_KEY and VITE_SHOPIFY_API_KEY after linking.')

    const scopes = readFileSync('shopify.app.toml', 'utf8').match(/^scopes\s*=\s*"([^"]*)"/m)?.[1]
    if (scopes) setPublicEnv('SHOPIFY_SCOPES', scopes)
    setPublicEnv('SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION', 'v1')

    if (!dryRun) {
      if (!existsSync(encryptionFile)) run('npx', ['convex-shopify', 'generate-key', encryptionFile])
      const key = readFileSync(encryptionFile, 'utf8').trim()
      run('npx', ['convex', 'env', 'set', 'SHOPIFY_TOKEN_ENCRYPTION_KEY'], { input: `${key}\n` })
      const shopifySecret = pullShopifyApiSecret()
      if (shopifySecret) {
        run('npx', ['convex', 'env', 'set', 'SHOPIFY_API_SECRET'], { input: `${shopifySecret}\n` })
        console.log('Configured SHOPIFY_API_SECRET from the linked Shopify app.')
      } else {
        console.warn('Could not retrieve the linked Shopify app secret automatically.')
        console.log('Shopify API secret (input is handled by the Convex CLI):')
        run('npx', ['convex', 'env', 'set', 'SHOPIFY_API_SECRET'])
      }
    } else {
      console.log(`$ npx convex-shopify generate-key ${encryptionFile}`)
      console.log('$ npx convex env set SHOPIFY_TOKEN_ENCRYPTION_KEY  # value via stdin')
      console.log('$ npx shopify app env pull --config development  # captured in a protected temporary file')
      console.log('$ npx convex env set SHOPIFY_API_SECRET          # retrieved value via stdin')
    }
  } finally {
    if (!dryRun) {
      if (existsSync(authFile)) unlinkSync(authFile)
      if (existsSync(encryptionFile)) unlinkSync(encryptionFile)
    }
  }
}

function pullShopifyApiSecret() {
  const directory = mkdtempSync(join(tmpdir(), 'shopify-convex-env-'))
  const envFile = join(directory, 'shopify.env')
  try {
    // Shopify CLI currently requires an existing env file even though `env pull`
    // documents that it creates one.
    writeFileSync(envFile, '', { mode: 0o600 })
    const result = spawnSync('npx', ['shopify', 'app', 'env', 'pull', '--config', 'development', '--env-file', envFile], {
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
    if (result.error || result.status !== 0 || !existsSync(envFile)) return null
    const rawValue = readFileSync(envFile, 'utf8').match(/^SHOPIFY_API_SECRET=(.*)$/m)?.[1]?.trim()
    if (!rawValue) return null
    return unquoteEnvValue(rawValue)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function unquoteEnvValue(value) {
  if (value.length >= 2 && value[0] === value.at(-1) && (value[0] === '"' || value[0] === "'")) {
    return value.slice(1, -1)
  }
  return value
}

function setPublicEnv(name, value) {
  if (dryRun) {
    console.log(`$ npx convex env set ${name}  # configured value omitted`)
    return
  }
  run('npx', ['convex', 'env', 'set', name, value])
}

function upsertLocalEnv(name, value) {
  if (dryRun || !existsSync('.env.local')) return
  const input = readFileSync('.env.local', 'utf8')
  const line = `${name}=${value}`
  const pattern = new RegExp(`^${name}=.*$`, 'm')
  writeFileSync('.env.local', pattern.test(input) ? input.replace(pattern, line) : `${input.replace(/\n?$/, '\n')}${line}\n`, { mode: 0o600 })
}

function firstExisting(paths) {
  return paths.find((path) => existsSync(path)) ?? null
}

function requireCommand(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' })
  if (result.status !== 0) fail(`${command} is required but was not found.`)
}

function run(command, args, options = {}) {
  const printable = [command, ...args].map(shellWord).join(' ')
  if (dryRun) {
    console.log(`$ ${printable}`)
    return
  }
  const result = spawnSync(command, args, {
    stdio: options.input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    input: options.input,
    encoding: 'utf8',
  })
  if (result.error) fail(`${printable}: ${result.error.message}`)
  if (result.status !== 0 && !options.allowFailure) fail(`Command failed (${result.status}): ${printable}`)
}

function shellWord(value) {
  return /^[A-Za-z0-9_./:@+-]+$/.test(value) ? value : JSON.stringify(value)
}

function fail(message) {
  console.error(`\nSetup error: ${message}`)
  process.exit(1)
}
