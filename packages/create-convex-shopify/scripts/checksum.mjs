import { createHash } from 'node:crypto'
import { chmod, readFile, writeFile } from 'node:fs/promises'

const digest = createHash('sha256').update(await readFile('dist/cli.js')).digest('hex')
await writeFile('dist/cli.js.sha256', `${digest}  cli.js\n`)
await chmod('dist/cli.js', 0o755)
