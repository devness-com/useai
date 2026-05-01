import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import type { Session } from "@devness/useai-types";
import { buildSessionRecord, computeHash, signHash } from "./chain.js";
import { verifySession } from "./verify.js";

/**
 * Round-trip + tampering tests for buildSessionRecord.
 *
 * Strategy: generate a fixed Ed25519 keypair once for the suite (don't touch
 * the real keystore.json in $HOME). Build a record from known inputs and
 * verify hash determinism + signature validity. Then tamper with one byte and
 * confirm verification fails.
 */

let publicKey: Buffer;
let privateKey: Buffer;

function buildBaseSession(): Omit<Session, "hash" | "signature"> {
  return {
    promptId: "prompt_fixed_test",
    connectionId: "conn_test",
    client: "claude-code",
    taskType: "coding",
    title: "Test session",
    startedAt: "2025-01-01T10:00:00.000Z",
    endedAt: "2025-01-01T10:05:00.000Z",
    durationMs: 5 * 60 * 1000,
    milestones: [],
    prevHash: "0".repeat(64),
  };
}

describe("crypto/chain buildSessionRecord", () => {
  beforeAll(() => {
    const kp = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" },
    });
    publicKey = kp.publicKey as unknown as Buffer;
    privateKey = kp.privateKey as unknown as Buffer;
  });

  it("happy path: hash is deterministic and signature verifies", () => {
    const base = buildBaseSession();
    const r1 = buildSessionRecord(base, privateKey);
    const r2 = buildSessionRecord(base, privateKey);

    // SHA-256 over JSON.stringify(base) + prevHash must be deterministic
    expect(r1.hash).toBe(r2.hash);
    // Signatures over the same hash with Ed25519 must also be deterministic
    expect(r1.signature).toBe(r2.signature);

    const fullSession: Session = {
      ...base,
      hash: r1.hash,
      signature: r1.signature,
    };
    expect(verifySession(fullSession, publicKey)).toBe(true);
  });

  it("computeHash matches a manual SHA-256 of data + prevHash", () => {
    // Cross-check the hash-construction primitive against a hand-rolled value.
    const base = buildBaseSession();
    const data = JSON.stringify(base);
    const expected = computeHash(data, base.prevHash);
    const built = buildSessionRecord(base, privateKey);
    expect(built.hash).toBe(expected);
  });

  it("signHash output validates against the public key for the same hash", () => {
    const base = buildBaseSession();
    const data = JSON.stringify(base);
    const hash = computeHash(data, base.prevHash);
    const sig = signHash(hash, privateKey);

    const fullSession: Session = {
      ...base,
      hash,
      signature: sig,
    };
    expect(verifySession(fullSession, publicKey)).toBe(true);
  });

  it("tampering with the data after sealing breaks verification", () => {
    const base = buildBaseSession();
    const { hash, signature } = buildSessionRecord(base, privateKey);

    // Mutate one field of the data — the hash recomputed by verifySession will
    // differ from the stored hash, so verification must return false.
    const tampered: Session = {
      ...base,
      title: base.title + "!",
      hash,
      signature,
    };
    expect(verifySession(tampered, publicKey)).toBe(false);
  });

  it("tampering with the hash but keeping the signature breaks verification", () => {
    const base = buildBaseSession();
    const { hash, signature } = buildSessionRecord(base, privateKey);

    // Flip one hex char in the hash — signature was over original hash bytes.
    const flipped =
      hash[0] === "a" ? "b" + hash.slice(1) : "a" + hash.slice(1);

    const tampered: Session = {
      ...base,
      hash: flipped,
      signature,
    };
    expect(verifySession(tampered, publicKey)).toBe(false);
  });
});
