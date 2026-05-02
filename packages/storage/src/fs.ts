import { readFile, writeFile, mkdir, rm, stat, chmod } from "node:fs/promises";
import { dirname } from "node:path";

const APPEND_SAFE_BYTES = 4096;
const LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_MS = 20;
const LOCK_STALE_MS = 30_000;

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export interface WriteJsonOptions {
  /** Octal file mode applied to the file after write (e.g. 0o600). */
  mode?: number;
}

export async function writeJson(
  path: string,
  data: unknown,
  options: WriteJsonOptions = {},
): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
  if (options.mode !== undefined) {
    await chmod(path, options.mode);
  }
}

async function acquireFileLock(lockPath: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < LOCK_TIMEOUT_MS) {
    try {
      await mkdir(lockPath);
      return;
    } catch {
      // Lock exists — check if stale
      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > LOCK_STALE_MS) {
          await rm(lockPath, { recursive: true }).catch(() => {});
          continue;
        }
      } catch {
        // Lock was just released, retry
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
  throw new Error(`Failed to acquire file lock: ${lockPath}`);
}

async function releaseFileLock(lockPath: string): Promise<void> {
  await rm(lockPath, { recursive: true }).catch(() => {});
}

export async function appendLine(path: string, line: string): Promise<void> {
  await ensureDir(dirname(path));
  const data = line + "\n";

  if (Buffer.byteLength(data) <= APPEND_SAFE_BYTES) {
    await writeFile(path, data, { flag: "a" });
    return;
  }

  const lockPath = path + ".lock";
  await acquireFileLock(lockPath);
  try {
    await writeFile(path, data, { flag: "a" });
  } finally {
    await releaseFileLock(lockPath);
  }
}
