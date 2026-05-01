import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { generateKeystore, decryptKeystore } from "./keystore.js";

describe("crypto/keystore", () => {
  it("round-trips: decrypts to a non-empty private key", () => {
    const ks = generateKeystore();
    const pk = decryptKeystore(ks);
    expect(pk.length).toBeGreaterThan(0);
  });

  it("each generated keystore has a unique random keyMaterial", () => {
    const a = generateKeystore();
    const b = generateKeystore();
    expect(Buffer.from(a.keyMaterial, "base64")).toHaveLength(32);
    expect(a.keyMaterial).not.toBe(b.keyMaterial);
    expect(a.iv).not.toBe(b.iv);
  });

  it("decryption fails when keyMaterial is tampered", () => {
    const ks = generateKeystore();
    const tampered = { ...ks, keyMaterial: randomBytes(32).toString("base64") };
    expect(() => decryptKeystore(tampered)).toThrow();
  });

  it("decryption fails when ciphertext is tampered", () => {
    const ks = generateKeystore();
    const buf = Buffer.from(ks.encryptedPrivateKey, "base64");
    buf[0] = buf[0] ^ 0xff;
    const tampered = { ...ks, encryptedPrivateKey: buf.toString("base64") };
    expect(() => decryptKeystore(tampered)).toThrow();
  });
});
