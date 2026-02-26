import { test, expect } from '@playwright/test';
import { gotoWithMocks, createMockConfig, createMockSession } from './helpers';

test.describe('Profile Dropdown — Authenticated', () => {
  const authConfig = createMockConfig({
    authenticated: true,
    email: 'test@example.com',
    username: 'testuser',
    last_sync_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
  });

  test('shows avatar with first letter of email', async ({ page }) => {
    await gotoWithMocks(page, { config: authConfig });
    // Avatar should show "T" (first letter of test@example.com)
    await expect(page.locator('header').getByText('T', { exact: true }).first()).toBeVisible();
  });

  test('clicking avatar opens dropdown with email', async ({ page }) => {
    await gotoWithMocks(page, { config: authConfig });
    // Click the avatar area (the button with the letter)
    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    // Email should be visible in dropdown
    await expect(page.getByText('test@example.com')).toBeVisible();
  });

  test('shows last sync time', async ({ page }) => {
    await gotoWithMocks(page, { config: authConfig });
    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await expect(page.getByText(/Last sync:/)).toBeVisible();
    await expect(page.getByText('1m ago')).toBeVisible();
  });

  test('shows "Never synced" when no last_sync_at', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({
        authenticated: true,
        email: 'test@example.com',
        username: 'testuser',
        last_sync_at: null,
      }),
    });
    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await expect(page.getByText('Never synced')).toBeVisible();
  });

  test('sync button triggers sync and shows success message', async ({ page }) => {
    // In Vite dev mode, postSync() checks localStorage for a token before calling cloud-api endpoints.
    // Set the token before page load so the sync path is taken instead of throwing "Not authenticated".
    await page.addInitScript(() => {
      localStorage.setItem('useai_dev_token', 'test-token');
      localStorage.setItem('useai_dev_email', 'test@example.com');
      localStorage.setItem('useai_dev_username', 'testuser');
    });
    await gotoWithMocks(page, { config: authConfig });
    // In dev mode, sync calls /cloud-api/api/sync and /cloud-api/api/publish (not /api/local/sync)
    await page.route('**/cloud-api/api/sync', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    await page.route('**/cloud-api/api/publish', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );

    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.getByText('Sync', { exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Synced!')).toBeVisible();
  });

  test('sign out returns to unauthenticated state', async ({ page }) => {
    let loggedOut = false;
    await gotoWithMocks(page, { config: authConfig });
    await page.route('**/api/local/auth/logout', (route) => {
      loggedOut = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    // After logout, config should return unauthenticated
    await page.route('**/api/local/config', (route) => {
      if (loggedOut) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMockConfig({ authenticated: false })) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authConfig) });
    });

    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.getByText('Sign out').click();
    await page.waitForTimeout(500);
    // Should return to Sign in state
    await expect(page.getByText('Sign in')).toBeVisible();
  });
});

test.describe('Username Management', () => {
  test('shows username claim input when no username', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({
        authenticated: true,
        email: 'test@example.com',
        username: null,
      }),
    });
    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    // Should see the username input and "Claim" button
    await expect(page.getByPlaceholder('username')).toBeVisible();
    await expect(page.getByText('Claim')).toBeVisible();
  });

  test('shows profile link when has username', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({
        authenticated: true,
        email: 'test@example.com',
        username: 'testuser',
      }),
    });
    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await expect(page.getByText('useai.dev/testuser')).toBeVisible();
  });

  test('clicking edit pencil enters edit mode', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({
        authenticated: true,
        email: 'test@example.com',
        username: 'testuser',
      }),
    });
    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    // Click pencil button (title="Edit username")
    await page.locator('button[title="Edit username"]').click();
    await page.waitForTimeout(200);
    // Should show input with current username
    await expect(page.getByPlaceholder('username')).toBeVisible();
    await expect(page.getByText('Save')).toBeVisible();
    await expect(page.getByText('Cancel')).toBeVisible();
  });

  test('username validation rejects short usernames', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({
        authenticated: true,
        email: 'test@example.com',
        username: null,
      }),
    });
    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('username').fill('ab');
    await page.waitForTimeout(500);
    // Should show "At least 3 characters" error
    await expect(page.getByText('At least 3 characters')).toBeVisible();
  });

  test('username availability checking shows available status', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({
        authenticated: true,
        email: 'test@example.com',
        username: null,
      }),
    });
    await page.route('**/check-username/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) })
    );

    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('username').fill('newuser');
    // Wait for debounce (400ms) + API response
    await page.waitForTimeout(800);
    // Claim button should be enabled
    const claimBtn = page.locator('button', { hasText: 'Claim' });
    await expect(claimBtn).toBeEnabled();
  });

  test('username availability checking shows taken status', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({
        authenticated: true,
        email: 'test@example.com',
        username: null,
      }),
    });
    await page.route('**/check-username/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false, reason: 'Already taken' }) })
    );

    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('username').fill('taken');
    await page.waitForTimeout(800);
    // Should show error and disable button
    await expect(page.getByText('Already taken')).toBeVisible();
    const claimBtn = page.locator('button', { hasText: 'Claim' });
    await expect(claimBtn).toBeDisabled();
  });

  test('claiming username calls API and refreshes', async ({ page }) => {
    // In Vite dev mode, updateUsername() checks localStorage for a token before calling cloud-api.
    // Set the token before page load. Use empty string for username so the initial state shows no username.
    await page.addInitScript(() => {
      localStorage.setItem('useai_dev_token', 'test-token');
      localStorage.setItem('useai_dev_email', 'test@example.com');
      localStorage.setItem('useai_dev_username', '');
    });
    await gotoWithMocks(page, {
      config: createMockConfig({
        authenticated: true,
        email: 'test@example.com',
        username: null,
      }),
    });
    await page.route('**/check-username/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) })
    );
    // In dev mode, updateUsername() calls PATCH /cloud-api/api/users/me and then stores the username in localStorage.
    // After that, onRefresh() -> fetchConfig() reads the updated localStorage value.
    await page.route('**/cloud-api/api/users/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'newuser' }) })
    );

    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('username').fill('newuser');
    await page.waitForTimeout(800);
    await page.locator('button', { hasText: 'Claim' }).click();
    await page.waitForTimeout(500);
    // After refresh, should show the profile link
    await expect(page.getByText('useai.dev/newuser')).toBeVisible();
  });

  test('cancel button exits edit mode', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({
        authenticated: true,
        email: 'test@example.com',
        username: 'testuser',
      }),
    });
    await page.locator('header').getByText('T', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.locator('button[title="Edit username"]').click();
    await page.waitForTimeout(200);
    await page.getByText('Cancel').click();
    await page.waitForTimeout(200);
    // Should show the profile link again
    await expect(page.getByText('useai.dev/testuser')).toBeVisible();
  });
});
