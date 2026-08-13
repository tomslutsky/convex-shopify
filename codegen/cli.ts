#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { runGenerateKey } from './generate-key.js'
import { runInit } from './init.js'

function main(): void {
  const command = process.argv[2]
  switch (command) {
    case 'init':
      runInit()
      return
    case 'codegen':
      runCodegen(process.argv.slice(3).includes('--watch'))
      return
    case 'generate-key':
      runGenerateKey(process.argv[3])
      return
    default:
      console.error(
        'usage: convex-shopify <init | codegen [--watch] | generate-key [output-file]>',
      )
      process.exitCode = 1
  }
}

function runCodegen(watch: boolean): void {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execFileSync(
    npm,
    [
      'exec',
      '--',
      'graphql-codegen',
      '--config',
      '.graphqlrc.ts',
      ...(watch ? ['--watch'] : []),
    ],
    { stdio: 'inherit' },
  )
}

try {
  main()
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
