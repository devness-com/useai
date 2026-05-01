import {
  generateKeyPairSync,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import type { Keystore } from "@devness/useai-types";

export function generateKeystore(): Keystore {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  const keyMaterial = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);

  return {
    publicKey: publicKey.toString("base64"),
    encryptedPrivateKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyMaterial: keyMaterial.toString("base64"),
    createdAt: new Date().toISOString(),
  };
}

export function decryptKeystore(keystore: Keystore): Buffer {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keystore.keyMaterial, "base64"),
    Buffer.from(keystore.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(keystore.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(keystore.encryptedPrivateKey, "base64")),
    decipher.final(),
  ]);
}
