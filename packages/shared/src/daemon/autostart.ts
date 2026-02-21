import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname } from 'node:path';

import {
  DAEMON_PORT,
  DAEMON_LOG_FILE,
  LAUNCHD_PLIST_PATH,
  SYSTEMD_SERVICE_PATH,
  WINDOWS_STARTUP_SCRIPT_PATH,
} from '../constants/paths.js';
import { resolveNpxPath, buildNodePath } from './resolve-npx.js';

export type Platform = 'macos' | 'linux' | 'windows' | 'unsupported';

/** Detect the current platform for autostart purposes. */
export function detectPlatform(): Platform {
  switch (process.platform) {
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    case 'win32': return 'windows';
    default: return 'unsupported';
  }
}

// ── macOS (launchd) ───────────────────────────────────────────────────────────

const LAUNCHD_LABEL = 'dev.useai.daemon';

function getLaunchdDomain(): string {
  try {
    const uid = execSync('id -u', { encoding: 'utf-8' }).trim();
    return `gui/${uid}`;
  } catch {
    return `gui/${process.getuid?.() ?? 501}`;
  }
}

function getLaunchdServiceTarget(): string {
  return `${getLaunchdDomain()}/${LAUNCHD_LABEL}`;
}

function buildPlist(npxPath: string, nodePath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${npxPath}</string>
    <string>-y</string>
    <string>--prefer-online</string>
    <string>@devness/useai@latest</string>
    <string>daemon</string>
    <string>--port</string>
    <string>${DAEMON_PORT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>ExitTimeOut</key>
  <integer>10</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${DAEMON_LOG_FILE}</string>
  <key>StandardErrorPath</key>
  <string>${DAEMON_LOG_FILE}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${nodePath}</string>
  </dict>
</dict>
</plist>
`;
}

function installMacos(): void {
  const npxPath = resolveNpxPath();
  const nodePath = buildNodePath();
  const target = getLaunchdServiceTarget();
  const domain = getLaunchdDomain();

  mkdirSync(dirname(LAUNCHD_PLIST_PATH), { recursive: true });
  writeFileSync(LAUNCHD_PLIST_PATH, buildPlist(npxPath, nodePath));

  // Bootout first if already loaded (idempotent)
  try { execSync(`launchctl bootout ${target} 2>/dev/null`, { stdio: 'ignore' }); } catch { /* ignore */ }

  // Enable the service (clears disabled state from prior crash loops)
  try { execSync(`launchctl enable ${target}`, { stdio: 'ignore' }); } catch { /* ignore */ }

  // Bootstrap the service
  execSync(`launchctl bootstrap ${domain} "${LAUNCHD_PLIST_PATH}"`, { stdio: 'ignore' });
}

function removeMacos(): void {
  const target = getLaunchdServiceTarget();
  try { execSync(`launchctl bootout ${target} 2>/dev/null`, { stdio: 'ignore' }); } catch { /* ignore */ }
  try { if (existsSync(LAUNCHD_PLIST_PATH)) unlinkSync(LAUNCHD_PLIST_PATH); } catch { /* ignore */ }
}

function isMacosInstalled(): boolean {
  return existsSync(LAUNCHD_PLIST_PATH);
}

// ── Linux (systemd user service) ──────────────────────────────────────────────

function buildSystemdUnit(npxPath: string, nodePath: string): string {
  return `[Unit]
Description=UseAI Daemon
After=network.target
StartLimitBurst=5
StartLimitIntervalSec=60

[Service]
Type=simple
ExecStart=${npxPath} -y --prefer-online @devness/useai@latest daemon --port ${DAEMON_PORT}
Restart=on-failure
RestartSec=10
Environment=PATH=${nodePath}

[Install]
WantedBy=default.target
`;
}

function installLinux(): void {
  const npxPath = resolveNpxPath();
  const nodePath = buildNodePath();

  mkdirSync(dirname(SYSTEMD_SERVICE_PATH), { recursive: true });
  writeFileSync(SYSTEMD_SERVICE_PATH, buildSystemdUnit(npxPath, nodePath));

  // Clear any prior failed state before enabling
  try { execSync('systemctl --user reset-failed useai-daemon.service', { stdio: 'ignore' }); } catch { /* ignore */ }
  execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
  execSync('systemctl --user enable --now useai-daemon.service', { stdio: 'ignore' });
}

function removeLinux(): void {
  try { execSync('systemctl --user disable --now useai-daemon.service', { stdio: 'ignore' }); } catch { /* ignore */ }
  try { if (existsSync(SYSTEMD_SERVICE_PATH)) unlinkSync(SYSTEMD_SERVICE_PATH); } catch { /* ignore */ }
  try { execSync('systemctl --user daemon-reload', { stdio: 'ignore' }); } catch { /* ignore */ }
}

function isLinuxInstalled(): boolean {
  return existsSync(SYSTEMD_SERVICE_PATH);
}

// ── Windows (Startup folder VBS script) ───────────────────────────────────────

function buildVbsScript(npxPath: string): string {
  return `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """${npxPath}"" -y --prefer-online @devness/useai@latest daemon --port ${DAEMON_PORT}", 0, False
`;
}

function installWindows(): void {
  const npxPath = resolveNpxPath();

  mkdirSync(dirname(WINDOWS_STARTUP_SCRIPT_PATH), { recursive: true });
  writeFileSync(WINDOWS_STARTUP_SCRIPT_PATH, buildVbsScript(npxPath));
}

function removeWindows(): void {
  try { if (existsSync(WINDOWS_STARTUP_SCRIPT_PATH)) unlinkSync(WINDOWS_STARTUP_SCRIPT_PATH); } catch { /* ignore */ }
}

function isWindowsInstalled(): boolean {
  return existsSync(WINDOWS_STARTUP_SCRIPT_PATH);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Install auto-start service for the current platform. Idempotent. */
export function installAutostart(): void {
  const platform = detectPlatform();
  switch (platform) {
    case 'macos': installMacos(); break;
    case 'linux': installLinux(); break;
    case 'windows': installWindows(); break;
    case 'unsupported':
      throw new Error(`Auto-start is not supported on ${process.platform}`);
  }
}

/** Remove auto-start service for the current platform. */
export function removeAutostart(): void {
  const platform = detectPlatform();
  switch (platform) {
    case 'macos': removeMacos(); break;
    case 'linux': removeLinux(); break;
    case 'windows': removeWindows(); break;
    case 'unsupported': break; // nothing to remove
  }
}

/** Check if auto-start is currently installed. */
export function isAutostartInstalled(): boolean {
  const platform = detectPlatform();
  switch (platform) {
    case 'macos': return isMacosInstalled();
    case 'linux': return isLinuxInstalled();
    case 'windows': return isWindowsInstalled();
    default: return false;
  }
}

/** Recover auto-start from a disabled/failed state caused by crash loops. */
export function recoverAutostart(): { recovered: boolean; message: string } {
  const platform = detectPlatform();

  switch (platform) {
    case 'macos': {
      if (!existsSync(LAUNCHD_PLIST_PATH)) {
        return { recovered: false, message: 'Auto-start is not installed (plist missing)' };
      }
      const target = getLaunchdServiceTarget();
      const domain = getLaunchdDomain();
      try {
        // Re-enable (clears disabled state from crash loops)
        execSync(`launchctl enable ${target}`, { stdio: 'ignore' });
        // Bootout first in case it's loaded in a bad state
        try { execSync(`launchctl bootout ${target} 2>/dev/null`, { stdio: 'ignore' }); } catch { /* ignore */ }
        // Bootstrap to start it
        execSync(`launchctl bootstrap ${domain} "${LAUNCHD_PLIST_PATH}"`, { stdio: 'ignore' });
        return { recovered: true, message: 'Re-enabled and bootstrapped launchd service' };
      } catch (e) {
        return { recovered: false, message: `Failed to recover: ${(e as Error).message}` };
      }
    }
    case 'linux': {
      if (!existsSync(SYSTEMD_SERVICE_PATH)) {
        return { recovered: false, message: 'Auto-start is not installed (unit file missing)' };
      }
      try {
        execSync('systemctl --user reset-failed useai-daemon.service', { stdio: 'ignore' });
        execSync('systemctl --user start useai-daemon.service', { stdio: 'ignore' });
        return { recovered: true, message: 'Reset systemd failed state and started service' };
      } catch (e) {
        return { recovered: false, message: `Failed to recover: ${(e as Error).message}` };
      }
    }
    case 'windows':
      return { recovered: false, message: 'Recovery is not needed on Windows (no crash loop protection)' };
    default:
      return { recovered: false, message: `Unsupported platform: ${process.platform}` };
  }
}
