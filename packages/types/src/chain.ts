export interface Keystore {
  publicKey: string;
  encryptedPrivateKey: string;
  iv: string;
  authTag: string;
  /** Random 32-byte AES key (base64). Self-contained — no machine state. */
  keyMaterial: string;
  createdAt: string;
}
