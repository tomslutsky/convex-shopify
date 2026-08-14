#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { cpSync, createReadStream, createWriteStream, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline/promises'
import process from 'node:process'

const REPOSITORY = 'tomslutsky/convex-shopify'
type Options = {
  name?: string
  directory?: string
  templateRef: string
  yes: boolean
  install: boolean
  setup: boolean
  dryRun: boolean
  help: boolean
}

export function parseArgs(argv: Array<string>): Options {
  const options: Options = { templateRef: 'main', yes: false, install: true, setup: true, dryRun: false, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = () => {
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) throw new Error(`${flag} requires a value`)
      index += 1
      return next
    }
    if (flag === '--name') options.name = value()
    else if (flag === '--directory') options.directory = value()
    else if (flag === '--template-ref') options.templateRef = value()
    else if (flag === '--yes') options.yes = true
    else if (flag === '--no-install') options.install = false
    else if (flag === '--no-setup') options.setup = false
    else if (flag === '--dry-run') options.dryRun = true
    else if (flag === '--help' || flag === '-h') options.help = true
    else throw new Error(`Unknown option: ${flag}`)
  }
  return options
}

export function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-')
  if (!slug) throw new Error('The app name must contain a letter or number.')
  return slug
}

export function rewriteTemplatePackage(input: string, appName: string, resolvedRef: string): string {
  const packageJson = JSON.parse(input) as { name: string; dependencies?: Record<string, string> }
  if (!packageJson.dependencies?.['@convex-dev/shopify']) throw new Error('Template package is missing @convex-dev/shopify')
  packageJson.name = appName
  packageJson.dependencies['@convex-dev/shopify'] = `git+https://github.com/${REPOSITORY}.git#${resolvedRef}`
  return `${JSON.stringify(packageJson, null, 2)}\n`
}

function usage() {
  return `Create a Shopify + Convex app from the public ${REPOSITORY} monorepo.

Usage:
  npm create convex-shopify@latest
  create-convex-shopify [options]

Options:
  --name NAME          set the package/app name
  --directory PATH     set the target directory
  --template-ref REF   use another public tag, branch, or immutable commit
  --yes                accept setup-step defaults
  --no-install         skip npm install
  --no-setup           skip the Shopify/Convex setup wizard
  --dry-run            print resolved actions without changing files
  --help               show this help`
}

function run(command: string, args: Array<string>, cwd?: string, capture = false) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed${capture && result.stderr ? `: ${result.stderr.trim()}` : ''}`)
  return result.stdout?.trim() ?? ''
}

function resolveRef(templateRef: string): string {
  if (/^[0-9a-f]{40}$/.test(templateRef)) return templateRef
  const remote = `https://github.com/${REPOSITORY}.git`
  for (const candidate of [`refs/heads/${templateRef}`, `refs/tags/${templateRef}^{}`, `refs/tags/${templateRef}`]) {
    const output = run('git', ['ls-remote', remote, candidate], undefined, true)
    const sha = output.split(/\s+/)[0]
    if (/^[0-9a-f]{40}$/.test(sha)) return sha
  }
  throw new Error(`Could not resolve public template ref: ${templateRef}`)
}

async function download(url: string, destination: string) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`Template download failed (${response.status})`)
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()), { mode: 0o600 })
}

async function promptForName(defaultValue: string) {
  const useControllingTerminal = !process.stdin.isTTY && existsSync('/dev/tty')
  if (!process.stdin.isTTY && !useControllingTerminal) throw new Error('Interactive input requires a terminal. Pass --name and --yes for automation.')
  const input = useControllingTerminal ? createReadStream('/dev/tty') : process.stdin
  const output = useControllingTerminal ? createWriteStream('/dev/tty') : process.stdout
  const readline = createInterface({ input, output })
  try {
    return (await readline.question(`App name [${defaultValue}]: `)).trim() || defaultValue
  } finally {
    readline.close()
    if (useControllingTerminal) {
      input.destroy()
      output.end()
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    return
  }
  const appName = slugify(options.name ?? (options.yes ? 'my-shopify-app' : await promptForName('my-shopify-app')))
  const target = resolve(options.directory ?? appName)
  if (existsSync(target)) throw new Error(`Refusing to overwrite existing path: ${target}`)
  const archiveOverride = process.env.CREATE_CONVEX_SHOPIFY_TEST_ARCHIVE
  const resolvedRef = options.dryRun
    ? options.templateRef
    : archiveOverride
      ? process.env.CREATE_CONVEX_SHOPIFY_TEST_REF ?? '0000000000000000000000000000000000000000'
      : resolveRef(options.templateRef)
  if (!options.dryRun && !/^[0-9a-f]{40}$/.test(resolvedRef)) throw new Error('Resolved template ref must be a full commit SHA')

  process.stdout.write(`\nCreate Convex Shopify\n\n  App:      ${appName}\n  Target:   ${target}\n  Template: ${REPOSITORY}@${resolvedRef}\n\n`)
  if (options.dryRun) {
    process.stdout.write(`Would extract only template/ from the public monorepo, initialize Git,${options.install ? '' : ' not'} install dependencies${options.setup ? ', and launch setup' : ''}.\n`)
    return
  }

  const temporary = mkdtempSync(join(tmpdir(), 'create-convex-shopify-'))
  let createdTarget = false
  try {
    const archive = join(temporary, 'repository.tar.gz')
    const extracted = join(temporary, 'repository')
    mkdirSync(extracted)
    if (archiveOverride) cpSync(archiveOverride, archive)
    else await download(`https://github.com/${REPOSITORY}/archive/${resolvedRef}.tar.gz`, archive)
    run('tar', ['-xzf', archive, '-C', extracted])
    const archiveRoot = readdirSync(extracted, { withFileTypes: true }).find((entry) => entry.isDirectory())
    if (!archiveRoot) throw new Error('Downloaded archive is empty')
    const template = join(extracted, archiveRoot.name, 'template')
    if (!existsSync(join(template, 'package.json'))) throw new Error('Downloaded monorepo does not contain template/package.json')

    mkdirSync(target, { recursive: false })
    createdTarget = true
    cpSync(template, target, { recursive: true })
    const packagePath = join(target, 'package.json')
    writeFileSync(packagePath, rewriteTemplatePackage(readFileSync(packagePath, 'utf8'), appName, resolvedRef))
    run('git', ['init', '-q', '-b', 'main'], target)
    if (options.install) run('npm', ['install'], target)
    if (options.setup && options.install) run('npm', ['run', 'setup', '--', ...(options.yes ? ['--yes'] : [])], target)
    else if (options.setup) process.stdout.write('Skipping setup because dependencies were not installed. Run npm install && npm run setup later.\n')
  } catch (error) {
    if (createdTarget) rmSync(target, { recursive: true, force: true })
    throw error
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
  process.stdout.write(`\nCreated ${basename(target)}.\n\nNext time:\n  cd ${JSON.stringify(target)}\n  npm run setup\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`\nSetup error: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
