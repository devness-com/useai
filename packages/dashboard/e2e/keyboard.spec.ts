import { test, expect } from '@playwright/test';
import { gotoWithMocks, createMockSession, createMockConfig, getMode, getTimeDisplay } from './helpers';

test.describe('Keyboard Shortcuts', () => {
  test('Cmd+K opens search overlay', async ({ page }) => {
    await gotoWithMocks(page);
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();
  });

  test('Cmd+K again closes search overlay', async ({ page }) => {
    await gotoWithMocks(page);
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();

    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).not.toBeVisible();
  });

  test('Escape closes search overlay', async ({ page }) => {
    await gotoWithMocks(page);
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).not.toBeVisible();
  });

  test('Escape closes profile dropdown', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await expect(page.getByPlaceholder('you@email.com')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.getByPlaceholder('you@email.com')).not.toBeVisible();
  });

  test('Escape cancels time edit and returns to live', async ({ page }) => {
    await gotoWithMocks(page);
    expect(await getMode(page)).toBe('live');

    // Click time display to start editing
    await page.getByTestId('time-display').click();
    await page.waitForTimeout(200);

    // Time input should be visible (it's an input element)
    const timeInput = page.locator('input[type="text"]').first();
    await expect(timeInput).toBeVisible();

    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Should return to live mode (time display, not input)
    expect(await getMode(page)).toBe('live');
  });

  test('Enter confirms time edit', async ({ page }) => {
    await gotoWithMocks(page);

    // Click time display to start editing
    await page.getByTestId('time-display').click();
    await page.waitForTimeout(200);

    const timeInput = page.locator('input[type="text"]').first();
    await expect(timeInput).toBeVisible();

    // Type a time value
    await timeInput.fill('02:30:00 PM');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Should be in history mode now (since we set a specific time)
    expect(await getMode(page)).toBe('history');
  });

  test('Arrow keys adjust time in edit mode', async ({ page }) => {
    await gotoWithMocks(page);

    // Click time display to start editing
    await page.getByTestId('time-display').click();
    await page.waitForTimeout(200);

    const timeInput = page.locator('input[type="text"]').first();
    await expect(timeInput).toBeVisible();

    const valueBefore = await timeInput.inputValue();

    // Press Arrow Up (should increment based on cursor position)
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);

    const valueAfter = await timeInput.inputValue();
    // Value should have changed
    expect(valueAfter).not.toBe(valueBefore);
  });
});
