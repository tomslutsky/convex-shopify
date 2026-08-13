import { env } from '../_generated/server';
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
function bytesToBase64(bytes) {
    let binary = '';
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary);
}
function decodeKey(name, value) {
    if (!BASE64_PATTERN.test(value) || value.length === 0)
        throw new Error(`${name} must be valid base64`);
    let bytes;
    try {
        bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    }
    catch {
        throw new Error(`${name} must be valid base64`);
    }
    if (bytes.byteLength !== 32)
        throw new Error(`${name} must decode to exactly 32 bytes for AES-256-GCM`);
    return bytes;
}
function decodeCiphertext(name, value) {
    if (!BASE64_PATTERN.test(value) || value.length === 0)
        throw new Error(`${name} is not valid base64`);
    try {
        return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    }
    catch {
        throw new Error(`${name} is not valid base64`);
    }
}
export function credentialKeyring(environment = {
    SHOPIFY_TOKEN_ENCRYPTION_KEY: env.SHOPIFY_TOKEN_ENCRYPTION_KEY,
    SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION: env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION,
    SHOPIFY_TOKEN_ENCRYPTION_KEYS: env.SHOPIFY_TOKEN_ENCRYPTION_KEYS,
}) {
    const activeEncoded = environment.SHOPIFY_TOKEN_ENCRYPTION_KEY;
    const activeVersion = environment.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION?.trim();
    if (!activeEncoded)
        throw new Error('SHOPIFY_TOKEN_ENCRYPTION_KEY is not configured (expected a base64-encoded 32-byte active key)');
    if (!activeVersion)
        throw new Error('SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION is not configured (expected the active key version name)');
    const historicalKeys = new Map();
    const serialized = environment.SHOPIFY_TOKEN_ENCRYPTION_KEYS;
    if (serialized) {
        let parsed;
        try {
            parsed = JSON.parse(serialized);
        }
        catch {
            throw new Error('SHOPIFY_TOKEN_ENCRYPTION_KEYS must be a JSON object mapping previous key versions to base64 keys');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('SHOPIFY_TOKEN_ENCRYPTION_KEYS must be a JSON object mapping previous key versions to base64 keys');
        for (const [rawVersion, value] of Object.entries(parsed)) {
            const version = rawVersion.trim();
            if (!version || version !== rawVersion || typeof value !== 'string')
                throw new Error('SHOPIFY_TOKEN_ENCRYPTION_KEYS contains an invalid version-to-key entry');
            if (version === activeVersion)
                throw new Error(`SHOPIFY_TOKEN_ENCRYPTION_KEYS must not contain active key version "${activeVersion}"; remove the conflicting historical entry`);
            historicalKeys.set(version, decodeKey(`SHOPIFY_TOKEN_ENCRYPTION_KEYS[${JSON.stringify(version)}]`, value));
        }
    }
    return { activeVersion, activeKey: decodeKey('SHOPIFY_TOKEN_ENCRYPTION_KEY', activeEncoded), historicalKeys };
}
async function importEncryptionKey(raw) {
    return crypto.subtle.importKey('raw', raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
function keyForDecryption(keyring, version) {
    if (version === keyring.activeVersion)
        return keyring.activeKey;
    const historical = keyring.historicalKeys.get(version);
    if (!historical)
        throw new Error(`Shopify credential encryption key version "${version}" is not configured; add it to SHOPIFY_TOKEN_ENCRYPTION_KEYS`);
    return historical;
}
export async function encryptCredential(value) {
    const keyring = credentialKeyring();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer }, await importEncryptionKey(keyring.activeKey), new TextEncoder().encode(value));
    return { encryptedAccessToken: bytesToBase64(new Uint8Array(ciphertext)), tokenIv: bytesToBase64(iv), tokenKeyVersion: keyring.activeVersion };
}
export async function decryptCredential(ciphertext, iv, keyVersion) {
    const keyring = credentialKeyring();
    try {
        const ivBytes = decodeCiphertext('Shopify credential IV', iv);
        if (ivBytes.byteLength !== 12)
            throw new Error('Shopify credential IV must contain exactly 12 bytes');
        const encryptedBytes = decodeCiphertext('Shopify credential ciphertext', ciphertext);
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes.buffer.slice(ivBytes.byteOffset, ivBytes.byteOffset + ivBytes.byteLength) }, await importEncryptionKey(keyForDecryption(keyring, keyVersion)), encryptedBytes.buffer.slice(encryptedBytes.byteOffset, encryptedBytes.byteOffset + encryptedBytes.byteLength));
        return new TextDecoder().decode(plaintext);
    }
    catch (error) {
        if (error instanceof Error && (error.message.includes('not configured') || error.message.includes('SHOPIFY_TOKEN_ENCRYPTION')))
            throw error;
        throw new Error(`Shopify credential ciphertext could not be decrypted with key version "${keyVersion}"`);
    }
}
//# sourceMappingURL=credentialCrypto.js.map