import { test, expect } from '@playwright/test';
import { gotoDashboard, selectScale } from './helpers';
import {
  UNIQUE_CLIENTS,
  UNIQUE_PROJECTS,
  TOTAL_SESSIONS,
} from './seed-data';

// ─── Filter Chip Tests with Real Daemon Data ──────────────────────────────────
//
// UNIQUE_CLIENTS = ['claude-code', 'cursor', 'windsurf', 'vscode']
// UNIQUE_PROJECTS = ['acme-api', 'ml-pipeline', 'acme-web']
//
// Client session counts (month scale):
//   claude-code → 5 (sess-001, 003, 004, 005, 008)
//   cursor      → 3 (sess-002, 009, 010)
//   windsurf    → 1 (sess-006)
//   vscode      → 1 (sess-007)
//
// Project session counts (month scale):
//   acme-api    → 5 (sess-001, 003, 004, 005, 008)
//   ml-pipeline → 2 (sess-002, 007)
//   acme-web    → 3 (sess-006, 009, 010)
//
// NOTE: Chip filters only hide/show session cards — they do NOT change the
// "{N} Sessions" count badge in the Activity Feed header. That badge always
// shows the count for the current TIME WINDOW, not the chip-filtered count.
// So we verify filtering by checking card visibility, NOT the count badge.

test.describe('Filter Chips with Real Data', () => {
  // ── Toggle visibility ──────────────────────────────────────────────────────

  test('show filters button works', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Filter chips are hidden by default — "All" chip not visible yet
    await expect(page.getByRole('button', { name: 'All', exact: true })).not.toBeVisible();

    // Click "Show filters" to reveal the filter chip bar
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // "All" chip should now be visible in the filter bar
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
  });

  // ── Client chips ───────────────────────────────────────────────────────────

  test('client chips match real data', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Filter chips use TOOL_DISPLAY_NAMES — client values mapped to display names:
    // UNIQUE_CLIENTS = ['claude-code', 'cursor', 'windsurf', 'vscode']
    // → 'Claude Code', 'Cursor', 'Windsurf', 'VS Code'
    const expectedDisplayNames = UNIQUE_CLIENTS.map((client) => {
      const map: Record<string, string> = {
        'claude-code': 'Claude Code',
        cursor: 'Cursor',
        windsurf: 'Windsurf',
        vscode: 'VS Code',
      };
      return map[client] ?? client;
    });

    for (const displayName of expectedDisplayNames) {
      await expect(page.getByRole('button', { name: displayName, exact: true })).toBeVisible();
    }
  });

  // ── Language chips ─────────────────────────────────────────────────────────

  test('language chips match real data', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Verify language chips derived from all seeded sessions.
    // FilterChips renders language labels as lowercase strings inside <button> elements.
    await expect(page.getByRole('button', { name: 'typescript', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'python', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'go', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'javascript', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'sql', exact: true })).toBeVisible();
  });

  // ── Project chips ──────────────────────────────────────────────────────────

  test('project chips match real data', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // All three projects from seeded data should have filter chips
    for (const project of UNIQUE_PROJECTS) {
      await expect(page.getByRole('button', { name: project, exact: true })).toBeVisible();
    }
  });

  // ── Client filtering ───────────────────────────────────────────────────────

  test('filtering by Claude Code shows claude-code sessions', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Click the Claude Code filter chip button
    await page.getByRole('button', { name: 'Claude Code', exact: true }).click();
    await page.waitForTimeout(300);

    // Claude Code sessions should be visible:
    // sess-001: standalone, private_title "Build JWT auth with refresh tokens for Acme API"
    // sess-008: standalone, private_title "Plan REST API endpoints for v2 release"
    // conv CONV_ID_1 (sess-003/004/005): conversation card showing first session's title
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).toBeVisible();
    await expect(page.getByText('Plan REST API endpoints for v2 release')).toBeVisible();

    // Non-claude-code sessions should NOT be visible:
    // sess-002 (cursor): "Fix pandas DataFrame merge causing duplicate rows"
    // sess-006 (windsurf): "Extract shared hooks from React components"
    // sess-007 (vscode): "Create PostgreSQL migration for analytics tables"
    await expect(page.getByText('Fix pandas DataFrame merge causing duplicate rows')).not.toBeVisible();
    await expect(page.getByText('Extract shared hooks from React components')).not.toBeVisible();
    await expect(page.getByText('Create PostgreSQL migration for analytics tables')).not.toBeVisible();
  });

  test('filtering by Cursor shows cursor sessions', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Click the Cursor filter chip button
    await page.getByRole('button', { name: 'Cursor', exact: true }).click();
    await page.waitForTimeout(300);

    // Cursor sessions should be visible:
    // sess-002 (standalone): "Fix pandas DataFrame merge causing duplicate rows"
    // conv CONV_ID_2 (sess-009/010): conversation card
    await expect(page.getByText('Fix pandas DataFrame merge causing duplicate rows')).toBeVisible();

    // Non-cursor sessions should NOT be visible:
    // sess-001 (claude-code): "Build JWT auth with refresh tokens for Acme API"
    // sess-006 (windsurf): "Extract shared hooks from React components"
    // sess-007 (vscode): "Create PostgreSQL migration for analytics tables"
    // sess-008 (claude-code): "Plan REST API endpoints for v2 release"
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).not.toBeVisible();
    await expect(page.getByText('Extract shared hooks from React components')).not.toBeVisible();
    await expect(page.getByText('Create PostgreSQL migration for analytics tables')).not.toBeVisible();
    await expect(page.getByText('Plan REST API endpoints for v2 release')).not.toBeVisible();
  });

  // ── Project filtering ──────────────────────────────────────────────────────

  test('filtering by acme-api shows acme-api sessions', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Click the acme-api project filter chip
    await page.getByRole('button', { name: 'acme-api', exact: true }).click();
    await page.waitForTimeout(300);

    // acme-api sessions should be visible:
    // sess-001: "Build JWT auth with refresh tokens for Acme API"
    // sess-008: "Plan REST API endpoints for v2 release"
    // conv CONV_ID_1 (sess-003/004/005): acme-api conversation
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).toBeVisible();
    await expect(page.getByText('Plan REST API endpoints for v2 release')).toBeVisible();

    // Non-acme-api sessions should NOT be visible:
    // sess-002 (ml-pipeline): "Fix pandas DataFrame merge causing duplicate rows"
    // sess-006 (acme-web): "Extract shared hooks from React components"
    // sess-007 (ml-pipeline): "Create PostgreSQL migration for analytics tables"
    await expect(page.getByText('Fix pandas DataFrame merge causing duplicate rows')).not.toBeVisible();
    await expect(page.getByText('Extract shared hooks from React components')).not.toBeVisible();
    await expect(page.getByText('Create PostgreSQL migration for analytics tables')).not.toBeVisible();
  });

  // ── Deselect / reset ───────────────────────────────────────────────────────

  test('deselecting filter shows all sessions', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Activate the Cursor filter
    await page.getByRole('button', { name: 'Cursor', exact: true }).click();
    await page.waitForTimeout(300);
    // Confirm filter is active — cursor session visible, claude-code session not visible
    await expect(page.getByText('Fix pandas DataFrame merge causing duplicate rows')).toBeVisible();
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).not.toBeVisible();

    // Click Cursor again to deselect the filter
    await page.getByRole('button', { name: 'Cursor', exact: true }).click();
    await page.waitForTimeout(300);

    // All sessions should be restored — both cursor and claude-code sessions visible
    await expect(page.getByText('Fix pandas DataFrame merge causing duplicate rows')).toBeVisible();
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).toBeVisible();
    await expect(page.getByText('Extract shared hooks from React components')).toBeVisible();
    await expect(page.getByText('Create PostgreSQL migration for analytics tables')).toBeVisible();
  });

  test('"All" chip resets filters', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Activate a client filter first
    await page.getByRole('button', { name: 'Windsurf', exact: true }).click();
    await page.waitForTimeout(300);
    // Confirm filter is active — windsurf session visible, others not
    await expect(page.getByText('Extract shared hooks from React components')).toBeVisible();
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).not.toBeVisible();

    // Click the "All" chip to clear all active filters
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.waitForTimeout(300);

    // All sessions should be back — both windsurf and other sessions visible
    await expect(page.getByText('Extract shared hooks from React components')).toBeVisible();
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).toBeVisible();
    await expect(page.getByText('Fix pandas DataFrame merge causing duplicate rows')).toBeVisible();
    await expect(page.getByText('Create PostgreSQL migration for analytics tables')).toBeVisible();
  });

  // ── Privacy toggle ─────────────────────────────────────────────────────────

  test('privacy toggle switches titles', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Default mode is private — private_title is shown
    // sess-001 private_title: "Build JWT auth with refresh tokens for Acme API"
    // sess-001 public title:  "Implement user authentication"
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).toBeVisible();
    await expect(page.getByText('Implement user authentication')).not.toBeVisible();

    // Toggle to public titles
    await page.getByRole('button', { name: 'Switch to public titles' }).click();
    await page.waitForTimeout(300);

    // Now public title should appear, private title should not
    await expect(page.getByText('Implement user authentication')).toBeVisible();
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).not.toBeVisible();
  });

  // ── Search with real data ──────────────────────────────────────────────────

  test('search works with real data', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Open search with Cmd+K
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();

    // Search for "pandas" — should match sess-002 private_title:
    // "Fix pandas DataFrame merge causing duplicate rows"
    await page.getByPlaceholder(/Search/).fill('pandas');
    // Wait for debounce (250ms) plus a safety buffer
    await page.waitForTimeout(500);

    // Scope assertions to the search overlay to avoid clashes with the session list
    const searchOverlay = page.locator('.fixed').filter({ has: page.getByPlaceholder(/Search/) });

    // "1 result" text appears in the search overlay (lowercase, no capital R)
    await expect(searchOverlay.getByText('1 result')).toBeVisible();
    await expect(
      searchOverlay.getByText('Fix pandas DataFrame merge causing duplicate rows').first(),
    ).toBeVisible();
  });

  test('search by language works', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Open search with Cmd+K
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();

    // Search for "sql" — should match sess-007 which has languages: ['sql', 'python']
    // sess-007 private_title: "Create PostgreSQL migration for analytics tables"
    await page.getByPlaceholder(/Search/).fill('sql');
    // Wait for debounce (250ms) plus a safety buffer
    await page.waitForTimeout(500);

    // Scope assertions to the search overlay to avoid clashes with the session list
    const searchOverlay = page.locator('.fixed').filter({ has: page.getByPlaceholder(/Search/) });

    // Should find at least the database migration session that uses SQL
    await expect(
      searchOverlay.getByText('Create PostgreSQL migration for analytics tables').first(),
    ).toBeVisible();
  });
});
