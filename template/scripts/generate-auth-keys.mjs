import { chmod, open } from 'node:fs/promises'
import { exportJWK, generateKeyPair } from 'jose'

const outputPath = process.argv[2] ?? '.env.auth-keys.local'
const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
const privateJwk = { ...(await exportJWK(privateKey)), kid: 'app-auth-1', use: 'sig', alg: 'ES256' }
const publicJwk = { ...(await exportJWK(publicKey)), kid: 'app-auth-1', use: 'sig', alg: 'ES256' }
const file = await open(outputPath, 'wx', 0o600)
try {
  await file.writeFile(`APP_AUTH_PRIVATE_JWK=${JSON.stringify(privateJwk)}\nAPP_AUTH_PUBLIC_JWK=${JSON.stringify(publicJwk)}\n`)
} finally {
  await file.close()
}
await chmod(outputPath, 0o600)
process.stdout.write(`Wrote an untracked 0600 key file to ${outputPath}. The private key was not printed.\n`)
process.stdout.write(`Apply it with: npx convex env set --from-file ${outputPath}\n`)
