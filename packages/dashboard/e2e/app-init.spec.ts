import { test, expect } from '@playwright/test';
import { gotoWithMocks, setupMockAPI, createMockSession, createMockMilestone, createMockConfig, createMockHealth, createMockUpdateInfo } from './helpers';

test.describe('App Initialization', () => {
  test('shows loading state before data loads', async ({ page }) => {
    // Don't set up mocks so fetch will hang/fail, check for "Loading..." text
    // Use a delayed route to catch the loading state
    await page.route('**/api/local/sessions', async (route) => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/local/milestones', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/local/config', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMockConfig()) })
    );
    await page.route('**/health', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMockHealth()) })
    );
    await page.route('**/api/local/update-check', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMockUpdateInfo()) })
    );
    await page.goto('/');
    await expect(page.getByText('Loading...')).toBeVisible({ timeout: 2000 });
  });

  test('renders dashboard with header and time travel panel after loading', async ({ page }) => {
    await gotoWithMocks(page);
    await expect(page.getByTestId('time-travel-panel')).toBeVisible();
    // Header should be visible (contains the logo SVG and tab bar)
    await expect(page.locator('header')).toBeVisible();
  });

  test('starts in live mode on day scale by default', async ({ page }) => {
    await gotoWithMocks(page);
    // Should show live badge (no go-live button means live mode)
    const goLiveVisible = await page.getByTestId('go-live-button').isVisible().catch(() => false);
    expect(goLiveVisible).toBe(false);
    // Day scale button should be active
    const dayBtn = page.getByTestId('scale-day');
    await expect(dayBtn).toBeVisible();
  });

  test('sessions tab is active by default', async ({ page }) => {
    await gotoWithMocks(page);
    // "Activity Feed" heading appears only on sessions tab
    await expect(page.getByText('Activity Feed')).toBeVisible();
  });

  test('persists active tab across reload', async ({ page }) => {
    await gotoWithMocks(page);
    // Switch to Insights tab
    await page.getByRole('button', { name: 'Insights' }).click();
    await page.waitForTimeout(300);
    // Verify insights content is shown
    await expect(page.getByText('AI Proficiency')).toBeVisible();
    // Reload page
    await page.reload();
    await expect(page.getByTestId('time-travel-panel')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    // Should still be on Insights tab
    await expect(page.getByText('AI Proficiency')).toBeVisible();
  });
});
