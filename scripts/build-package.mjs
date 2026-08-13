import { execFileSync } from 'node:child_process'
import { chmodSync, rmSync } from 'node:fs'
import path from 'node:path'

const packageRoot = path.resolve(import.meta.dirname, '..')
const outputDirectory = path.join(packageRoot, 'dist')

rmSync(outputDirectory, { recursive: true, force: true })
execFileSync('npm', ['exec', '--', 'tsc', '--project', './tsconfig.build.json'], {
  cwd: packageRoot,
  stdio: 'inherit',
})
chmodSync(path.join(outputDirectory, 'codegen', 'cli.js'), 0o755)
