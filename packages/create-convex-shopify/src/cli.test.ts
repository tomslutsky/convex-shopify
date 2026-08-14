import { describe, expect, test } from 'vitest'
import { parseArgs, rewriteTemplatePackage, slugify } from './cli.js'

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
})
