import { describe, it, expect } from "vitest";
import { sign, verify, createPrivateKey, createPublicKey } from "node:crypto";
import { generateKeystore, getPrivateKey } from "./keystore.js";

describe("crypto/keystore", () => {
  it("generateKeystore produces a base64 PKCS#8 private key and SPKI public key", () => {
    const ks = generateKeystore();
    expect(typeof ks.privateKey).toBe("string");
    expect(typeof ks.publicKey).toBe("string");
    expect(Buffer.from(ks.privateKey, "base64").length).toBeGreaterThan(0);
    expect(Buffer.from(ks.publicKey, "base64").length).toBeGreaterThan(0);
  });

  it("each generated keystore is unique", () => {
    const a = generateKeystore();
    const b = generateKeystore();
    expect(a.privateKey).not.toBe(b.privateKey);
    expect(a.publicKey).not.toBe(b.publicKey);
  });

  it("getPrivateKey returns the private key as bytes that pair with publicKey", () => {
    const ks = generateKeystore();
    const priv = getPrivateKey(ks);

    const privKeyObj = createPrivateKey({
      key: priv,
      format: "der",
      type: "pkcs8",
    });
    const pubKeyObj = createPublicKey({
      key: Buffer.from(ks.publicKey, "base64"),
      format: "der",
      type: "spki",
    });

    const message = Buffer.from("hello world");
    const signature = sign(null, message, privKeyObj);
    expect(verify(null, message, pubKeyObj, signature)).toBe(true);
  });
});
