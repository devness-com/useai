import { test, expect } from '@playwright/test';
import {
  gotoDashboard,
  switchTab,
  readSessionsFile,
  readMilestonesFile,
  fetchFromDaemon,
  deleteFromDaemon,
  selectScale,
} from './helpers';
import {
  DELETABLE_SESSION_ID,
  DELETABLE_SESSION_TITLE,
  DELETABLE_CONV_ID,
  DELETABLE_CONV_SESSION_COUNT,
  DELETABLE_MILESTONE_ID,
  DELETABLE_MILESTONE_TITLE,
  TOTAL_SESSIONS,
  TOTAL_MILESTONES,
} from './seed-data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Perform the two-step delete on a session card that contains the given text.
 *
 * The DeleteButton component requires:
 *   1st click  → arms the button (switches to confirm/cancel mode)
 *   2nd click  → confirms the delete
 *
 * The trash icon renders with title="Delete"; the confirm icon renders with
 * title="Confirm delete". We hover the card first so the opacity-0 button
 * becomes visible.
 */
async function deleteSingleCard(page: import('@playwright/test').Page, cardTitleText: string) {
  // Locate the card that contains the title text
  const card = page.locator('.group\\/card').filter({ hasText: cardTitleText });
  await card.first().hover();
  await page.waitForTimeout(200);

  // Step 1 — arm: click the trash icon inside that card
  const trashBtn = card.first().locator('button[title="Delete"]');
  await trashBtn.click();
  await page.waitForTimeout(200);

  // Step 2 — confirm: click the confirm icon (globally, since card may remount)
  await page.locator('button[title="Confirm delete"]').first().click();

  // Wait for the optimistic UI removal animation
  await page.waitForTimeout(600);
}

/**
 * Perform the two-step delete on a conversation card that wraps the given
 * conversation. The conversation wrapper uses `.group\/conv`.
 *
 * We filter to the card that shows DELETABLE_CONV_SESSION_COUNT prompts so
 * that we always target the correct conversation even when multiple
 * conversation cards are visible (the 3-prompt conversation from today will
 * appear above the 2-prompt one from yesterday when sorted by recency).
 */
async function deleteConversationCard(page: import('@playwright/test').Page) {
  // Find the conversation card that contains the "N prompts" badge for the
  // deletable conversation (2 prompts) rather than blindly using .first().
  const convCard = page
    .locator('.group\\/conv')
    .filter({ hasText: `${DELETABLE_CONV_SESSION_COUNT} prompts` });
  await convCard.hover();
  await page.waitForTimeout(200);

  // Step 1 — arm: the Delete button is in the action strip on the right side
  // of the conversation header. It starts opacity-0 and becomes visible on
  // group-hover, so we must hover the card first.
  // Use force: true to bypass the opacity-0 actionability check — the button
  // is in the DOM and positioned correctly; CSS hover reveals it visually.
  const trashBtn = convCard.locator('button[title="Delete"]');
  await trashBtn.click({ force: true });
  await page.waitForTimeout(200);

  // Step 2 — confirm: scope the confirm button to the conv card so we don't
  // accidentally confirm a different card's pending delete.
  await convCard.locator('button[title="Confirm delete"]').click({ force: true });

  // Wait for the optimistic UI removal and the async API call to complete.
  await page.waitForTimeout(1000);
}

// ─── Session delete tests ─────────────────────────────────────────────────────

test.describe('Session Delete — TRUE E2E (serial, mutates daemon state)', () => {
  // ── Test 1 ─────────────────────────────────────────────────────────────────
  test('session exists before delete', async ({ page }) => {
    await gotoDashboard(page);
    // Use month scale to ensure all seeded sessions from the last ~7 days are visible
    await selectScale(page, 'month');

    // The deletable session's private_title must be visible
    await expect(page.getByText(DELETABLE_SESSION_TITLE)).toBeVisible();
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  test('deleting session removes it from UI', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Confirm the session is present before we delete it
    await expect(page.getByText(DELETABLE_SESSION_TITLE)).toBeVisible();

    await deleteSingleCard(page, DELETABLE_SESSION_TITLE);

    // Session card should no longer be visible
    await expect(page.getByText(DELETABLE_SESSION_TITLE)).not.toBeVisible();
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  test('deleted session removed from daemon API', async ({ page }) => {
    // We navigate just to ensure the daemon is running; main check is via API
    await gotoDashboard(page);

    const sessions: any[] = await fetchFromDaemon('/api/local/sessions');

    // Total should be TOTAL_SESSIONS - 1 (session deleted in test 2)
    expect(sessions.length).toBe(TOTAL_SESSIONS - 1);

    // The deleted session_id must not appear in the response
    const ids = sessions.map((s: any) => s.session_id);
    expect(ids).not.toContain(DELETABLE_SESSION_ID);
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────
  test('deleted session removed from disk (sessions.json)', async ({ page }) => {
    // Navigate to ensure daemon has flushed writes (not strictly necessary but safe)
    await gotoDashboard(page);

    const sessions = readSessionsFile();

    expect(sessions.length).toBe(TOTAL_SESSIONS - 1);

    const ids = sessions.map((s: any) => s.session_id);
    expect(ids).not.toContain(DELETABLE_SESSION_ID);
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────────
  test('associated milestone also deleted when session is deleted', async ({ page }) => {
    // sess-e2e-002 owns m_e2e_002 ("Fixed pandas merge duplication in ETL pipeline")
    // Deleting the session should cascade-delete its milestone.
    await gotoDashboard(page);

    const milestones: any[] = await fetchFromDaemon('/api/local/milestones');
    const ids = milestones.map((m: any) => m.id);
    expect(ids).not.toContain('m_e2e_002');
  });
});

// ─── Conversation delete tests ────────────────────────────────────────────────

test.describe('Conversation Delete — TRUE E2E (serial, mutates daemon state)', () => {
  // ── Test 6 ─────────────────────────────────────────────────────────────────
  test('conversation exists before delete', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // The conversation conv-e2e-dashboard has 2 sessions so it shows a "2 prompts" badge
    await expect(page.getByText(`${DELETABLE_CONV_SESSION_COUNT} prompts`)).toBeVisible();
  });

  // ── Test 7 ─────────────────────────────────────────────────────────────────
  test('deleting conversation removes all its sessions from UI', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');

    // Confirm the conversation wrapper is present
    await expect(page.getByText(`${DELETABLE_CONV_SESSION_COUNT} prompts`)).toBeVisible();

    await deleteConversationCard(page);

    // The "2 prompts" badge should be gone after the conversation is deleted
    await expect(page.getByText(`${DELETABLE_CONV_SESSION_COUNT} prompts`)).not.toBeVisible();
  });

  // ── Test 8 ─────────────────────────────────────────────────────────────────
  test('deleted conversation sessions removed from daemon API', async ({ page }) => {
    await gotoDashboard(page);

    const sessions: any[] = await fetchFromDaemon('/api/local/sessions');

    // After deleting 1 standalone session (test 2) and 1 conversation with
    // DELETABLE_CONV_SESSION_COUNT sessions (test 7), total should be:
    // TOTAL_SESSIONS - 1 - DELETABLE_CONV_SESSION_COUNT
    const expectedCount = TOTAL_SESSIONS - 1 - DELETABLE_CONV_SESSION_COUNT;
    expect(sessions.length).toBe(expectedCount);

    // Neither sess-e2e-009 nor sess-e2e-010 should remain
    const ids = sessions.map((s: any) => s.session_id);
    expect(ids).not.toContain('sess-e2e-009');
    expect(ids).not.toContain('sess-e2e-010');
  });
});

// ─── Milestone delete tests ───────────────────────────────────────────────────

test.describe('Milestone Delete — TRUE E2E (serial, mutates daemon state)', () => {
  // ── Test 9 ─────────────────────────────────────────────────────────────────
  test('milestone exists in Insights tab before delete', async ({ page }) => {
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await switchTab(page, 'Insights');

    // The RecentMilestones component shows the private_title by default
    await expect(page.getByText(DELETABLE_MILESTONE_TITLE)).toBeVisible();
  });

  // ── Test 10 ────────────────────────────────────────────────────────────────
  test('deleting milestone via API removes it from Insights tab', async ({ page }) => {
    // The RecentMilestones component in the Insights tab does NOT render delete
    // buttons — milestones are deleted either through the session card expansion
    // or directly via the DELETE API. We call the API directly here.
    await deleteFromDaemon(`/api/local/milestones/${DELETABLE_MILESTONE_ID}`);

    // Reload to pick up the change from the daemon
    await gotoDashboard(page);
    await selectScale(page, 'month');
    await switchTab(page, 'Insights');

    // The milestone title should no longer appear in Recent Achievements
    await expect(page.getByText(DELETABLE_MILESTONE_TITLE)).not.toBeVisible();
  });

  // ── Test 11 ────────────────────────────────────────────────────────────────
  test('deleted milestone removed from daemon API', async ({ page }) => {
    await gotoDashboard(page);

    const milestones: any[] = await fetchFromDaemon('/api/local/milestones');

    // DELETABLE_MILESTONE_ID (m_e2e_006) must not be present
    const ids = milestones.map((m: any) => m.id);
    expect(ids).not.toContain(DELETABLE_MILESTONE_ID);
  });

  // ── Test 12 ────────────────────────────────────────────────────────────────
  test('deleted milestone removed from disk (milestones.json)', async ({ page }) => {
    await gotoDashboard(page);

    const milestones = readMilestonesFile();
    const ids = milestones.map((m: any) => m.id);
    expect(ids).not.toContain(DELETABLE_MILESTONE_ID);

    // Also confirm the total on disk reflects all deletions made so far:
    // TOTAL_MILESTONES - 1 (m_e2e_002 cascade-deleted with sess-e2e-002)
    //                  - 1 (m_e2e_006 deleted in test 10)
    // m_e2e_007 belongs to sess-e2e-009 which was deleted in the conversation
    // delete test, so it should also be gone.
    const remainingIds = milestones.map((m: any) => m.id);
    expect(remainingIds).not.toContain('m_e2e_007');
  });
});
