import { test, expect } from '@playwright/test';
import { gotoWithMocks, createMockSession, createMockMilestone, createMockConversation } from './helpers';

test.describe('Delete Flows', () => {
  test('delete button shows trash icon initially', async ({ page }) => {
    const sessions = [createMockSession({ session_id: 'sess-1' })];
    await gotoWithMocks(page, { sessions });
    // Hover over the session card to reveal the delete button
    await page.locator('.group\\/card').first().hover();
    await page.waitForTimeout(200);
    const trashBtn = page.locator('button[title="Delete"]').first();
    await expect(trashBtn).toBeVisible();
  });

  test('clicking trash enters confirm mode', async ({ page }) => {
    const sessions = [createMockSession({ session_id: 'sess-1' })];
    await gotoWithMocks(page, { sessions });
    await page.locator('.group\\/card').first().hover();
    await page.waitForTimeout(200);

    await page.locator('button[title="Delete"]').first().click();
    await page.waitForTimeout(200);

    // Should show confirm and cancel buttons
    await expect(page.locator('button[title="Confirm delete"]').first()).toBeVisible();
    await expect(page.locator('button[title="Cancel"]').first()).toBeVisible();
  });

  test('clicking cancel exits confirm mode', async ({ page }) => {
    const sessions = [createMockSession({ session_id: 'sess-1' })];
    await gotoWithMocks(page, { sessions });
    await page.locator('.group\\/card').first().hover();
    await page.waitForTimeout(200);

    await page.locator('button[title="Delete"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('button[title="Cancel"]').first().click();
    await page.waitForTimeout(200);

    // Should return to trash icon
    await expect(page.locator('button[title="Delete"]').first()).toBeVisible();
  });

  test('confirm mode auto-reverts after 5 seconds', async ({ page }) => {
    const sessions = [createMockSession({ session_id: 'sess-1' })];
    await gotoWithMocks(page, { sessions });
    await page.locator('.group\\/card').first().hover();
    await page.waitForTimeout(200);

    await page.locator('button[title="Delete"]').first().click();
    await page.waitForTimeout(200);
    await expect(page.locator('button[title="Confirm delete"]').first()).toBeVisible();

    // Wait 5.5 seconds
    await page.waitForTimeout(5500);

    // Should revert to trash
    await page.locator('.group\\/card').first().hover();
    await expect(page.locator('button[title="Delete"]').first()).toBeVisible();
  });

  test('confirming delete removes session from list', async ({ page }) => {
    const sessions = [
      createMockSession({ session_id: 'sess-1', private_title: 'Session to delete' }),
      createMockSession({ session_id: 'sess-2', private_title: 'Session to keep', started_at: new Date(Date.now() - 3600_000).toISOString() }),
    ];
    await gotoWithMocks(page, { sessions });
    await page.route('**/api/local/sessions/sess-1', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: true, session_id: 'sess-1', milestones_removed: 0 }) })
    );

    await expect(page.getByText('Session to delete')).toBeVisible();

    // Hover and delete
    await page.locator('.group\\/card').first().hover();
    await page.waitForTimeout(200);
    await page.locator('button[title="Delete"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('button[title="Confirm delete"]').first().click();
    await page.waitForTimeout(500);

    // Session should be removed (optimistic update)
    await expect(page.getByText('Session to delete')).not.toBeVisible();
    // Other session should remain
    await expect(page.getByText('Session to keep')).toBeVisible();
  });

  test('deleting conversation removes all grouped sessions', async ({ page }) => {
    const convSessions = createMockConversation(3);
    const standalone = createMockSession({ session_id: 'sess-standalone', private_title: 'Standalone session' });
    await gotoWithMocks(page, { sessions: [...convSessions, standalone] });

    const convId = convSessions[0]!.conversation_id;
    await page.route(`**/api/local/conversations/${convId}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: true, conversation_id: convId, sessions_removed: 3, milestones_removed: 0 }) })
    );

    // Should see the conversation (3 prompts badge)
    await expect(page.getByText('3 prompts')).toBeVisible();

    // Hover and delete the conversation
    await page.locator('.group\\/conv').first().hover();
    await page.waitForTimeout(200);
    await page.locator('.group\\/conv button[title="Delete"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('button[title="Confirm delete"]').first().click();
    await page.waitForTimeout(500);

    // Conversation should be removed
    await expect(page.getByText('3 prompts')).not.toBeVisible();
    // Standalone should remain
    await expect(page.getByText('Standalone session')).toBeVisible();
  });
});
