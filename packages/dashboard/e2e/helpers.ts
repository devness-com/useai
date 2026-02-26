import { test, expect, type Page } from '@playwright/test';

// ─── Navigation helpers ─────────────────────────────────────────────────────

/** Wait for the dashboard to finish loading (no "Loading..." text) */
export async function waitForDashboard(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('time-travel-panel')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
}

/** Get the current mode text (Live or History) */
export async function getMode(page: Page): Promise<'live' | 'history'> {
  const goLiveVisible = await page.getByTestId('go-live-button').isVisible().catch(() => false);
  return goLiveVisible ? 'history' : 'live';
}

/** Get the text of the time display */
export async function getTimeDisplay(page: Page): Promise<string> {
  return page.getByTestId('time-display').innerText();
}

/** Get the period label text */
export async function getPeriodLabel(page: Page): Promise<string> {
  return page.getByTestId('period-label').innerText();
}

/** Get the date display text (e.g. "Thu, February 26, 2026") */
export async function getDateDisplay(page: Page): Promise<string> {
  return page.getByTestId('date-display').innerText();
}

/** Click a scale button */
export async function selectScale(page: Page, scale: string) {
  await page.getByTestId(`scale-${scale}`).click();
  await page.waitForTimeout(300);
}

/** Perform a drag on the scrubber */
export async function dragScrubber(page: Page, dx: number, options?: { steps?: number; slow?: boolean }) {
  const scrubber = page.getByTestId('time-scrubber');
  const box = await scrubber.boundingBox();
  if (!box) throw new Error('Scrubber not found');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const steps = options?.steps ?? 20;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (dx * i) / steps, startY);
    if (options?.slow) await page.waitForTimeout(30);
  }

  await page.mouse.up();
  await page.waitForTimeout(200);
}

// ─── Tab helpers ────────────────────────────────────────────────────────────

/** Switch to Sessions or Insights tab */
export async function switchTab(page: Page, tab: 'Sessions' | 'Insights') {
  await page.getByRole('button', { name: tab }).click();
  await page.waitForTimeout(300);
}

// ─── Mock API routes ────────────────────────────────────────────────────────

/** Session data for mocking API responses */
export function createMockSession(overrides: Record<string, any> = {}) {
  const now = new Date();
  const started = new Date(now.getTime() - 1800_000); // 30 min ago
  return {
    session_id: `sess-${Math.random().toString(36).slice(2, 10)}`,
    client: 'claude-code',
    task_type: 'coding',
    languages: ['typescript'],
    files_touched: 5,
    project: 'test-project',
    title: 'Test session public',
    private_title: 'Fix authentication bug in login flow',
    model: 'claude-sonnet-4-6',
    evaluation: {
      prompt_quality: 4,
      prompt_quality_reason: 'Clear goal but missing edge cases',
      context_provided: 3,
      context_provided_reason: 'Some files provided but incomplete',
      task_outcome: 'completed' as const,
      iteration_count: 3,
      independence_level: 5,
      scope_quality: 4,
      scope_quality_reason: 'Reasonable with some ambiguity',
      tools_leveraged: 6,
    },
    started_at: started.toISOString(),
    ended_at: now.toISOString(),
    duration_seconds: 1800,
    heartbeat_count: 3,
    record_count: 5,
    chain_start_hash: 'abc123',
    chain_end_hash: 'def456',
    seal_signature: 'sig789',
    ...overrides,
  };
}

/** Milestone data for mocking */
export function createMockMilestone(overrides: Record<string, any> = {}) {
  return {
    id: `ms-${Math.random().toString(36).slice(2, 10)}`,
    session_id: 'sess-1',
    title: 'Implemented auth flow',
    private_title: 'Implemented JWT auth for UseAI login',
    project: 'test-project',
    category: 'feature',
    complexity: 'medium',
    duration_minutes: 30,
    languages: ['typescript'],
    client: 'claude-code',
    created_at: new Date().toISOString(),
    published: false,
    published_at: null,
    chain_hash: 'hash123',
    ...overrides,
  };
}

/** Create a conversation (multiple sessions with same conversation_id) */
export function createMockConversation(sessionCount: number = 3, overrides: Record<string, any> = {}) {
  const convId = `conv-${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  return Array.from({ length: sessionCount }, (_, i) => {
    const started = new Date(now - (sessionCount - i) * 600_000);
    const ended = new Date(started.getTime() + 300_000);
    return createMockSession({
      session_id: `sess-conv-${i}`,
      conversation_id: convId,
      conversation_index: i,
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      duration_seconds: 300,
      private_title: `Prompt ${i + 1}: Working on feature`,
      title: `Session ${i + 1}`,
      ...overrides,
    });
  });
}

/** Default config for unauthenticated state */
export function createMockConfig(overrides: Record<string, any> = {}) {
  return {
    authenticated: false,
    email: null,
    username: null,
    last_sync_at: null,
    auto_sync: false,
    ...overrides,
  };
}

/** Default health response */
export function createMockHealth(overrides: Record<string, any> = {}) {
  return {
    status: 'ok',
    version: '0.6.18',
    active_sessions: 0,
    mcp_connections: 0,
    uptime_seconds: 3600,
    ...overrides,
  };
}

/** Default update check response (no update) */
export function createMockUpdateInfo(overrides: Record<string, any> = {}) {
  return {
    current: '0.6.18',
    latest: '0.6.18',
    update_available: false,
    ...overrides,
  };
}

/** Setup mock API routes for a page - intercepts ALL dashboard API calls */
export async function setupMockAPI(
  page: Page,
  options: {
    sessions?: any[];
    milestones?: any[];
    config?: any;
    health?: any;
    updateInfo?: any;
  } = {},
) {
  const sessions = options.sessions ?? [createMockSession()];
  const milestones = options.milestones ?? [createMockMilestone({ session_id: sessions[0]?.session_id })];
  const config = options.config ?? createMockConfig();
  const health = options.health ?? createMockHealth();
  const updateInfo = options.updateInfo ?? createMockUpdateInfo();

  await page.route('**/api/local/sessions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions) }),
  );
  await page.route('**/api/local/milestones', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(milestones) }),
  );
  await page.route('**/api/local/config', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) }),
  );
  await page.route('**/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(health) }),
  );
  await page.route('**/api/local/update-check', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updateInfo) }),
  );
}

/** Navigate to dashboard with mocked data */
export async function gotoWithMocks(
  page: Page,
  options: Parameters<typeof setupMockAPI>[1] = {},
) {
  await setupMockAPI(page, options);
  await page.goto('/');
  await expect(page.getByTestId('time-travel-panel')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
}
