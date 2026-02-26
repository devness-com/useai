import { test, expect } from '@playwright/test';
import { gotoWithMocks, createMockSession, createMockHealth, createMockUpdateInfo, createMockConfig } from './helpers';

test.describe('Header', () => {
  test('renders logo', async ({ page }) => {
    await gotoWithMocks(page);
    // The UseAILogo is an SVG inside the header
    await expect(page.locator('header svg').first()).toBeVisible();
  });

  test('search button is visible with keyboard hint', async ({ page }) => {
    await gotoWithMocks(page);
    const searchBtn = page.locator('header button', { has: page.locator('text=Search') });
    await expect(searchBtn).toBeVisible();
    // Should show ⌘K hint
    await expect(page.locator('header kbd')).toContainText('K');
  });

  test('clicking search button opens search overlay', async ({ page }) => {
    await gotoWithMocks(page);
    // Click the search button in header
    await page.locator('header button', { has: page.locator('text=Search') }).click();
    await page.waitForTimeout(300);
    // Search overlay should be visible — it has a search input with placeholder
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();
  });

  test('shows active sessions badge when health reports sessions', async ({ page }) => {
    await gotoWithMocks(page, {
      health: createMockHealth({ active_sessions: 2 }),
    });
    await expect(page.getByText('2 active sessions')).toBeVisible();
  });

  test('does not show active sessions badge when count is 0', async ({ page }) => {
    await gotoWithMocks(page, {
      health: createMockHealth({ active_sessions: 0 }),
    });
    await expect(page.getByText(/active session/)).not.toBeVisible();
  });

  test('tab switching between Sessions and Insights', async ({ page }) => {
    await gotoWithMocks(page);
    // Start on Sessions
    await expect(page.getByText('Activity Feed')).toBeVisible();

    // Switch to Insights
    await page.getByRole('button', { name: 'Insights' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('AI Proficiency')).toBeVisible();

    // Switch back to Sessions
    await page.getByRole('button', { name: 'Sessions' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Activity Feed')).toBeVisible();
  });
});

test.describe('Update Banner', () => {
  test('shows update banner when update is available', async ({ page }) => {
    await gotoWithMocks(page, {
      updateInfo: createMockUpdateInfo({
        current: '0.6.18',
        latest: '0.7.0',
        update_available: true,
      }),
    });
    await expect(page.getByText('v0.7.0 available')).toBeVisible();
  });

  test('does not show update banner when no update', async ({ page }) => {
    await gotoWithMocks(page, {
      updateInfo: createMockUpdateInfo({ update_available: false }),
    });
    await expect(page.getByText(/available/)).not.toBeVisible();
  });

  test('clicking update banner opens popover with version info', async ({ page }) => {
    await gotoWithMocks(page, {
      updateInfo: createMockUpdateInfo({
        current: '0.6.18',
        latest: '0.7.0',
        update_available: true,
      }),
    });
    await page.getByText('v0.7.0 available').click();
    await page.waitForTimeout(200);
    // Popover should show version info
    await expect(page.getByText('v0.6.18')).toBeVisible();
    await expect(page.getByText('npx -y @devness/useai update')).toBeVisible();
  });

  test('clicking copy button shows checkmark feedback', async ({ page }) => {
    // Mock clipboard API so writeText resolves in headless browser
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.resolve() },
        writable: true,
        configurable: true,
      });
    });
    await gotoWithMocks(page, {
      updateInfo: createMockUpdateInfo({
        current: '0.6.18',
        latest: '0.7.0',
        update_available: true,
      }),
    });
    // Open popover
    await page.getByText('v0.7.0 available').click();
    await page.waitForTimeout(200);
    // Click copy button (has title "Copy command")
    await page.locator('button[title="Copy command"]').click();
    // Should show a check icon (the component switches from Copy to Check icon)
    await page.waitForTimeout(200);
    // The check icon has class "text-success"
    await expect(page.locator('button[title="Copy command"] .text-success')).toBeVisible();
  });
});
