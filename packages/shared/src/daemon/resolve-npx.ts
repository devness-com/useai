import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const isWindows = process.platform === 'win32';

const KNOWN_PATHS = isWindows
  ? []
  : [
      '/usr/local/bin/npx',
      '/opt/homebrew/bin/npx',
      join(homedir(), '.nvm', 'current', 'bin', 'npx'),
      join(homedir(), '.volta', 'bin', 'npx'),
      join(homedir(), '.bun', 'bin', 'npx'),
    ];

/**
 * Resolve the absolute path to npx.
 * launchd/systemd don't inherit the user's PATH, so we resolve at install time.
 */
export function resolveNpxPath(): string {
  // 1. `which npx` (or `where npx` on Windows)
  const whichCmd = isWindows ? 'where npx' : 'which npx';
  try {
    const result = execSync(whichCmd, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf-8' }).trim();
    if (result) return result.split('\n')[0]!.trim();
  } catch { /* not found */ }

  // 2. Login shell fallback (picks up nvm/volta)
  if (!isWindows && process.env['SHELL']) {
    try {
      const result = execSync(`${process.env['SHELL']} -lc "which npx"`, {
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf-8',
      }).trim();
      if (result) return result;
    } catch { /* not found */ }
  }

  // 3. Check known paths
  for (const p of KNOWN_PATHS) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    'Could not find npx. Ensure Node.js is installed and npx is in your PATH.',
  );
}

/**
 * Build a PATH string that includes common Node.js install directories.
 * Used as EnvironmentVariables.PATH in launchd/systemd service definitions.
 */
export function buildNodePath(): string {
  const home = homedir();
  const dirs = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    join(home, '.nvm', 'current', 'bin'),
    join(home, '.volta', 'bin'),
    join(home, '.bun', 'bin'),
  ];

  // Include the directory of the resolved npx if available
  try {
    const npx = resolveNpxPath();
    const npxDir = npx.substring(0, npx.lastIndexOf('/'));
    if (npxDir && !dirs.includes(npxDir)) {
      dirs.unshift(npxDir);
    }
  } catch { /* ignore */ }

  return dirs.filter((d) => existsSync(d)).join(':');
}
