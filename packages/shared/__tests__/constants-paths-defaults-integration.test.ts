import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  USEAI_DIR,
  DATA_DIR,
  ACTIVE_DIR,
  SEALED_DIR,
  KEYSTORE_FILE,
  CONFIG_FILE,
  SESSIONS_FILE,
  MILESTONES_FILE,
  DAEMON_PID_FILE,
  USEAI_HOOKS_DIR,
  DAEMON_PORT,
  DAEMON_LOG_FILE,
  DAEMON_MCP_URL,
  DAEMON_HEALTH_URL,
} from '../src/constants/paths';
import {
  DEFAULT_CAPTURE_CONFIG,
  DEFAULT_SYNC_CONFIG,
  DEFAULT_SYNC_INCLUDE_CONFIG,
  DEFAULT_CONFIG,
  DEFAULT_SYNC_INTERVAL_HOURS,
  GENESIS_HASH,
} from '../src/constants/defaults';
import { VERSION } from '../src/constants/version';

/**
 * Integration: Verifies that path constants are consistent with each other
 * (DATA_DIR under USEAI_DIR, etc.) and that default configs reference
 * consistent values.
 */

describe('Path constants consistency', () => {
  const home = process.env['USEAI_HOME'] ?? join(homedir(), '.useai');

  it('USEAI_DIR is under home directory', () => {
    expect(USEAI_DIR).toBe(home);
  });

  it('DATA_DIR is under USEAI_DIR', () => {
    expect(DATA_DIR).toBe(join(USEAI_DIR, 'data'));
  });

  it('ACTIVE_DIR is under DATA_DIR', () => {
    expect(ACTIVE_DIR).toBe(join(DATA_DIR, 'active'));
  });

  it('SEALED_DIR is under DATA_DIR', () => {
    expect(SEALED_DIR).toBe(join(DATA_DIR, 'sealed'));
  });

  it('data files are under expected directories', () => {
    expect(KEYSTORE_FILE).toBe(join(USEAI_DIR, 'keystore.json'));
    expect(CONFIG_FILE).toBe(join(USEAI_DIR, 'config.json'));
    expect(SESSIONS_FILE).toBe(join(DATA_DIR, 'sessions.json'));
    expect(MILESTONES_FILE).toBe(join(DATA_DIR, 'milestones.json'));
    expect(DAEMON_PID_FILE).toBe(join(USEAI_DIR, 'daemon.pid'));
    expect(USEAI_HOOKS_DIR).toBe(join(USEAI_DIR, 'hooks'));
  });

  it('daemon URLs use DAEMON_PORT', () => {
    expect(DAEMON_PORT).toBe(19200);
    expect(DAEMON_MCP_URL).toContain(String(DAEMON_PORT));
    expect(DAEMON_HEALTH_URL).toContain(String(DAEMON_PORT));
    expect(DAEMON_MCP_URL).toBe(`http://127.0.0.1:${DAEMON_PORT}/mcp`);
    expect(DAEMON_HEALTH_URL).toBe(`http://127.0.0.1:${DAEMON_PORT}/health`);
  });

  it('DAEMON_LOG_FILE is under USEAI_DIR', () => {
    expect(DAEMON_LOG_FILE).toBe(join(USEAI_DIR, 'daemon.log'));
  });
});

describe('Default config constants consistency', () => {
  it('DEFAULT_CONFIG contains DEFAULT_CAPTURE_CONFIG', () => {
    expect(DEFAULT_CONFIG.capture).toEqual(DEFAULT_CAPTURE_CONFIG);
  });

  it('DEFAULT_CONFIG contains DEFAULT_SYNC_CONFIG structure', () => {
    expect(DEFAULT_CONFIG.sync.enabled).toBe(DEFAULT_SYNC_CONFIG.enabled);
    expect(DEFAULT_CONFIG.sync.interval_hours).toBe(DEFAULT_SYNC_CONFIG.interval_hours);
  });

  it('DEFAULT_SYNC_CONFIG.include matches DEFAULT_SYNC_INCLUDE_CONFIG', () => {
    expect(DEFAULT_SYNC_CONFIG.include).toEqual(DEFAULT_SYNC_INCLUDE_CONFIG);
  });

  it('DEFAULT_SYNC_INTERVAL_HOURS matches sync config default', () => {
    expect(DEFAULT_SYNC_INTERVAL_HOURS).toBe(DEFAULT_SYNC_CONFIG.interval_hours);
  });

  it('sync defaults are privacy-safe (prompts, private_titles, projects off)', () => {
    expect(DEFAULT_SYNC_INCLUDE_CONFIG.prompts).toBe(false);
    expect(DEFAULT_SYNC_INCLUDE_CONFIG.private_titles).toBe(false);
    expect(DEFAULT_SYNC_INCLUDE_CONFIG.projects).toBe(false);
  });

  it('capture defaults are all enabled', () => {
    expect(DEFAULT_CAPTURE_CONFIG.prompt).toBe(true);
    expect(DEFAULT_CAPTURE_CONFIG.prompt_images).toBe(true);
    expect(DEFAULT_CAPTURE_CONFIG.evaluation).toBe(true);
    expect(DEFAULT_CAPTURE_CONFIG.milestones).toBe(true);
    expect(DEFAULT_CAPTURE_CONFIG.evaluation_reasons).toBe('all');
  });

  it('DEFAULT_CONFIG uses space evaluation framework', () => {
    expect(DEFAULT_CONFIG.evaluation_framework).toBe('space');
  });

  it('GENESIS_HASH is the expected constant', () => {
    expect(GENESIS_HASH).toBe('GENESIS');
  });
});

describe('Version constant', () => {
  it('VERSION is a valid semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
