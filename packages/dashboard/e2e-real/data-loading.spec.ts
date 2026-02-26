import { test, expect } from '@playwright/test';
import { gotoDashboard, switchTab, fetchFromDaemon, selectScale } from './helpers';
import {
  TOTAL_SESSIONS,
  TOTAL_MILESTONES,
  UNIQUE_CLIENTS,
  UNIQUE_PROJECTS,
  SESSIONS_TODAY,
  FEATURES_COUNT,
  BUGS_COUNT,
  COMPLEX_COUNT,
} from './seed-data';

// ─── API-level assertions (no browser) ───────────────────────────────────────

test.describe('Real Daemon API', () => {
  test('API returns all seeded sessions', async () => {
    const sessions = await fetchFromDaemon('/api/local/sessions');
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions).toHaveLength(TOTAL_SESSIONS); // 10
  });

  test('API returns all seeded milestones', async () => {
    const milestones = await fetchFromDaemon('/api/local/milestones');
    expect(Array.isArray(milestones)).toBe(true);
    expect(milestones).toHaveLength(TOTAL_MILESTONES); // 7
  });

  test('health endpoint returns ok with no active sessions', async () => {
    const health = await fetchFromDaemon('/health');
    expect(health.status).toBe('ok');
    expect(health.active_sessions).toBe(0);
  });

  test('API sessions include expected unique clients', async () => {
    const sessions = await fetchFromDaemon('/api/local/sessions');
    const clients: string[] = [...new Set(sessions.map((s: any) => s.client))];
    for (const client of UNIQUE_CLIENTS) {
      expect(clients).toContain(client);
    }
  });

  test('API sessions include expected unique projects', async () => {
    const sessions = await fetchFromDaemon('/api/local/sessions');
    const projects: string[] = [...new Set(sessions.map((s: any) => s.project))];
    for (const project of UNIQUE_PROJECTS) {
      expect(projects).toContain(project);
    }
  });

  test('API milestones include expected category breakdown', async () => {
    const milestones = await fetchFromDaemon('/api/local/milestones');
    const features = milestones.filter((m: any) => m.category === 'feature');
    const bugs = milestones.filter((m: any) => m.category === 'bugfix');
    const complex = milestones.filter((m: any) => m.complexity === 'complex');
    expect(features).toHaveLength(FEATURES_COUNT); // 4
    expect(bugs).toHaveLength(BUGS_COUNT);          // 2
    expect(complex).toHaveLength(COMPLEX_COUNT);    // 3
  });

  test('API returns session with no evaluation (sess-e2e-008)', async () => {
    const sessions = await fetchFromDaemon('/api/local/sessions');
    const noEval = sessions.find((s: any) => s.session_id === 'sess-e2e-008');
    expect(noEval).toBeDefined();
    expect(noEval.evaluation).toBeUndefined();
  });
});

// ─── Dashboard UI — general loading ─────────────────────────────────────────

test.describe('Dashboard Loading', () => {
  test('dashboard loads without error and displays time-travel panel', async ({ page }) => {
    await gotoDashboard(page);
    // time-travel-panel must be visible — confirms no hard crash or stuck loading
    await expect(page.getByTestId('time-travel-panel')).toBeVisible();
    // Must NOT still show a blocking "Loading..." spinner
    await expect(page.getByText('Loading...')).not.toBeVisible();
  });

  test('sessions tab is active by default after loading real data', async ({ page }) => {
    await gotoDashboard(page);
    // "Activity Feed" heading is only shown on the Sessions tab
    await expect(page.getByText('Activity Feed')).toBeVisible();
  });
});

// ─── Session List ─────────────────────────────────────────────────────────────

test.describe('Session List with Real Data', () => {
  test('session titles appear in session list (month scale, private mode)', async ({ page }) => {
    await gotoDashboard(page);
    // Switch to month scale so sessions from all 4 days are visible
    await selectScale(page, 'month');

    // Dashboard defaults to private mode — private_title values from seed data
    // Check a few representative private titles from different days
    await expect(page.getByText('Build JWT auth with refresh tokens for Acme API')).toBeVisible();
    await expect(page.getByText('Fix pandas DataFrame merge causing duplicate rows')).toBeVisible();
    await expect(page.getByText('Extract shared hooks from React components')).toBeVisible();
    await expect(page.getByText('Plan REST API endpoints for v2 release')).toBeVisible();
  });

  test('session count matches seeded sessions for month scale', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // The activity feed header shows "N Sessions" for the current window
    // All 10 seed sessions fall within the past month
    await expect(page.getByText(`${TOTAL_SESSIONS} Sessions`)).toBeVisible();
  });

  test('session count matches today-only sessions on day scale', async ({ page }) => {
    await gotoDashboard(page);
    // Default scale is day — only today's sessions should show
    await expect(page.getByText(`${SESSIONS_TODAY} Sessions`)).toBeVisible();
  });

  test('conversation group shows 3-prompt badge', async ({ page }) => {
    await gotoDashboard(page);
    // CONV_ID_1 (conv-e2e-auth-feature) has 3 sessions — should appear as "3 prompts"
    // Use day scale since all 3 prompts are from today
    await expect(page.getByText('3 prompts')).toBeVisible();
  });

  test('conversation group for 2-prompt conversation shows badge', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'week');

    // CONV_ID_2 (conv-e2e-dashboard) has 2 sessions from yesterday
    await expect(page.getByText('2 prompts')).toBeVisible();
  });

  test('expanding conversation shows individual prompt titles', async ({ page }) => {
    await gotoDashboard(page);
    // CONV_ID_1 is visible on day scale (all 3 prompts are today)
    // Expand the 3-prompt conversation
    await page.getByRole('button', { name: 'Expand conversation' }).first().click();
    await page.waitForTimeout(300);

    // Private titles of the individual prompts should become visible.
    // Use .first() to avoid strict mode failure — the title also appears in the
    // collapsed conversation header so there can be 2 matching elements.
    await expect(page.getByText('Prompt 1: Create auth middleware for Express routes').first()).toBeVisible();
    await expect(page.getByText('Prompt 2: Write integration tests for auth middleware').first()).toBeVisible();
    await expect(page.getByText('Prompt 3: Fix 2 failing auth tests after middleware refactor').first()).toBeVisible();
  });
});

// ─── Stat Cards ───────────────────────────────────────────────────────────────

test.describe('Stat Cards with Real Data', () => {
  test('stat cards show correct milestone count for month scale', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Milestones card value should reflect TOTAL_MILESTONES (7)
    // The card label and the numeric value are separate elements
    await expect(page.getByText('Milestones', { exact: true }).first()).toBeVisible();
    // The numeric count — use a regex to find it near the label
    await expect(page.getByText(`${TOTAL_MILESTONES}`, { exact: true }).first()).toBeVisible();
  });

  test('stat cards show correct feature count for month scale', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    await expect(page.getByText('Features', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${FEATURES_COUNT}`, { exact: true }).first()).toBeVisible();
  });

  test('stat cards show correct bug count for month scale', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    await expect(page.getByText('Bugs Fixed', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${BUGS_COUNT}`, { exact: true }).first()).toBeVisible();
  });

  test('stat cards show correct complex count for month scale', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    await expect(page.getByText('Complex', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${COMPLEX_COUNT}`, { exact: true }).first()).toBeVisible();
  });
});

// ─── Insights Tab ─────────────────────────────────────────────────────────────

test.describe('Insights Tab with Real Data', () => {
  test('insights tab shows AI Proficiency section with SPACE metrics', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await switchTab(page, 'Insights');

    // Section heading
    await expect(page.getByText('AI Proficiency')).toBeVisible();

    // SPACE metric labels must all be visible
    await expect(page.getByText('Prompt Quality')).toBeVisible();
    await expect(page.getByText('Context', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Independence')).toBeVisible();
    await expect(page.getByText('Scope', { exact: true }).first()).toBeVisible();
  });

  test('insights tab shows evaluated session summary line', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await switchTab(page, 'Insights');

    // "N sessions evaluated" summary line
    await expect(page.getByText(/sessions evaluated/)).toBeVisible();
    // Should mention completion rate
    await expect(page.getByText(/completed/)).toBeVisible();
  });

  test('insights tab shows task type breakdown with coding and debugging', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await switchTab(page, 'Insights');

    // Task types present in seed data: coding, debugging, testing, refactoring, data, planning
    await expect(page.getByText('Coding').first()).toBeVisible();
    await expect(page.getByText('Debugging').first()).toBeVisible();
  });

  test('insights tab shows recent milestones with private titles', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await switchTab(page, 'Insights');

    // Recent milestone private_title values from seed data
    // Dashboard defaults to private mode
    await expect(page.getByText('Implemented JWT auth with refresh token rotation')).toBeVisible();
    await expect(page.getByText('Fixed pandas merge duplication in ETL pipeline')).toBeVisible();
  });

  test('insights tab shows milestone category badges', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await switchTab(page, 'Insights');

    // Category badges from seed data
    await expect(page.getByText('feature').first()).toBeVisible();
    await expect(page.getByText('bugfix').first()).toBeVisible();
  });

  test('insights tab shows activity strip with hourly or daily bars', async ({ page }) => {
    await gotoDashboard(page);
    await switchTab(page, 'Insights');

    // Day scale shows hourly activity; week/month show daily
    // The activity strip header text reflects the current scale
    await expect(page.getByText(/Hourly|Last 7 Days|Last 30 Days/)).toBeVisible();
  });

  test('insights tab shows top clients section', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await switchTab(page, 'Insights');

    await expect(page.getByText('Top Clients')).toBeVisible();
    // claude-code is the most used client in seed data (sessions 001, 003, 004, 005, 008).
    // SummaryChips renders TOOL_DISPLAY_NAMES['claude-code'] = 'Claude Code', not the raw key.
    await expect(page.getByText('Claude Code').first()).toBeVisible();
  });

  test('insights improvement tips or success message is shown', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await switchTab(page, 'Insights');

    // ImprovementTips renders either "Improvement Tips" (for low scores) or a "great work" message.
    // Wait for the component to finish its motion animation before checking visibility.
    await page.waitForTimeout(500);
    const hasTips = await page.getByText('Improvement Tips').isVisible().catch(() => false);
    const hasGreatWork = await page.getByText(/great work/i).isVisible().catch(() => false);
    expect(hasTips || hasGreatWork).toBe(true);
  });
});
