export interface Keystore {
  publicKey: string;
  /**
   * Ed25519 private key, base64-encoded PKCS#8 DER. Stored plaintext on disk;
   * filesystem permissions (0600) are the at-rest boundary. The keypair's
   * purpose is signature-based tamper evidence on sealed sessions, not
   * confidentiality of the key itself.
   */
  privateKey: string;
  createdAt: string;
}
