import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function runGenerateKey(output = '.shopify-token-encryption-key') {
    const key = randomBytes(32).toString('base64');
    const outputPath = resolve(output);
    writeFileSync(outputPath, `${key}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    console.log(`Wrote a new encryption key to ${outputPath} with owner-only permissions.`);
    console.log('Copy it into the interactive SHOPIFY_TOKEN_ENCRYPTION_KEY prompt, then securely delete the file.');
    console.log('SHOPIFY_TOKEN_ENCRYPTION_KEYS holds the JSON rotation map,');
    console.log('e.g. { "v1": "<key>", ... }; SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION');
    console.log('names the active key version.');
}
//# sourceMappingURL=generate-key.js.map