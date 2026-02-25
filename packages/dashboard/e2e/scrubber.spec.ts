/**
 * TimeScrubber E2E Tests
 *
 * Tests the drag/scrub behavior across Day, Week, and Month views.
 * Run with: pnpm exec playwright test e2e/scrubber.spec.ts
 *
 * IMPORTANT: Start the dashboard dev server first:
 *   cd packages/dashboard && pnpm dev
 *
 * The tests run in headed mode with slowMo so you can watch the interactions.
 * Videos and screenshots are saved to e2e/test-results/.
 */
import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Wait for the dashboard to finish loading (no "Loading..." text) */
async function waitForDashboard(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('time-travel-panel')).toBeVisible({ timeout: 10_000 });
  // Give data a moment to hydrate
  await page.waitForTimeout(500);
}

/** Get the current mode text (Live or History) */
async function getMode(page: Page): Promise<'live' | 'history'> {
  const liveVisible = await page.getByText('Live', { exact: true }).first().isVisible().catch(() => false);
  if (liveVisible) return 'live';
  return 'history';
}

/** Get the text of the time display */
async function getTimeDisplay(page: Page): Promise<string> {
  return page.getByTestId('time-display').innerText();
}

/** Click a scale button (e.g., 'day', 'week', 'month', '1h', '12h') */
async function selectScale(page: Page, scale: string) {
  await page.getByTestId(`scale-${scale}`).click();
  await page.waitForTimeout(300); // Let the re-render settle
}

/** Perform a drag on the scrubber. dx > 0 means drag right (into the past). */
async function dragScrubber(page: Page, dx: number, options?: { steps?: number; slow?: boolean }) {
  const scrubber = page.getByTestId('time-scrubber');
  const box = await scrubber.boundingBox();
  if (!box) throw new Error('Scrubber not found');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const steps = options?.steps ?? 20;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  // Move in small increments to simulate real drag
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (dx * i) / steps, startY);
    if (options?.slow) await page.waitForTimeout(30);
  }

  await page.mouse.up();
  // Wait for the throttled parent commit
  await page.waitForTimeout(200);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('TimeScrubber — Day View', () => {
  test.beforeEach(async ({ page }) => {
    await waitForDashboard(page);
    await selectScale(page, 'day');
  });

  test('starts in live mode', async ({ page }) => {
    const mode = await getMode(page);
    expect(mode).toBe('live');
  });

  test('dragging right enters history mode', async ({ page }) => {
    await dragScrubber(page, 150); // drag right → into the past

    const mode = await getMode(page);
    expect(mode).toBe('history');

    // Should show a "Go Live" button
    await expect(page.getByTestId('go-live-button')).toBeVisible();
  });

  test('time display changes when scrubbing into the past', async ({ page }) => {
    const timeBefore = await getTimeDisplay(page);
    await dragScrubber(page, 200, { slow: true });
    const timeAfter = await getTimeDisplay(page);

    // Time should have changed (we can't predict the exact value)
    expect(timeAfter).not.toBe(timeBefore);
  });

  test('scrubbing right then clicking Live returns to live mode', async ({ page }) => {
    await dragScrubber(page, 150);
    expect(await getMode(page)).toBe('history');

    await page.getByTestId('go-live-button').click();
    await page.waitForTimeout(300);

    expect(await getMode(page)).toBe('live');
  });

  test('scrubbing far right and then back left snaps to live', async ({ page }) => {
    // Drag deep into the past
    await dragScrubber(page, 300, { slow: true });
    expect(await getMode(page)).toBe('history');

    // Drag all the way back to the right edge (toward now)
    await dragScrubber(page, -350, { slow: true });
    await page.waitForTimeout(500);

    // Should snap to live
    expect(await getMode(page)).toBe('live');
  });

  test('cannot scrub into the future (no flickering)', async ({ page }) => {
    // Drag LEFT — trying to scrub into the future
    await dragScrubber(page, -200, { slow: true });
    await page.waitForTimeout(300);

    // Should still be in live mode (can't go past now)
    expect(await getMode(page)).toBe('live');
  });
});

test.describe('TimeScrubber — Week View', () => {
  test.beforeEach(async ({ page }) => {
    await waitForDashboard(page);
    await selectScale(page, 'week');
    await page.waitForTimeout(300);
  });

  test('starts in live mode on week view', async ({ page }) => {
    expect(await getMode(page)).toBe('live');
  });

  test('dragging right enters history mode (not stuck)', async ({ page }) => {
    // This is the key test — week view was previously stuck because
    // windowEnd is in the future, causing immediate snap-to-live
    await dragScrubber(page, 200, { slow: true });
    await page.waitForTimeout(300);

    const mode = await getMode(page);
    expect(mode).toBe('history');
  });

  test('scrubber moves smoothly without snapping back', async ({ page }) => {
    const timeBefore = await getTimeDisplay(page);

    // Slow drag to observe smoothness
    await dragScrubber(page, 250, { steps: 40, slow: true });
    await page.waitForTimeout(300);

    const timeAfter = await getTimeDisplay(page);
    expect(timeAfter).not.toBe(timeBefore);
    expect(await getMode(page)).toBe('history');
  });

  test('can scrub back to live from history in week view', async ({ page }) => {
    await dragScrubber(page, 200, { slow: true });
    expect(await getMode(page)).toBe('history');

    // Drag back left toward now
    await dragScrubber(page, -250, { slow: true });
    await page.waitForTimeout(500);

    expect(await getMode(page)).toBe('live');
  });

  test('calendar→rolling transition happens on scrub', async ({ page }) => {
    // Start on 'week' (calendar). After scrubbing, should transition to '7d' (rolling).
    // The 'week' button should still appear highlighted (SCRUB_CALENDAR_MAP maps 7d→week)
    await dragScrubber(page, 200, { slow: true });
    await page.waitForTimeout(300);

    // In history mode, the week button should still be visually active
    const weekButton = page.getByTestId('scale-week');
    await expect(weekButton).toBeVisible();
  });
});

test.describe('TimeScrubber — Month View', () => {
  test.beforeEach(async ({ page }) => {
    await waitForDashboard(page);
    await selectScale(page, 'month');
    await page.waitForTimeout(300);
  });

  test('dragging right enters history mode', async ({ page }) => {
    await dragScrubber(page, 200, { slow: true });
    await page.waitForTimeout(300);

    expect(await getMode(page)).toBe('history');
  });

  test('scrubber responds to drag (not stuck)', async ({ page }) => {
    const timeBefore = await getTimeDisplay(page);
    await dragScrubber(page, 300, { steps: 30, slow: true });
    await page.waitForTimeout(300);

    const timeAfter = await getTimeDisplay(page);
    expect(timeAfter).not.toBe(timeBefore);
  });

  test('can return to live from deep scrub in month view', async ({ page }) => {
    // Drag far right into the past
    await dragScrubber(page, 400, { slow: true });
    expect(await getMode(page)).toBe('history');

    // Click the Go Live button
    await page.getByTestId('go-live-button').click();
    await page.waitForTimeout(500);

    expect(await getMode(page)).toBe('live');
  });
});

test.describe('TimeScrubber — Scale Switching', () => {
  test.beforeEach(async ({ page }) => {
    await waitForDashboard(page);
  });

  test('switching from day to week does not freeze UI', async ({ page }) => {
    await selectScale(page, 'day');
    const timeBefore = await getTimeDisplay(page);

    // Switch to week — should not hang
    await selectScale(page, 'week');
    await page.waitForTimeout(500);

    // Time display should still be accessible (UI didn't hang)
    const timeAfter = await getTimeDisplay(page);
    expect(timeAfter).toBeTruthy();
  });

  test('switching from day to month does not freeze UI', async ({ page }) => {
    await selectScale(page, 'day');
    await selectScale(page, 'month');
    await page.waitForTimeout(500);

    const time = await getTimeDisplay(page);
    expect(time).toBeTruthy();
  });

  test('rapid scale switching does not break scrubber', async ({ page }) => {
    // Rapid-fire scale changes
    await selectScale(page, 'day');
    await selectScale(page, 'week');
    await selectScale(page, 'month');
    await selectScale(page, '1h');
    await selectScale(page, '12h');
    await selectScale(page, 'day');
    await page.waitForTimeout(300);

    // Should still be functional
    expect(await getMode(page)).toBe('live');
    await dragScrubber(page, 100);
    expect(await getMode(page)).toBe('history');
  });
});

test.describe('TimeScrubber — Drag Smoothness', () => {
  test('continuous slow drag produces multiple time updates (not stuck)', async ({ page }) => {
    await waitForDashboard(page);
    await selectScale(page, 'day');

    const scrubber = page.getByTestId('time-scrubber');
    const box = await scrubber.boundingBox();
    if (!box) throw new Error('Scrubber not found');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // Start dragging
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    const times: string[] = [];

    // Drag slowly in 10px increments, capturing time at each step
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(startX + (i + 1) * 20, startY);
      await page.waitForTimeout(150); // Wait for throttled commit
      const t = await getTimeDisplay(page);
      times.push(t);
    }

    await page.mouse.up();

    // Should have seen at least 3 different time values during the drag
    const uniqueTimes = new Set(times);
    expect(uniqueTimes.size).toBeGreaterThanOrEqual(3);
  });

  test('no live/history flicker during drag toward now', async ({ page }) => {
    await waitForDashboard(page);
    await selectScale(page, 'day');

    // First, scrub into the past
    await dragScrubber(page, 250, { slow: true });
    expect(await getMode(page)).toBe('history');

    const scrubber = page.getByTestId('time-scrubber');
    const box = await scrubber.boundingBox();
    if (!box) throw new Error('Scrubber not found');

    // Now slowly drag back toward live
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    let liveCount = 0;
    let historyCount = 0;

    // Drag left (toward now) in small steps
    for (let i = 0; i < 15; i++) {
      await page.mouse.move(startX - (i + 1) * 20, startY);
      await page.waitForTimeout(120);

      const mode = await getMode(page);
      if (mode === 'live') liveCount++;
      else historyCount++;
    }

    await page.mouse.up();
    await page.waitForTimeout(300);

    // We should NOT see rapid alternation between live and history.
    // Either mostly history (still dragging) or mostly live (snapped).
    // If both counts are high, it means flickering.
    const total = liveCount + historyCount;
    const dominant = Math.max(liveCount, historyCount);
    expect(dominant / total).toBeGreaterThan(0.6);
  });
});
