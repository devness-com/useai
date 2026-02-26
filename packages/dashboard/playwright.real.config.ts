import { defineConfig } from '@playwright/test';

/**
 * Playwright config for TRUE E2E tests.
 * Uses a real daemon with seeded data (not mocked APIs).
 *
 * Run: npx playwright test --config=playwright.real.config.ts
 */
export default defineConfig({
  testDir: './e2e-real',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // Run serially — delete tests mutate shared daemon state
  workers: 1,
  use: {
    baseURL: 'http://localhost:5175',
    headless: true,
    launchOptions: { slowMo: 50 },
    viewport: { width: 1280, height: 900 },
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  globalSetup: './e2e-real/global-setup.ts',
  globalTeardown: './e2e-real/global-teardown.ts',
  webServer: {
    command: 'npx vite --config vite.e2e.config.ts',
    port: 5175,
    reuseExistingServer: true,
    timeout: 15_000,
  },
  outputDir: './e2e-real/test-results',
  reporter: [['html', { open: 'never', outputFolder: './e2e-real/report' }]],
});
