import { test, expect } from '@playwright/test';
import { gotoDashboard, fetchFromDaemon } from './helpers';

// ─── Health & Config endpoint tests ───────────────────────────────────────────
//
// These tests verify that the real daemon API responds with the correct shape
// and that the dashboard UI correctly reflects the state (unauthenticated,
// no active sessions) that the seed config produces.
//
// NOTE: The seed config (SEED_CONFIG) sets no auth token and auto_sync=false,
// so authenticated will be false in the /api/local/config response.

test.describe('Health Endpoint', () => {
  test('health endpoint returns ok', async () => {
    const health = await fetchFromDaemon('/health');

    // status must be 'ok' — anything else means the daemon is degraded
    expect(health.status).toBe('ok');

    // version must be a non-empty string (exact value not checked so tests
    // survive version bumps)
    expect(typeof health.version).toBe('string');
    expect(health.version.length).toBeGreaterThan(0);
  });

  test('health shows active_sessions=0', async () => {
    // No MCP stdio clients connect during E2E runs, so active_sessions must be 0
    const health = await fetchFromDaemon('/health');
    expect(health.active_sessions).toBe(0);
  });

  test('health includes expected top-level fields', async () => {
    const health = await fetchFromDaemon('/health');

    // Structural check — these keys must all be present
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('version');
    expect(health).toHaveProperty('active_sessions');
    expect(health).toHaveProperty('uptime_seconds');

    // uptime must be a non-negative number
    expect(typeof health.uptime_seconds).toBe('number');
    expect(health.uptime_seconds).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Config Endpoint', () => {
  test('config endpoint returns correct format', async () => {
    const config = await fetchFromDaemon('/api/local/config');

    // SEED_CONFIG has no auth_token, so the daemon should report unauthenticated
    expect(config.authenticated).toBe(false);

    // email is null when unauthenticated
    expect(config.email === null || config.email === undefined).toBe(true);
  });

  test('config endpoint includes expected settings fields', async () => {
    const config = await fetchFromDaemon('/api/local/config');

    // These flags come directly from the on-disk config written by global-setup
    // SEED_CONFIG: auto_sync=false, milestone_tracking=true
    expect(config).toHaveProperty('auto_sync');
    expect(config.auto_sync).toBe(false);
  });
});

test.describe('Update-Check Endpoint', () => {
  test('update-check endpoint works', async () => {
    const updateInfo = await fetchFromDaemon('/api/local/update-check');

    // Must return the current version as a non-empty string
    expect(typeof updateInfo.current).toBe('string');
    expect(updateInfo.current.length).toBeGreaterThan(0);

    // The latest field must also be a non-empty string
    expect(typeof updateInfo.latest).toBe('string');
    expect(updateInfo.latest.length).toBeGreaterThan(0);

    // update_available must be a boolean
    expect(typeof updateInfo.update_available).toBe('boolean');
  });

  test('update-check returns current version matching health version', async () => {
    const [health, updateInfo] = await Promise.all([
      fetchFromDaemon('/health'),
      fetchFromDaemon('/api/local/update-check'),
    ]);

    // The running daemon's version should match the "current" field in update-check
    expect(updateInfo.current).toBe(health.version);
  });
});

test.describe('Dashboard UI — Health State', () => {
  test('dashboard shows no active sessions badge', async ({ page }) => {
    await gotoDashboard(page);

    // active_sessions=0 means the badge should NOT be rendered at all.
    // The mock tests verify this with text matching — we do the same here
    // against real daemon data.
    await expect(page.getByText(/active session/)).not.toBeVisible();
  });

  test('unauthenticated state shows Sign in button', async ({ page }) => {
    await gotoDashboard(page);

    // SEED_CONFIG has no auth_token — the daemon reports authenticated=false,
    // so the profile area must render a "Sign in" button rather than an avatar.
    await expect(page.getByText('Sign in')).toBeVisible();
  });
});
