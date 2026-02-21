import { join } from 'node:path';
import { homedir } from 'node:os';

export const USEAI_DIR = join(homedir(), '.useai');
export const DATA_DIR = join(USEAI_DIR, 'data');
export const ACTIVE_DIR = join(DATA_DIR, 'active');
export const SEALED_DIR = join(DATA_DIR, 'sealed');
export const KEYSTORE_FILE = join(USEAI_DIR, 'keystore.json');
export const CONFIG_FILE = join(USEAI_DIR, 'config.json');
export const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
export const MILESTONES_FILE = join(DATA_DIR, 'milestones.json');
export const DAEMON_PID_FILE = join(USEAI_DIR, 'daemon.pid');
export const USEAI_HOOKS_DIR = join(USEAI_DIR, 'hooks');

// ── Daemon constants ──────────────────────────────────────────────────────────

export const DAEMON_PORT = 19200;
export const DAEMON_LOG_FILE = join(USEAI_DIR, 'daemon.log');
export const DAEMON_MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
export const DAEMON_HEALTH_URL = `http://127.0.0.1:${DAEMON_PORT}/health`;

// ── Autostart service paths (per-platform) ────────────────────────────────────

export const LAUNCHD_PLIST_PATH = join(
  homedir(), 'Library', 'LaunchAgents', 'dev.useai.daemon.plist',
);
export const SYSTEMD_SERVICE_PATH = join(
  homedir(), '.config', 'systemd', 'user', 'useai-daemon.service',
);
export const WINDOWS_STARTUP_SCRIPT_PATH = join(
  process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'),
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'useai-daemon.vbs',
);
