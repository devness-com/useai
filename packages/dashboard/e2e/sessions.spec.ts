import { test, expect } from '@playwright/test';
import { gotoWithMocks, createMockSession, createMockMilestone, createMockConversation } from './helpers';

test.describe('Session List', () => {
  test('renders sessions', async ({ page }) => {
    const sessions = [
      createMockSession({ session_id: 'sess-1', private_title: 'First session', title: 'Public first' }),
      createMockSession({ session_id: 'sess-2', private_title: 'Second session', title: 'Public second', started_at: new Date(Date.now() - 3600_000).toISOString(), ended_at: new Date(Date.now() - 1800_000).toISOString() }),
    ];
    await gotoWithMocks(page, { sessions });
    // Both session titles should be visible (private by default)
    await expect(page.getByText('First session')).toBeVisible();
    await expect(page.getByText('Second session')).toBeVisible();
  });

  test('conversation group shows prompts badge', async ({ page }) => {
    const sessions = createMockConversation(3);
    await gotoWithMocks(page, { sessions });
    await expect(page.getByText('3 prompts')).toBeVisible();
  });

  test('expanding conversation shows individual session cards', async ({ page }) => {
    const sessions = createMockConversation(3);
    await gotoWithMocks(page, { sessions });

    // Click the expand button (aria-label "Expand conversation")
    await page.getByRole('button', { name: 'Expand conversation' }).click();
    await page.waitForTimeout(300);

    // Should show prompt labels
    await expect(page.getByText('1').first()).toBeVisible();
    await expect(page.getByText('2').first()).toBeVisible();
    await expect(page.getByText('3').first()).toBeVisible();
  });

  test('collapsing conversation hides individual cards', async ({ page }) => {
    const sessions = createMockConversation(2);
    await gotoWithMocks(page, { sessions });

    // Expand
    await page.getByRole('button', { name: 'Expand conversation' }).click();
    await page.waitForTimeout(300);

    // Collapse
    await page.getByRole('button', { name: 'Collapse conversation' }).click();
    await page.waitForTimeout(400);
  });

  test('session card expand shows evaluation details', async ({ page }) => {
    const sessions = [
      createMockSession({
        session_id: 'sess-1',
        private_title: 'Test session with eval',
        evaluation: {
          prompt_quality: 4,
          context_provided: 3,
          context_provided_reason: 'Missing context',
          task_outcome: 'completed',
          iteration_count: 5,
          independence_level: 5,
          scope_quality: 4,
          tools_leveraged: 8,
        },
      }),
    ];
    await gotoWithMocks(page, { sessions });

    // Expand the session card
    await page.getByRole('button', { name: 'Expand details' }).click();
    await page.waitForTimeout(300);

    // Should show evaluation metrics
    await expect(page.getByText('Prompt')).toBeVisible();
    await expect(page.getByText('Context', { exact: true })).toBeVisible();
    await expect(page.getByText('Scope')).toBeVisible();
    await expect(page.getByText('Independence')).toBeVisible();
    await expect(page.getByText('Iterations')).toBeVisible();
    await expect(page.getByText('5', { exact: true }).first()).toBeVisible();
  });

  test('session card shows milestones when expanded', async ({ page }) => {
    const sessions = [createMockSession({ session_id: 'sess-1' })];
    const milestones = [
      createMockMilestone({ id: 'ms-1', session_id: 'sess-1', title: 'Feature alpha', private_title: 'Implemented feature alpha', category: 'feature' }),
      createMockMilestone({ id: 'ms-2', session_id: 'sess-1', title: 'Fix beta', private_title: 'Fixed bug in beta flow', category: 'bugfix' }),
    ];
    await gotoWithMocks(page, { sessions, milestones });

    await page.getByRole('button', { name: 'Expand details' }).click();
    await page.waitForTimeout(300);

    // Should show milestone titles (private by default)
    await expect(page.getByText('Implemented feature alpha')).toBeVisible();
    await expect(page.getByText('Fixed bug in beta flow')).toBeVisible();
    // Should show category badges
    await expect(page.getByText('feature', { exact: true })).toBeVisible();
    await expect(page.getByText('bugfix')).toBeVisible();
  });

  test('privacy toggle switches between public and private titles', async ({ page }) => {
    const sessions = [
      createMockSession({
        session_id: 'sess-1',
        title: 'Public title here',
        private_title: 'Secret private title',
      }),
    ];
    await gotoWithMocks(page, { sessions });

    // Should show private title by default
    await expect(page.getByText('Secret private title')).toBeVisible();

    // Click the global public/private toggle (aria-label "Switch to public titles")
    await page.getByRole('button', { name: 'Switch to public titles' }).click();
    await page.waitForTimeout(300);

    // Should now show public title
    await expect(page.getByText('Public title here')).toBeVisible();
  });

  test('session count badge is visible', async ({ page }) => {
    const sessions = [
      createMockSession({ session_id: 'sess-1' }),
      createMockSession({ session_id: 'sess-2', started_at: new Date(Date.now() - 3600_000).toISOString() }),
    ];
    await gotoWithMocks(page, { sessions });
    // Should show "2 Sessions" in the activity feed header
    await expect(page.getByText('2 Sessions')).toBeVisible();
  });

  test('shows duration on session card', async ({ page }) => {
    const sessions = [
      createMockSession({ session_id: 'sess-1', duration_seconds: 5400 }), // 1h 30m
    ];
    await gotoWithMocks(page, { sessions });
    await expect(page.getByText('1h 30m')).toBeVisible();
  });

  test('empty state shows message when no sessions in window', async ({ page }) => {
    await gotoWithMocks(page, { sessions: [], milestones: [] });
    await expect(page.getByText('No sessions in this window')).toBeVisible();
  });
});
