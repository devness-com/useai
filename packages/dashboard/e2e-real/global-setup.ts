import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { SEED_SESSIONS, SEED_MILESTONES, SEED_CONFIG } from './seed-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_HOME = join(tmpdir(), 'useai-e2e-real');
const TEST_PORT = 19201;
const HEALTH_URL = `http://127.0.0.1:${TEST_PORT}/health`;
const MCP_DIST = join(__dirname, '../../mcp/dist/index.js');

async function waitForHealth(url: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // daemon not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Daemon did not become healthy at ${url} within ${timeoutMs}ms`);
}

/** Kill any stale daemon already listening on the test port */
async function killStaledaemon(): Promise<void> {
  // Try the pid file first
  const pidFile = join(TEST_HOME, 'e2e-daemon.pid');
  if (existsSync(pidFile)) {
    try {
      const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
      if (!isNaN(pid)) {
        try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
        await new Promise((r) => setTimeout(r, 500));
        try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch { /* already dead */ }
      }
    } catch { /* ignore */ }
  }

  // Also attempt to kill whatever process is holding the port via lsof
  try {
    const { execSync } = await import('node:child_process');
    const out = execSync(`lsof -ti tcp:${TEST_PORT} 2>/dev/null || true`).toString().trim();
    if (out) {
      for (const pidStr of out.split('\n')) {
        const pid = parseInt(pidStr.trim(), 10);
        if (!isNaN(pid)) {
          try { process.kill(pid, 'SIGTERM'); } catch { /* ignore */ }
        }
      }
      // Give the processes a moment to die
      await new Promise((r) => setTimeout(r, 800));
      // Force-kill any stragglers
      const out2 = execSync(`lsof -ti tcp:${TEST_PORT} 2>/dev/null || true`).toString().trim();
      if (out2) {
        for (const pidStr of out2.split('\n')) {
          const pid = parseInt(pidStr.trim(), 10);
          if (!isNaN(pid)) {
            try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
          }
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  } catch { /* lsof not available or other error */ }
}

export default async function globalSetup() {
  // Kill any stale daemon from a previous test run before re-seeding
  await killStaledaemon();

  // Clean up any previous test run
  if (existsSync(TEST_HOME)) {
    rmSync(TEST_HOME, { recursive: true });
  }

  // Create directory structure
  mkdirSync(join(TEST_HOME, 'data', 'active'), { recursive: true });
  mkdirSync(join(TEST_HOME, 'data', 'sealed'), { recursive: true });

  // Seed data files
  writeFileSync(join(TEST_HOME, 'data', 'sessions.json'), JSON.stringify(SEED_SESSIONS, null, 2));
  writeFileSync(join(TEST_HOME, 'data', 'milestones.json'), JSON.stringify(SEED_MILESTONES, null, 2));
  writeFileSync(join(TEST_HOME, 'config.json'), JSON.stringify(SEED_CONFIG, null, 2));

  // Start test daemon
  const daemon = spawn('node', [MCP_DIST, 'daemon', '--port', String(TEST_PORT)], {
    env: { ...process.env, USEAI_HOME: TEST_HOME },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  daemon.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[daemon] ${msg}`);
  });
  daemon.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[daemon:err] ${msg}`);
  });

  daemon.on('error', (err) => {
    console.error('Failed to start test daemon:', err);
  });

  // Wait for daemon to be healthy
  await waitForHealth(HEALTH_URL);
  console.log(`[e2e-real] Daemon healthy on port ${TEST_PORT}, data dir: ${TEST_HOME}`);

  // Write PID for teardown
  writeFileSync(join(TEST_HOME, 'e2e-daemon.pid'), String(daemon.pid));

  // Store env vars for Playwright workers
  process.env['USEAI_E2E_HOME'] = TEST_HOME;
  process.env['USEAI_E2E_PORT'] = String(TEST_PORT);
}
