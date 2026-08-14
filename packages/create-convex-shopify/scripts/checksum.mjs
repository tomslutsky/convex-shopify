import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const digest = createHash('sha256').update(await readFile('dist/cli.js')).digest('hex')
await writeFile('dist/cli.js.sha256', `${digest}  cli.js\n`)
