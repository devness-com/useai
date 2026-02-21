import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { USEAI_DIR, DATA_DIR, ACTIVE_DIR, SEALED_DIR } from '../constants/paths.js';

export function ensureDir(): void {
  for (const dir of [USEAI_DIR, DATA_DIR, ACTIVE_DIR, SEALED_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function readJson<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(path: string, data: unknown): void {
  ensureDir();
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, path);
}
