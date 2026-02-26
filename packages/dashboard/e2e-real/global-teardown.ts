import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), 'useai-e2e-real');

export default async function globalTeardown() {
  // Kill the test daemon
  const pidFile = join(TEST_HOME, 'e2e-daemon.pid');
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 'SIGTERM');
      // Give it a moment to shut down gracefully
      await new Promise((r) => setTimeout(r, 1000));
      // Force kill if still running
      try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch { /* already dead */ }
    } catch {
      // Process already gone
    }
    console.log(`[e2e-real] Daemon (PID ${pid}) stopped`);
  }

  // Clean up temp directory
  if (existsSync(TEST_HOME)) {
    rmSync(TEST_HOME, { recursive: true });
    console.log(`[e2e-real] Cleaned up ${TEST_HOME}`);
  }
}
