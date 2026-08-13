import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const packageRoot = path.resolve(import.meta.dirname, '..')
const componentDirectory = path.join(packageRoot, 'component')

let projectRoot = packageRoot
while (
  !existsSync(path.join(projectRoot, '.env.local')) &&
  !existsSync(path.join(projectRoot, 'convex.json'))
) {
  const parent = path.dirname(projectRoot)
  if (parent === projectRoot) break
  projectRoot = parent
}

const generatedFiles = ['api.ts', 'component.ts', 'dataModel.ts', 'server.ts']
  .map((file) => path.join(componentDirectory, '_generated', file))

if (!process.env.CONVEX_DEPLOYMENT) {
  for (const file of generatedFiles) {
    if (!existsSync(file) || readFileSync(file, 'utf8').length === 0) {
      throw new Error(`Missing committed Convex component codegen artifact: ${file}`)
    }
  }
  console.log('Using committed Convex component codegen artifacts (no deployment configured).')
  process.exit(0)
}

const result = spawnSync(
  'npx',
  ['convex', 'codegen', '--component-dir', componentDirectory],
  { cwd: projectRoot, stdio: 'inherit' },
)

if (result.error) throw result.error
process.exitCode = result.status ?? 1
