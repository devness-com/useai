import { test, expect } from '@playwright/test';
import {
  gotoDashboard,
  selectScale,
  getTimeDisplay,
  getDateDisplay,
  getPeriodLabel,
  switchTab,
} from './helpers';
import { SESSIONS_TODAY, SESSIONS_YESTERDAY, TOTAL_SESSIONS } from './seed-data';

// ─── Time-Filter / Navigation tests against real seeded data ──────────────────
//
// Seed data layout (by day):
//   Today (0 days ago)     — sess-e2e-001 through sess-e2e-005  → SESSIONS_TODAY = 5
//   Yesterday (1 day ago)  — sess-e2e-006, sess-e2e-009/010    → SESSIONS_YESTERDAY = 3
//   2 days ago             — sess-e2e-007 (SQL/data)
//   3 days ago             — sess-e2e-008 (planning, no eval)
//   Total                  — TOTAL_SESSIONS = 10
//
// The dashboard renders "{N} Sessions" in the Activity Feed header to indicate
// how many sessions fall within the current time window.

test.describe('Day Scale — Today', () => {
  test('day scale shows today\'s sessions', async ({ page }) => {
    await gotoDashboard(page);
    // Default scale is already 'day', but select explicitly to be safe
    await selectScale(page, 'day');

    // Activity Feed header must show exactly SESSIONS_TODAY sessions (5)
    await expect(page.getByText(`${SESSIONS_TODAY} Sessions`)).toBeVisible();
  });

  test('today\'s private titles are visible on day scale', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');

    // sess-e2e-001: standalone coding session
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).toBeVisible();
    // sess-e2e-002: debugging session (pandas)
    await expect(page.getByText('Fix pandas DataFrame merge causing duplicate rows')).toBeVisible();
  });
});

test.describe('Scale Switching', () => {
  test('month scale shows all sessions', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // All 10 seeded sessions fall within the past month window
    await expect(page.getByText(`${TOTAL_SESSIONS} Sessions`)).toBeVisible();
  });

  test('week scale shows this week\'s sessions', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'week');

    // Sessions from today AND yesterday are both within the current calendar week
    // (seed data: 5 today + 3 yesterday = 8, but also 2-days-ago and 3-days-ago
    // may or may not fall in the same week depending on run day — so we assert
    // that the count is at least today's + yesterday's sessions)
    const countEl = page.getByText(/\d+ Sessions/);
    await expect(countEl).toBeVisible();

    const countText = await countEl.innerText();
    const count = parseInt(countText, 10);
    expect(count).toBeGreaterThanOrEqual(SESSIONS_TODAY + SESSIONS_YESTERDAY);
  });
});

test.describe('Day Navigation — Previous Days', () => {
  test('navigating back one day shows yesterday\'s sessions', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');

    // Navigate back one day
    await page.locator('button[title="Previous Day"]').click();
    await page.waitForTimeout(300);

    // Mode must switch to history
    await expect(page.getByTestId('history-badge')).toBeVisible();

    // Activity Feed must show SESSIONS_YESTERDAY sessions (3)
    await expect(page.getByText(`${SESSIONS_YESTERDAY} Sessions`)).toBeVisible();
  });

  test('yesterday shows Windsurf refactoring and dashboard conversation sessions', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');
    await page.locator('button[title="Previous Day"]').click();
    await page.waitForTimeout(300);

    // sess-e2e-006 private_title (Windsurf, refactoring)
    await expect(page.getByText('Extract shared hooks from React components')).toBeVisible();

    // sess-e2e-009 is in CONV_ID_2 (Dashboard conversation) — appears as group
    // The conversation group will show the first prompt private_title or "2 prompts"
    await expect(page.getByText('2 prompts')).toBeVisible();
  });

  test('navigating to 2 days ago shows that day\'s session', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');

    // Navigate back two days
    await page.locator('button[title="Previous Day"]').click();
    await page.waitForTimeout(300);
    await page.locator('button[title="Previous Day"]').click();
    await page.waitForTimeout(300);

    // Only sess-e2e-007 is on 2 days ago — count should be 1
    await expect(page.getByText('1 Sessions')).toBeVisible();

    // The SQL/data private title
    await expect(page.getByText('Create PostgreSQL migration for analytics tables')).toBeVisible();
  });

  test('navigating to 3 days ago shows planning session with no evaluation', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');

    // Navigate back three days
    for (let i = 0; i < 3; i++) {
      await page.locator('button[title="Previous Day"]').click();
      await page.waitForTimeout(300);
    }

    // Only sess-e2e-008 is on 3 days ago
    await expect(page.getByText('1 Sessions')).toBeVisible();

    // The planning session private title
    await expect(page.getByText('Plan REST API endpoints for v2 release')).toBeVisible();
  });
});

test.describe('Time Display', () => {
  test('live mode period label contains Now', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');

    // In live mode the period label shows "Now" (e.g. "Today · Now")
    const label = await getPeriodLabel(page);
    expect(label.toLowerCase()).toContain('now');
  });

  test('history mode shows past date in date display', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');

    const dateBefore = await getDateDisplay(page);

    // Navigate back one day
    await page.locator('button[title="Previous Day"]').click();
    await page.waitForTimeout(300);

    const dateAfter = await getDateDisplay(page);

    // The date display must change (yesterday vs. today)
    expect(dateAfter).not.toBe(dateBefore);
  });

  test('history mode period label does not contain Now', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');

    // Go to history
    await page.locator('button[title="Previous Day"]').click();
    await page.waitForTimeout(300);

    const label = await getPeriodLabel(page);
    expect(label.toLowerCase()).not.toContain('now');
  });

  test('live mode time display shows a recent time', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');

    // In live mode the time display reflects the current clock — it should be
    // a non-empty string (e.g. "3:42:07 PM")
    const timeText = await getTimeDisplay(page);
    expect(timeText.length).toBeGreaterThan(0);
  });
});

test.describe('Go Live', () => {
  test('Go Live button returns to current period', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');

    // Enter history
    await page.locator('button[title="Previous Day"]').click();
    await page.waitForTimeout(300);
    await expect(page.getByTestId('go-live-button')).toBeVisible();
    await expect(page.getByTestId('history-badge')).toBeVisible();

    // Click Go Live
    await page.getByTestId('go-live-button').click();
    await page.waitForTimeout(300);

    // Must return to live mode — live badge visible, go-live button gone
    await expect(page.getByTestId('live-badge')).toBeVisible();
    await expect(page.getByTestId('go-live-button')).not.toBeVisible();

    // Session count must snap back to today's sessions
    await expect(page.getByText(`${SESSIONS_TODAY} Sessions`)).toBeVisible();
  });
});

test.describe('Time Filtering Affects Insights Tab', () => {
  test('time filtering affects Insights tab — day scale shows only today\'s evaluations', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');
    await switchTab(page, 'Insights');

    // On day scale (today), only today's sessions with evaluations are shown.
    // Today has 5 sessions (sess-001 through sess-005), all with evaluations.
    // The summary line must say "5 sessions evaluated" (or close to it)
    await expect(page.getByText(/sessions evaluated/)).toBeVisible();

    const summaryText = await page.getByText(/sessions evaluated/).innerText();
    // Parse the number from "5 sessions evaluated"
    const match = summaryText.match(/(\d+)\s+sessions? evaluated/);
    expect(match).not.toBeNull();
    const evaluatedCount = parseInt(match![1], 10);
    // Today has 5 sessions, all with evaluations → evaluated count should be 5
    expect(evaluatedCount).toBe(SESSIONS_TODAY);
  });

  test('switching to month scale on Insights shows more evaluated sessions', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'day');
    await switchTab(page, 'Insights');

    // Day scale (today) — expect exactly SESSIONS_TODAY evaluated sessions
    const daySummaryEl = page.getByText(/sessions evaluated/);
    await expect(daySummaryEl).toBeVisible();
    const dayText = await daySummaryEl.innerText();
    const dayMatch = dayText.match(/(\d+)\s+sessions? evaluated/);
    const dayCount = parseInt(dayMatch![1], 10);

    // Switch to month scale — should include sessions from all 4 days
    // (sess-008 has no evaluation, so month = TOTAL_SESSIONS - 1 = 9 evaluated)
    await selectScale(page, 'month');
    await page.waitForTimeout(300);

    const monthSummaryEl = page.getByText(/sessions evaluated/);
    await expect(monthSummaryEl).toBeVisible();
    const monthText = await monthSummaryEl.innerText();
    const monthMatch = monthText.match(/(\d+)\s+sessions? evaluated/);
    const monthCount = parseInt(monthMatch![1], 10);

    // Month must include more evaluated sessions than just today
    expect(monthCount).toBeGreaterThan(dayCount);
  });
});
