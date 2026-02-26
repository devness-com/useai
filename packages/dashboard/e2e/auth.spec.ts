import { test, expect } from '@playwright/test';
import { gotoWithMocks, setupMockAPI, createMockConfig, createMockHealth, createMockUpdateInfo, createMockSession } from './helpers';

test.describe('Authentication Flow', () => {
  test('shows Sign in button when not authenticated', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await expect(page.getByText('Sign in')).toBeVisible();
  });

  test('clicking Sign in opens dropdown with email input', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await expect(page.getByPlaceholder('you@email.com')).toBeVisible();
    await expect(page.getByText('Send')).toBeVisible();
  });

  test('Send button is disabled without valid email', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    // Type text without @
    await page.getByPlaceholder('you@email.com').fill('noemail');
    const sendBtn = page.locator('button', { hasText: 'Send' });
    await expect(sendBtn).toBeDisabled();
  });

  test('entering email and clicking Send shows OTP step', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    // Mock the send-otp endpoint
    await page.route('**/auth/send-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'OTP sent' }) })
    );

    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('you@email.com').fill('test@example.com');
    await page.locator('button', { hasText: 'Send' }).click();
    await page.waitForTimeout(500);
    // Should show OTP input
    await expect(page.getByPlaceholder('000000')).toBeVisible();
    await expect(page.getByText('Verify')).toBeVisible();
  });

  test('pressing Enter in email field submits', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await page.route('**/auth/send-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'OTP sent' }) })
    );

    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('you@email.com').fill('test@example.com');
    await page.getByPlaceholder('you@email.com').press('Enter');
    await page.waitForTimeout(500);
    await expect(page.getByPlaceholder('000000')).toBeVisible();
  });

  test('entering valid OTP and clicking Verify authenticates', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    // Mock auth endpoints
    await page.route('**/auth/send-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'OTP sent' }) })
    );
    await page.route('**/auth/verify-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'test-token', user: { id: '1', email: 'test@example.com' } }) })
    );
    // After verification, config endpoint should return authenticated
    let verified = false;
    await page.route('**/api/local/config', (route) => {
      if (verified) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMockConfig({ authenticated: true, email: 'test@example.com' })) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMockConfig({ authenticated: false })) });
    });

    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('you@email.com').fill('test@example.com');
    await page.locator('button', { hasText: 'Send' }).click();
    await page.waitForTimeout(500);

    await page.getByPlaceholder('000000').fill('123456');
    verified = true;
    await page.locator('button', { hasText: 'Verify' }).click();
    await page.waitForTimeout(500);

    // Dropdown should close, "Sign in" should no longer be visible
    // Avatar (first letter of email 'T') should appear instead
    await expect(page.getByText('Sign in')).not.toBeVisible();
  });

  test('pressing Enter in OTP field submits', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await page.route('**/auth/send-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'OTP sent' }) })
    );
    await page.route('**/auth/verify-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'test-token', user: { id: '1', email: 'test@example.com' } }) })
    );

    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('you@email.com').fill('test@example.com');
    await page.locator('button', { hasText: 'Send' }).click();
    await page.waitForTimeout(500);

    await page.getByPlaceholder('000000').fill('123456');
    await page.getByPlaceholder('000000').press('Enter');
    await page.waitForTimeout(500);
    await expect(page.getByText('Sign in')).not.toBeVisible();
  });

  test('shows error on failed OTP verification', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await page.route('**/auth/send-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'OTP sent' }) })
    );
    await page.route('**/auth/verify-otp', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid code' }) })
    );

    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('you@email.com').fill('test@example.com');
    await page.locator('button', { hasText: 'Send' }).click();
    await page.waitForTimeout(500);

    await page.getByPlaceholder('000000').fill('000000');
    await page.locator('button', { hasText: 'Verify' }).click();
    await page.waitForTimeout(500);

    // Error message should be visible
    await expect(page.getByText('Invalid code')).toBeVisible();
  });

  test('Escape closes dropdown', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await expect(page.getByPlaceholder('you@email.com')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // Email input should no longer be visible (dropdown closed)
    await expect(page.getByPlaceholder('you@email.com')).not.toBeVisible();
  });

  test('click outside closes dropdown', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await expect(page.getByPlaceholder('you@email.com')).toBeVisible();

    // Click on the main dashboard area (outside the dropdown)
    await page.getByTestId('time-travel-panel').click({ force: true });
    await page.waitForTimeout(200);
    await expect(page.getByPlaceholder('you@email.com')).not.toBeVisible();
  });

  test('Verify button is disabled with less than 6 digits', async ({ page }) => {
    await gotoWithMocks(page, {
      config: createMockConfig({ authenticated: false }),
    });
    await page.route('**/auth/send-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'OTP sent' }) })
    );

    await page.getByText('Sign in').click();
    await page.waitForTimeout(200);
    await page.getByPlaceholder('you@email.com').fill('test@example.com');
    await page.locator('button', { hasText: 'Send' }).click();
    await page.waitForTimeout(500);

    await page.getByPlaceholder('000000').fill('123');
    const verifyBtn = page.locator('button', { hasText: 'Verify' });
    await expect(verifyBtn).toBeDisabled();
  });
});
