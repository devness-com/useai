import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:5174',
    // Headed mode by default so you can watch the tests
    headless: false,
    // Slow down actions so scrub behavior is visible
    launchOptions: { slowMo: 50 },
    viewport: { width: 1280, height: 900 },
    video: 'on',
    screenshot: 'on',
    trace: 'on',
  },
  // Don't auto-start the dev server — you run it yourself
  webServer: undefined,
  outputDir: './e2e/test-results',
  reporter: [['html', { open: 'never', outputFolder: './e2e/report' }]],
});
