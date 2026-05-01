import type { Keystore } from "@devness/useai-types";
import { generateKeystore, decryptKeystore } from "@devness/useai-crypto";
import { KEYSTORE_FILE } from "./paths.js";
import { readJson, writeJson } from "./fs.js";

const KEYSTORE_FILE_MODE = 0o600;

function isValidKeystore(raw: unknown): raw is Keystore {
  if (raw === null || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o["publicKey"] === "string" &&
    typeof o["encryptedPrivateKey"] === "string" &&
    typeof o["iv"] === "string" &&
    typeof o["authTag"] === "string" &&
    typeof o["keyMaterial"] === "string"
  );
}

export async function getOrCreateKeystore(): Promise<{
  keystore: Keystore;
  privateKey: Buffer;
}> {
  const raw = await readJson<unknown>(KEYSTORE_FILE);

  if (!isValidKeystore(raw)) {
    const fresh = generateKeystore();
    await writeJson(KEYSTORE_FILE, fresh, { mode: KEYSTORE_FILE_MODE });
    return { keystore: fresh, privateKey: decryptKeystore(fresh) };
  }

  return { keystore: raw, privateKey: decryptKeystore(raw) };
}
