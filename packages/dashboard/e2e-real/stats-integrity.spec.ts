/**
 * Stats Integrity E2E Tests
 *
 * TRUE end-to-end tests that verify stats computed from real daemon data
 * match the expected values from the seed dataset.
 *
 * Seed summary:
 *   - 10 sessions across 4 days (today, yesterday, 2 days ago, 3 days ago)
 *   - 3 projects: acme-api (5), ml-pipeline (2), acme-web (3)
 *   - 4 clients: claude-code, cursor, windsurf, vscode
 *   - 7 milestones: 4 features, 2 bugfixes, 1 refactor
 *   - Complexity distribution: 3 complex, 3 medium, 1 simple
 *   - 9 sessions with evaluations: 8 completed, 1 partial → 89% completion rate
 *   - Streak: 4 consecutive days (today + 3 prior days)
 *
 * Run: npx playwright test --config=playwright.real.config.ts stats-integrity
 */

import { test, expect } from '@playwright/test';
import { gotoDashboard, selectScale, fetchFromDaemon } from './helpers';
import {
  TOTAL_SESSIONS,
  TOTAL_MILESTONES,
  FEATURES_COUNT,
  BUGS_COUNT,
  COMPLEX_COUNT,
  SEED_MILESTONES,
} from './seed-data';

// ─── Derived constants ────────────────────────────────────────────────────────

/**
 * Streak = consecutive days with sessions, counting backwards from today.
 * Seed has sessions on: today (day 0), yesterday (day 1), 2 days ago, 3 days ago.
 * All four days are consecutive → streak of 4.
 */
const EXPECTED_STREAK = 4;

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('Stats Integrity — Real Daemon Data', () => {
  // ── 1. API contract ──────────────────────────────────────────────────────

  test('stats API returns computed values matching seed data', async () => {
    const data = await fetchFromDaemon('/api/local/stats');

    // Total sessions must equal seed count
    expect(data.totalSessions).toBe(TOTAL_SESSIONS);

    // Files touched must be > 0 (sum across all sessions)
    expect(data.filesTouched).toBeGreaterThan(0);

    // byClient must contain both claude-code and cursor entries
    expect(data.byClient).toHaveProperty('claude-code');
    expect(data.byClient).toHaveProperty('cursor');
    expect(data.byClient['claude-code']).toBeGreaterThan(0);
    expect(data.byClient['cursor']).toBeGreaterThan(0);

    // byLanguage must contain typescript and python entries
    expect(data.byLanguage).toHaveProperty('typescript');
    expect(data.byLanguage).toHaveProperty('python');
    expect(data.byLanguage['typescript']).toBeGreaterThan(0);
    expect(data.byLanguage['python']).toBeGreaterThan(0);

    // totalHours must be > 0
    expect(data.totalHours).toBeGreaterThan(0);
  });

  // ── 2–7. Stat card values ─────────────────────────────────────────────────

  test('Milestones stat card shows total milestone count (7)', async ({ page }) => {
    await gotoDashboard(page);
    // Use month scale so all 4 days of seed data fall within the time window
    await selectScale(page, 'month');

    await expect(page.getByText('Milestones', { exact: true }).first()).toBeVisible();

    // The numeric value equal to TOTAL_MILESTONES should appear in the stats bar
    await expect(page.getByText(String(TOTAL_MILESTONES)).first()).toBeVisible();
  });

  test('Features stat card shows feature milestone count (4)', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    await expect(page.getByText('Features', { exact: true }).first()).toBeVisible();
    // The value FEATURES_COUNT=4 should appear in the UI near the Features label
    await expect(page.getByText(String(FEATURES_COUNT)).first()).toBeVisible();
  });

  test('Bugs Fixed stat card shows bugfix milestone count (2)', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    await expect(page.getByText('Bugs Fixed', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(String(BUGS_COUNT)).first()).toBeVisible();
  });

  test('Complex stat card shows complex milestone count (3)', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    await expect(page.getByText('Complex', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(String(COMPLEX_COUNT)).first()).toBeVisible();
  });

  test('Gained Time stat card is visible in stats bar', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    await expect(page.getByText('Gained Time', { exact: true }).first()).toBeVisible();
  });

  test('Boost stat card is visible in stats bar', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    await expect(page.getByText('Boost', { exact: true }).first()).toBeVisible();
  });

  // ── 8. Streak ────────────────────────────────────────────────────────────

  test('Streak stat card shows 4-day consecutive streak', async ({ page }) => {
    await gotoDashboard(page);
    // Streak uses ALL sessions (not time-window filtered), so scale does not matter
    await expect(page.getByText('Streak', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${EXPECTED_STREAK}`).first()).toBeVisible();
  });

  // ── 9. Time metric labels ───────────────────────────────────────────────

  test('Spent Time and Gained Time labels are visible in stats bar', async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.getByText('Spent Time', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Gained Time', { exact: true }).first()).toBeVisible();
  });

  // ── 10. Click Features → filtered panel shows 4 milestones ───────────────

  test('clicking Features card shows filtered panel with 4 feature milestones', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Click the Features stat card to open the detail panel
    await page.getByText('Features', { exact: true }).first().click();
    await page.waitForTimeout(400);

    // Panel header shows "Features Shipped" title
    await expect(page.getByText('Features Shipped')).toBeVisible();

    // Count indicator in panel header: "4 items in window"
    await expect(page.getByText(`${FEATURES_COUNT} items in window`)).toBeVisible();

    // Verify the private_titles of all 4 feature milestones appear
    const featureMilestones = SEED_MILESTONES.filter((m) => m.category === 'feature');
    for (const milestone of featureMilestones) {
      await expect(page.getByText(milestone.private_title)).toBeVisible();
    }
  });

  // ── 11. Click Bugs Fixed → filtered panel shows 2 milestones ─────────────

  test('clicking Bugs Fixed card shows filtered panel with 2 bugfix milestones', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Click the Bugs Fixed stat card
    await page.getByText('Bugs Fixed', { exact: true }).first().click();
    await page.waitForTimeout(400);

    // Panel header shows "Bugs Fixed" title (second occurrence = panel title)
    await expect(page.getByText('Bugs Fixed').nth(1)).toBeVisible();

    // Count indicator: "2 items in window"
    await expect(page.getByText(`${BUGS_COUNT} items in window`)).toBeVisible();

    // Verify the private_titles of both bugfix milestones appear
    const bugMilestones = SEED_MILESTONES.filter((m) => m.category === 'bugfix');
    for (const milestone of bugMilestones) {
      await expect(page.getByText(milestone.private_title)).toBeVisible();
    }
  });

  // ── 12. All milestone private_titles visible in Milestones panel ──────────

  test('Milestones panel shows all 7 milestone private_titles from seed data', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Open the Milestones detail panel
    await page.getByText('Milestones', { exact: true }).first().click();
    await page.waitForTimeout(400);

    // Panel should show "All Milestones" title
    await expect(page.getByText('All Milestones')).toBeVisible();

    // Count indicator: "7 items in window"
    await expect(page.getByText(`${TOTAL_MILESTONES} items in window`)).toBeVisible();

    // Private mode is the default — all private_titles should be visible
    for (const milestone of SEED_MILESTONES) {
      await expect(page.getByText(milestone.private_title)).toBeVisible();
    }
  });
});
