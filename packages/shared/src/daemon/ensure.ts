import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import { DAEMON_PID_FILE, DAEMON_PORT, DAEMON_HEALTH_URL } from '../constants/paths.js';
import { VERSION } from '../constants/version.js';
import { resolveNpxPath } from './resolve-npx.js';

export interface PidFileData {
  pid: number;
  port: number;
  started_at: string;
}

/** Read and parse the daemon PID file. Returns null if missing or invalid. */
export function readPidFile(): PidFileData | null {
  if (!existsSync(DAEMON_PID_FILE)) return null;
  try {
    const raw = readFileSync(DAEMON_PID_FILE, 'utf-8').trim();
    return JSON.parse(raw) as PidFileData;
  } catch {
    return null;
  }
}

/** Check whether a process with the given PID is alive. */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Fetch the daemon /health endpoint. Returns true if 200 OK. */
export async function checkDaemonHealth(): Promise<boolean> {
  try {
    const res = await fetch(DAEMON_HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch health details from the daemon. Returns the JSON body or null. */
export async function fetchDaemonHealth(port?: number): Promise<Record<string, unknown> | null> {
  try {
    const url = port ? `http://127.0.0.1:${port}/health` : DAEMON_HEALTH_URL;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) return (await res.json()) as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

/** Find PIDs listening on a given port using lsof (macOS/Linux). */
export function findPidsByPort(port: number): number[] {
  try {
    const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8', timeout: 3000 });
    return output
      .trim()
      .split('\n')
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n) && n > 0);
  } catch {
    return [];
  }
}

/** Kill a specific PID with SIGTERM, then SIGKILL after 5s if needed. */
async function killPid(pid: number): Promise<void> {
  if (!isProcessRunning(pid)) return;

  try { process.kill(pid, 'SIGTERM'); } catch { return; }

  const start = Date.now();
  while (Date.now() - start < 5000) {
    if (!isProcessRunning(pid)) return;
    await new Promise((r) => setTimeout(r, 200));
  }

  try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
}

/** Stop the daemon. Uses PID file first, falls back to port-based discovery. */
export async function killDaemon(): Promise<void> {
  const pidData = readPidFile();
  const port = pidData?.port ?? DAEMON_PORT;

  // Try PID file first
  if (pidData && isProcessRunning(pidData.pid)) {
    await killPid(pidData.pid);
    try { if (existsSync(DAEMON_PID_FILE)) unlinkSync(DAEMON_PID_FILE); } catch { /* ignore */ }
    return;
  }

  // Stale or missing PID file — clean it up
  if (pidData) {
    try { unlinkSync(DAEMON_PID_FILE); } catch { /* ignore */ }
  }

  // Fallback: find and kill whatever is listening on the daemon port
  const pids = findPidsByPort(port);
  if (pids.length > 0) {
    await Promise.all(pids.map((p) => killPid(p)));
  }

  try { if (existsSync(DAEMON_PID_FILE)) unlinkSync(DAEMON_PID_FILE); } catch { /* ignore */ }
}

/**
 * Ensure the daemon is running, healthy, AND at the correct version.
 * 1. If /health responds 200 with matching version, return true.
 * 2. If /health responds but version mismatches → kill and re-spawn.
 * 3. If PID exists but unhealthy → kill, clean up, re-spawn.
 * 4. If no daemon → spawn a new one.
 * 5. Poll /health every 300ms for up to 8s.
 */
export interface EnsureDaemonOptions {
  /** Pass true to add --prefer-online to npx, forcing a fresh registry check. */
  preferOnline?: boolean;
}

export async function ensureDaemon(options?: EnsureDaemonOptions): Promise<boolean> {
  // 1. Quick health check with version validation
  const health = await fetchDaemonHealth();
  if (health && health.version === VERSION) return true;

  // Version mismatch — kill the outdated daemon
  if (health) {
    await killDaemon();
  }

  // 2. Clean up unhealthy/stale process (health was null — no response)
  if (!health) {
    const pid = readPidFile();
    if (pid && isProcessRunning(pid.pid)) {
      await killDaemon();
    } else if (pid) {
      try { unlinkSync(DAEMON_PID_FILE); } catch { /* ignore */ }
    }
  }

  // 3. Spawn new daemon
  let npxPath: string;
  try {
    npxPath = resolveNpxPath();
  } catch {
    npxPath = 'npx'; // fallback to PATH lookup
  }

  // Always use --prefer-online so the daemon auto-updates on every spawn.
  // Can be explicitly disabled with preferOnline: false if needed.
  const usePreferOnline = options?.preferOnline !== false;
  const npxArgs = ['-y'];
  if (usePreferOnline) npxArgs.push('--prefer-online');
  npxArgs.push('@devness/useai@latest', 'daemon', '--port', String(DAEMON_PORT));

  const child = spawn(npxPath, npxArgs, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // 4. Poll for health (60s timeout — npx cold start can take 15-30s+ on cache miss)
  const start = Date.now();
  while (Date.now() - start < 60000) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkDaemonHealth()) return true;
  }

  return false;
}
