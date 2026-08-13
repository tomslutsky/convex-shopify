// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { runGenerateKey } from '../codegen/generate-key.js'

let temporaryDirectory: string | null = null

afterEach(() => {
  vi.restoreAllMocks()
  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { recursive: true, force: true })
    temporaryDirectory = null
  }
})

test('writes a private key file without logging the key', () => {
  temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'convex-shopify-key-'))
  const output = path.join(temporaryDirectory, 'key')
  const logged: Array<string> = []
  vi.spyOn(console, 'log').mockImplementation((message) => logged.push(String(message)))

  runGenerateKey(output)

  const key = readFileSync(output, 'utf8').trim()
  expect(Buffer.from(key, 'base64')).toHaveLength(32)
  expect(statSync(output).mode & 0o777).toBe(0o600)
  expect(logged.join('\n')).not.toContain(key)
  expect(() => runGenerateKey(output)).toThrow()
})

