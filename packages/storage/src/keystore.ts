import type { Keystore } from "@devness/useai-types";
import { generateKeystore, getPrivateKey } from "@devness/useai-crypto";
import { KEYSTORE_FILE } from "./paths.js";
import { readJson, writeJson } from "./fs.js";

const KEYSTORE_FILE_MODE = 0o600;

function isValidKeystore(raw: unknown): raw is Keystore {
  if (raw === null || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o["publicKey"] === "string" && typeof o["privateKey"] === "string"
  );
}

/**
 * Load the keystore from disk, generating one if missing or in an
 * unrecognised shape (e.g. an old AES-encrypted format from a prior version).
 * The keystore is always written with mode 0600 — filesystem permissions are
 * the at-rest boundary for the private key.
 */
export async function getOrCreateKeystore(): Promise<{
  keystore: Keystore;
  privateKey: Buffer;
}> {
  const raw = await readJson<unknown>(KEYSTORE_FILE);

  if (!isValidKeystore(raw)) {
    const fresh = generateKeystore();
    await writeJson(KEYSTORE_FILE, fresh, { mode: KEYSTORE_FILE_MODE });
    return { keystore: fresh, privateKey: getPrivateKey(fresh) };
  }

  return { keystore: raw, privateKey: getPrivateKey(raw) };
}
