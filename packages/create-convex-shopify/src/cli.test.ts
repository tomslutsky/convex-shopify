import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { main, parseArgs, rewriteTemplatePackage, slugify } from './cli.js'

const temporaryDirectories: Array<string> = []

afterEach(() => {
  delete process.env.CREATE_CONVEX_SHOPIFY_TEST_ARCHIVE
  delete process.env.CREATE_CONVEX_SHOPIFY_TEST_REF
  delete process.env.CREATE_CONVEX_SHOPIFY_TEST_FAIL_AFTER_SCAFFOLD
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function fixtureArchive(kind: 'valid' | 'missing-dependency' = 'valid') {
  const temporary = mkdtempSync(join(tmpdir(), 'create-convex-shopify-test-'))
  temporaryDirectories.push(temporary)
  const template = join(temporary, 'fixture-repository', 'template')
  mkdirSync(template, { recursive: true })
  writeFileSync(join(template, 'package.json'), JSON.stringify({
    name: 'template',
    dependencies: kind === 'valid' ? { '@convex-dev/shopify': 'file:..' } : {},
  }))
  writeFileSync(join(template, 'marker.txt'), 'copied')
  const archive = join(temporary, 'fixture.tar.gz')
  const result = spawnSync('tar', ['-czf', archive, '-C', temporary, 'fixture-repository'])
  if (result.status !== 0) throw new Error('Could not create initializer fixture')
  return { temporary, archive }
}

describe('initializer inputs', () => {
  test('normalizes app names without allowing an empty result', () => {
    expect(slugify(' My Shopify App ')).toBe('my-shopify-app')
    expect(() => slugify('!!!')).toThrow('letter or number')
  })

  test('parses automation flags and rejects unknown options', () => {
    expect(parseArgs(['--name', 'Demo', '--directory', 'apps/demo', '--template-ref', 'main', '--yes', '--no-setup'])).toMatchObject({
      name: 'Demo', directory: 'apps/demo', templateRef: 'main', yes: true, setup: false,
    })
    expect(() => parseArgs(['--wat'])).toThrow('Unknown option')
  })

  test('compiled CLI executes when invoked through a symlinked temporary path', () => {
    const result = spawnSync(process.execPath, [join(import.meta.dirname, '..', 'dist', 'cli.js'), '--name', 'Executable Check', '--directory', '/tmp/unused-executable-check', '--yes', '--no-install', '--no-setup', '--dry-run'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('App:      executable-check')
  })

  test('rewrites only the standalone package identity and component dependency', () => {
    const input = JSON.stringify({ name: 'shopify-convex-template', dependencies: { '@convex-dev/shopify': 'file:..', convex: '^1.43.0' } })
    const result = JSON.parse(rewriteTemplatePackage(input, 'demo', 'abc123'))
    expect(result).toEqual({
      name: 'demo',
      dependencies: {
        '@convex-dev/shopify': 'git+https://github.com/tomslutsky/convex-shopify.git#abc123',
        convex: '^1.43.0',
      },
    })
  })

  test('extracts a monorepo template, pins its dependency, and initializes Git', async () => {
    const { temporary, archive } = fixtureArchive()
    const target = join(temporary, 'generated-app')
    process.env.CREATE_CONVEX_SHOPIFY_TEST_ARCHIVE = archive
    process.env.CREATE_CONVEX_SHOPIFY_TEST_REF = 'a'.repeat(40)
    await main(['--name', 'Generated App', '--directory', target, '--yes', '--no-install', '--no-setup'])

    const packageJson = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
    expect(packageJson.name).toBe('generated-app')
    expect(packageJson.dependencies['@convex-dev/shopify']).toBe(`git+https://github.com/tomslutsky/convex-shopify.git#${'a'.repeat(40)}`)
    expect(readFileSync(join(target, 'marker.txt'), 'utf8')).toBe('copied')
    expect(existsSync(join(target, '.git'))).toBe(true)
  })

  test('removes a partially created target when the archive is invalid', async () => {
    const { temporary, archive } = fixtureArchive('missing-dependency')
    const target = join(temporary, 'failed-app')
    process.env.CREATE_CONVEX_SHOPIFY_TEST_ARCHIVE = archive
    process.env.CREATE_CONVEX_SHOPIFY_TEST_REF = 'b'.repeat(40)
    await expect(main(['--name', 'Failed App', '--directory', target, '--yes', '--no-install', '--no-setup'])).rejects.toThrow('missing @convex-dev/shopify')
    expect(existsSync(target)).toBe(false)
  })

  test('preserves a resumable app when installation or setup fails', async () => {
    const { temporary, archive } = fixtureArchive()
    const target = join(temporary, 'resumable-app')
    process.env.CREATE_CONVEX_SHOPIFY_TEST_ARCHIVE = archive
    process.env.CREATE_CONVEX_SHOPIFY_TEST_REF = 'c'.repeat(40)
    process.env.CREATE_CONVEX_SHOPIFY_TEST_FAIL_AFTER_SCAFFOLD = '1'
    await expect(main(['--name', 'Resumable App', '--directory', target, '--yes', '--no-install', '--no-setup'])).rejects.toThrow('post-scaffold failure')
    expect(existsSync(join(target, 'package.json'))).toBe(true)
    expect(existsSync(join(target, '.git'))).toBe(true)
  })
})
