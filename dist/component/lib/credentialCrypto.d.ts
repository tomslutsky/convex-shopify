export type CredentialKeyring = {
    activeVersion: string;
    activeKey: Uint8Array;
    historicalKeys: ReadonlyMap<string, Uint8Array>;
};
export declare function credentialKeyring(environment?: Record<string, string | undefined>): CredentialKeyring;
export declare function encryptCredential(value: string): Promise<{
    encryptedAccessToken: string;
    tokenIv: string;
    tokenKeyVersion: string;
}>;
export declare function decryptCredential(ciphertext: string, iv: string, keyVersion: string): Promise<string>;
//# sourceMappingURL=credentialCrypto.d.ts.map