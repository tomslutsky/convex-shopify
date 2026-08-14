import { readFile, writeFile } from 'node:fs/promises'

const configuration = process.argv[2] ?? 'development'
const targetPath = `shopify.app.${configuration}.toml`
const base = await readFile('shopify.app.toml', 'utf8')
let target = await readFile(targetPath, 'utf8')

for (const sectionName of ['access_scopes', 'webhooks']) {
  const sourceSection = section(base, sectionName)
  if (!sourceSection) throw new Error(`Missing [${sectionName}] in shopify.app.toml`)
  const pattern = sectionPattern(sectionName)
  if (pattern.test(target)) target = target.replace(pattern, `${sourceSection}\n\n`)
  else target = `${target.trimEnd()}\n\n${sourceSection}`
}

await writeFile(targetPath, `${target.trimEnd()}\n`)
process.stdout.write(`Synchronized scopes and webhooks into ${targetPath}.\n`)

function section(input, name) {
  return input.match(sectionPattern(name))?.[0]?.trimEnd() ?? null
}

function sectionPattern(name) {
  return new RegExp(`^\\[${name}\\][\\s\\S]*?(?=^\\[(?!\\[)|(?![\\s\\S]))`, 'm')
}
