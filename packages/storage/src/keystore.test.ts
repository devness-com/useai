import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Storage tests for getOrCreateKeystore.
 *
 * KEYSTORE_FILE is computed from homedir() at import time, so we mock the
 * paths module to point it at a fresh tmp file per test (same vi.hoisted
 * pattern as sessions.test.ts).
 */

const fixture = vi.hoisted(() => {
  return {
    dir: "" as string,
    keystoreFile: "" as string,
  };
});

vi.mock("./paths.js", async () => {
  const actual = await vi.importActual<typeof import("./paths.js")>(
    "./paths.js",
  );
  return {
    ...actual,
    get KEYSTORE_FILE() {
      return fixture.keystoreFile;
    },
  };
});

import { getOrCreateKeystore } from "./keystore.js";

describe("storage/keystore getOrCreateKeystore", () => {
  beforeEach(async () => {
    fixture.dir = await mkdtemp(join(tmpdir(), "useai-keystore-"));
    fixture.keystoreFile = join(fixture.dir, "keystore.json");
  });

  afterEach(async () => {
    if (fixture.dir) {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });

  it("creates a fresh keystore when the file is missing", async () => {
    const { keystore, privateKey } = await getOrCreateKeystore();

    expect(keystore.publicKey).toBeTruthy();
    expect(keystore.privateKey).toBeTruthy();
    expect(privateKey.length).toBeGreaterThan(0);

    const onDisk = JSON.parse(await readFile(fixture.keystoreFile, "utf-8"));
    expect(onDisk.publicKey).toBe(keystore.publicKey);
    expect(onDisk.privateKey).toBe(keystore.privateKey);
  });

  it("returns the same keystore on a second call (no regeneration)", async () => {
    const first = await getOrCreateKeystore();
    const second = await getOrCreateKeystore();

    expect(second.keystore.publicKey).toBe(first.keystore.publicKey);
    expect(second.keystore.privateKey).toBe(first.keystore.privateKey);
    expect(second.privateKey.equals(first.privateKey)).toBe(true);
  });

  it("regenerates when the file has the legacy AES-encrypted shape", async () => {
    // Mirrors the historical hostname-bound keystore format from before this
    // change. It lacks the `privateKey` field, so the loader treats it as
    // invalid and writes a fresh plaintext keystore in its place.
    const legacy = {
      publicKey: "MCowBQYDK2VwAyEA" + "A".repeat(28),
      encryptedPrivateKey: "deadbeef",
      iv: "AAAAAAAAAAAAAAAA",
      authTag: "BBBBBBBBBBBBBBBB",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    await writeFile(fixture.keystoreFile, JSON.stringify(legacy));

    const { keystore, privateKey } = await getOrCreateKeystore();

    expect(keystore.privateKey).toBeTruthy();
    expect(keystore.publicKey).not.toBe(legacy.publicKey);
    expect(privateKey.length).toBeGreaterThan(0);

    const onDisk = JSON.parse(await readFile(fixture.keystoreFile, "utf-8"));
    expect(onDisk.privateKey).toBe(keystore.privateKey);
    expect(onDisk).not.toHaveProperty("encryptedPrivateKey");
  });

  it("regenerates when the file is malformed JSON", async () => {
    await writeFile(fixture.keystoreFile, "{ not json");
    const { keystore } = await getOrCreateKeystore();
    expect(keystore.privateKey).toBeTruthy();
  });

  it("regenerates when required fields are missing", async () => {
    await writeFile(
      fixture.keystoreFile,
      JSON.stringify({ publicKey: "x" }),
    );
    const { keystore } = await getOrCreateKeystore();
    expect(keystore.privateKey).toBeTruthy();
  });

  it("writes the keystore file with mode 0600", async () => {
    await getOrCreateKeystore();
    const info = await stat(fixture.keystoreFile);
    expect(info.mode & 0o777).toBe(0o600);
  });

  it("the returned privateKey signs data verifiable against keystore.publicKey", async () => {
    const { keystore, privateKey } = await getOrCreateKeystore();

    const { sign, verify, createPrivateKey, createPublicKey } = await import(
      "node:crypto"
    );
    const privKeyObj = createPrivateKey({
      key: privateKey,
      format: "der",
      type: "pkcs8",
    });
    const pubKeyObj = createPublicKey({
      key: Buffer.from(keystore.publicKey, "base64"),
      format: "der",
      type: "spki",
    });

    const message = Buffer.from("hello world");
    const signature = sign(null, message, privKeyObj);
    expect(verify(null, message, pubKeyObj, signature)).toBe(true);
  });
});
