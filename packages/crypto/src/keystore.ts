import { generateKeyPairSync } from "node:crypto";
import type { Keystore } from "@devness/useai-types";

/**
 * Generate a new Ed25519 keypair. The private key is stored plaintext (base64
 * PKCS#8 DER) in the keystore. Filesystem permissions on the keystore file
 * (0600) are the at-rest boundary — there is no AES layer because any local
 * process running as the user that needs the key (i.e. the MCP daemon itself)
 * has to be able to read it, so an "encryption" key colocated with the
 * ciphertext would not add any real protection.
 *
 * The role of the keypair is signature-based tamper evidence: every sealed
 * session is signed at write time, and any post-hoc edit to the JSONL records
 * invalidates the signature on read.
 */
export function generateKeystore(): Keystore {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  return {
    publicKey: publicKey.toString("base64"),
    privateKey: privateKey.toString("base64"),
    createdAt: new Date().toISOString(),
  };
}

export function getPrivateKey(keystore: Keystore): Buffer {
  return Buffer.from(keystore.privateKey, "base64");
}
