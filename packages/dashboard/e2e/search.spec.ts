import { test, expect } from '@playwright/test';
import { gotoWithMocks, createMockSession, createMockMilestone } from './helpers';

test.describe('Search Overlay', () => {
  const sessions = [
    createMockSession({ session_id: 'sess-1', private_title: 'Fix authentication bug', title: 'Fix auth', languages: ['typescript'] }),
    createMockSession({ session_id: 'sess-2', private_title: 'Add dashboard charts', title: 'Add charts', languages: ['javascript'], started_at: new Date(Date.now() - 3600_000).toISOString() }),
    createMockSession({ session_id: 'sess-3', private_title: 'Database migration', title: 'DB migration', languages: ['sql', 'typescript'], started_at: new Date(Date.now() - 7200_000).toISOString() }),
  ];
  const milestones = [
    createMockMilestone({ session_id: 'sess-1', title: 'Auth feature', private_title: 'JWT auth implementation' }),
  ];

  test('Cmd+K opens search overlay', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();
  });

  test('Ctrl+K opens search overlay', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();
  });

  test('search input auto-focuses on open', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    // Input should be focused
    const input = page.getByPlaceholder(/Search/);
    await expect(input).toBeFocused();
  });

  test('shows empty state before typing', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByText('Type to search across all sessions')).toBeVisible();
  });

  test('typing query shows debounced results', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    await page.getByPlaceholder(/Search/).fill('authentication');
    // Wait for debounce (250ms)
    await page.waitForTimeout(500);

    // Scope assertions to the search overlay panel (z-[61] fixed container)
    const searchOverlay = page.locator('.fixed').filter({ has: page.getByPlaceholder(/Search/) });

    // Should show result count
    await expect(page.getByText('1 result')).toBeVisible();
    // Should show matching session (scoped to overlay to avoid duplicate matches in session list)
    await expect(searchOverlay.getByText('Fix authentication bug').first()).toBeVisible();
  });

  test('search matches by language', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    await page.getByPlaceholder(/Search/).fill('sql');
    await page.waitForTimeout(500);

    // Scope assertions to the search overlay panel (z-[61] fixed container)
    const searchOverlay = page.locator('.fixed').filter({ has: page.getByPlaceholder(/Search/) });

    await expect(page.getByText('1 result')).toBeVisible();
    // Should show matching session (scoped to overlay to avoid duplicate matches in session list)
    await expect(searchOverlay.getByText('Database migration').first()).toBeVisible();
  });

  test('shows no results message for non-matching query', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    await page.getByPlaceholder(/Search/).fill('zzz-no-match');
    await page.waitForTimeout(500);

    await expect(page.getByText(/No results for/)).toBeVisible();
  });

  test('clear button clears query but keeps overlay open', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    await page.getByPlaceholder(/Search/).fill('auth');
    await page.waitForTimeout(500);

    // Click the clear (X) button
    // The X button appears after query is typed, positioned near the input
    await page.locator('.fixed button').filter({ has: page.locator('svg') }).first().click();
    await page.waitForTimeout(300);

    // Overlay should still be open
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();
    // Should return to empty state
    await expect(page.getByText('Type to search across all sessions')).toBeVisible();
  });

  test('Escape closes overlay', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).not.toBeVisible();
  });

  test('clicking backdrop closes overlay', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    // Click the backdrop
    await page.locator('.fixed.bg-black\\/40').click({ force: true });
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).not.toBeVisible();
  });

  test('Cmd+K toggles overlay closed', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();

    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/Search/)).not.toBeVisible();
  });

  test('public/private toggle changes search scope', async ({ page }) => {
    await gotoWithMocks(page, { sessions, milestones });
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    // Search for private title
    await page.getByPlaceholder(/Search/).fill('authentication');
    await page.waitForTimeout(500);
    await expect(page.getByText('1 result')).toBeVisible();

    // Toggle to public mode
    // The Eye/EyeOff button is in the search bar (title="Searching private titles" or "Searching public titles")
    await page.locator('button[title="Searching private titles"]').click();
    await page.waitForTimeout(500);

    // "authentication" is only in private_title, not in public title "Fix auth"
    // So with public search, it should not match
    await expect(page.getByText(/No results/)).toBeVisible();
  });
});
