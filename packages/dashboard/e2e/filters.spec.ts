import { test, expect } from '@playwright/test';
import { gotoWithMocks, createMockSession } from './helpers';

test.describe('Filters', () => {
  const sessions = [
    createMockSession({ session_id: 'sess-1', client: 'claude-code', languages: ['typescript'], project: 'project-a', private_title: 'Claude session' }),
    createMockSession({ session_id: 'sess-2', client: 'cursor', languages: ['python'], project: 'project-b', private_title: 'Cursor session', started_at: new Date(Date.now() - 1800_000).toISOString() }),
    createMockSession({ session_id: 'sess-3', client: 'claude-code', languages: ['typescript', 'python'], project: 'project-a', private_title: 'Another Claude session', started_at: new Date(Date.now() - 3600_000).toISOString() }),
  ];

  test('filters are hidden by default', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    // Filter chips should not be visible
    await expect(page.getByText('All', { exact: true })).not.toBeVisible();
  });

  test('clicking Filters button shows filter chips', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);
    // "All" chip should be visible
    await expect(page.getByText('All', { exact: true })).toBeVisible();
  });

  test('clicking Filters button again hides filter chips', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Hide filters' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('All', { exact: true })).not.toBeVisible();
  });

  test('shows client chips from session data', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);
    // Should show "Claude Code" and "Cursor" chips (TOOL_DISPLAY_NAMES)
    // Use getByRole('button') to target filter chip buttons specifically
    await expect(page.getByRole('button', { name: 'Claude Code', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cursor', exact: true })).toBeVisible();
  });

  test('shows language chips from session data', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('typescript')).toBeVisible();
    await expect(page.getByText('python')).toBeVisible();
  });

  test('shows project chips from session data', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);
    // Use getByRole('button') to target filter chip buttons specifically
    await expect(page.getByRole('button', { name: 'project-a', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'project-b', exact: true })).toBeVisible();
  });

  test('clicking client chip filters sessions', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Click "Cursor" filter chip button specifically
    await page.getByRole('button', { name: 'Cursor', exact: true }).click();
    await page.waitForTimeout(300);

    // Cursor session should be visible
    await expect(page.getByText('Cursor session', { exact: true })).toBeVisible();
    // Claude sessions should be hidden (filtered out)
    await expect(page.getByText('Claude session', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Another Claude session', { exact: true })).not.toBeVisible();
  });

  test('clicking same chip again deselects (back to All)', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Activate Cursor filter chip button specifically
    await page.getByRole('button', { name: 'Cursor', exact: true }).click();
    await page.waitForTimeout(300);
    // Claude sessions should be hidden when Cursor filter is active
    await expect(page.getByText('Claude session', { exact: true })).not.toBeVisible();

    // Click again to deactivate — all sessions should show again
    await page.getByRole('button', { name: 'Cursor', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Claude session', { exact: true })).toBeVisible();
    await expect(page.getByText('Cursor session', { exact: true })).toBeVisible();
    await expect(page.getByText('Another Claude session', { exact: true })).toBeVisible();
  });

  test('clicking All chip resets all filters', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    await page.getByRole('button', { name: 'Show filters' }).click();
    await page.waitForTimeout(300);

    // Activate a client filter chip button specifically
    await page.getByRole('button', { name: 'Cursor', exact: true }).click();
    await page.waitForTimeout(300);
    // Claude sessions should be hidden
    await expect(page.getByText('Claude session', { exact: true })).not.toBeVisible();

    // Click All chip to reset — all sessions should show again
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Claude session', { exact: true })).toBeVisible();
    await expect(page.getByText('Cursor session', { exact: true })).toBeVisible();
    await expect(page.getByText('Another Claude session', { exact: true })).toBeVisible();
  });

  test('public/private toggle switches session titles', async ({ page }) => {
    await gotoWithMocks(page, { sessions });
    // Default is private — "Claude session" is an exact title of sess-1
    await expect(page.getByText('Claude session', { exact: true })).toBeVisible();

    // Toggle to public
    await page.getByRole('button', { name: 'Switch to public titles' }).click();
    await page.waitForTimeout(300);

    // Should show public titles ("Test session public" from createMockSession default)
    await expect(page.getByText('Test session public').first()).toBeVisible();
  });
});
