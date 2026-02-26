/**
 * Seed data for true E2E tests.
 * This data is written to disk and served by a real daemon instance.
 * All timestamps are deterministic and relative to a known anchor.
 */

// Anchor: 1 hour before now, so all "today" sessions are safely in the past.
// "Today" sessions span the 6 hours ending 1h ago.
const NOW = Date.now();
const ANCHOR = NOW - 3_600_000; // 1 hour ago
const DAY_MS = 86_400_000;

/**
 * Generate an ISO timestamp.
 * - daysAgo=0: relative to ANCHOR (1h before now), hoursOffset goes backward from ANCHOR
 *   e.g., iso(0, 0) = 1h ago, iso(0, 1) = 2h ago, iso(0, 5) = 6h ago
 * - daysAgo>0: same day offset from ANCHOR, shifted by N*24h
 */
function iso(daysAgo: number, hoursAgo = 0, minutesAgo = 0): string {
  return new Date(ANCHOR - daysAgo * DAY_MS - hoursAgo * 3_600_000 - minutesAgo * 60_000).toISOString();
}

// ── Sessions ──────────────────────────────────────────────────────────────────

const CONV_ID_1 = 'conv-e2e-auth-feature';
const CONV_ID_2 = 'conv-e2e-dashboard';

export const SEED_SESSIONS = [
  // Today — standalone session (Claude Code, TypeScript, coding)
  {
    session_id: 'sess-e2e-001',
    client: 'claude-code',
    task_type: 'coding',
    languages: ['typescript'],
    files_touched: 8,
    project: 'acme-api',
    title: 'Implement user authentication',
    private_title: 'Build JWT auth with refresh tokens for Acme API',
    model: 'claude-sonnet-4-6',
    evaluation: {
      prompt_quality: 5,
      context_provided: 4,
      context_provided_reason: 'Missing error handling requirements',
      task_outcome: 'completed' as const,
      iteration_count: 3,
      independence_level: 5,
      scope_quality: 4,
      scope_quality_reason: 'Scope was clear but edge cases unspecified',
      tools_leveraged: 7,
    },
    started_at: iso(0, 5, 30),    // 5h30m ago
    ended_at: iso(0, 4, 0),      // 4h ago (90min session)
    duration_seconds: 5400,
    heartbeat_count: 5,
    record_count: 8,
    chain_start_hash: 'a1b2c3d4',
    chain_end_hash: 'e5f6g7h8',
    seal_signature: 'sig-001',
  },

  // Today — Cursor, Python, debugging
  {
    session_id: 'sess-e2e-002',
    client: 'cursor',
    task_type: 'debugging',
    languages: ['python'],
    files_touched: 3,
    project: 'ml-pipeline',
    title: 'Debug data pipeline',
    private_title: 'Fix pandas DataFrame merge causing duplicate rows',
    model: 'gpt-4o',
    evaluation: {
      prompt_quality: 3,
      prompt_quality_reason: 'Error description was vague',
      context_provided: 2,
      context_provided_reason: 'No error logs provided',
      task_outcome: 'completed' as const,
      iteration_count: 7,
      independence_level: 3,
      independence_level_reason: 'Needed multiple clarifications',
      scope_quality: 3,
      scope_quality_reason: 'Scope expanded during debugging',
      tools_leveraged: 4,
    },
    started_at: iso(0, 3, 30),    // 3h30m ago
    ended_at: iso(0, 2, 30),     // 2h30m ago (60min session)
    duration_seconds: 3600,
    heartbeat_count: 3,
    record_count: 6,
    chain_start_hash: 'b1c2d3e4',
    chain_end_hash: 'f5g6h7i8',
    seal_signature: 'sig-002',
  },

  // Today — conversation (3 prompts) — Claude Code, TypeScript + Go
  {
    session_id: 'sess-e2e-003',
    conversation_id: CONV_ID_1,
    conversation_index: 0,
    client: 'claude-code',
    task_type: 'coding',
    languages: ['typescript', 'go'],
    files_touched: 12,
    project: 'acme-api',
    title: 'Auth middleware',
    private_title: 'Prompt 1: Create auth middleware for Express routes',
    model: 'claude-sonnet-4-6',
    evaluation: {
      prompt_quality: 5,
      context_provided: 5,
      task_outcome: 'completed' as const,
      iteration_count: 1,
      independence_level: 5,
      scope_quality: 5,
      tools_leveraged: 5,
    },
    started_at: iso(0, 2, 15),    // 2h15m ago
    ended_at: iso(0, 1, 55),     // 1h55m ago (20min session)
    duration_seconds: 1200,
    heartbeat_count: 1,
    record_count: 4,
    chain_start_hash: 'c1d2e3f4',
    chain_end_hash: 'g5h6i7j8',
    seal_signature: 'sig-003',
  },
  {
    session_id: 'sess-e2e-004',
    conversation_id: CONV_ID_1,
    conversation_index: 1,
    client: 'claude-code',
    task_type: 'coding',
    languages: ['typescript'],
    files_touched: 5,
    project: 'acme-api',
    title: 'Auth tests',
    private_title: 'Prompt 2: Write integration tests for auth middleware',
    model: 'claude-sonnet-4-6',
    evaluation: {
      prompt_quality: 4,
      context_provided: 4,
      context_provided_reason: 'Could have specified test framework',
      task_outcome: 'completed' as const,
      iteration_count: 2,
      independence_level: 5,
      scope_quality: 4,
      scope_quality_reason: 'Test coverage criteria unclear',
      tools_leveraged: 4,
    },
    started_at: iso(0, 1, 50),    // 1h50m ago
    ended_at: iso(0, 1, 25),     // 1h25m ago (25min session)
    duration_seconds: 1500,
    heartbeat_count: 1,
    record_count: 4,
    chain_start_hash: 'd1e2f3g4',
    chain_end_hash: 'h5i6j7k8',
    seal_signature: 'sig-004',
  },
  {
    session_id: 'sess-e2e-005',
    conversation_id: CONV_ID_1,
    conversation_index: 2,
    client: 'claude-code',
    task_type: 'testing',
    languages: ['typescript'],
    files_touched: 2,
    project: 'acme-api',
    title: 'Fix failing tests',
    private_title: 'Prompt 3: Fix 2 failing auth tests after middleware refactor',
    model: 'claude-sonnet-4-6',
    evaluation: {
      prompt_quality: 5,
      context_provided: 5,
      task_outcome: 'completed' as const,
      iteration_count: 1,
      independence_level: 5,
      scope_quality: 5,
      tools_leveraged: 3,
    },
    started_at: iso(0, 1, 20),    // 1h20m ago
    ended_at: iso(0, 1, 5),      // 1h5m ago (15min session)
    duration_seconds: 900,
    heartbeat_count: 0,
    record_count: 3,
    chain_start_hash: 'e1f2g3h4',
    chain_end_hash: 'i5j6k7l8',
    seal_signature: 'sig-005',
  },

  // Yesterday — Windsurf, JavaScript, refactoring
  {
    session_id: 'sess-e2e-006',
    client: 'windsurf',
    task_type: 'refactoring',
    languages: ['javascript'],
    files_touched: 15,
    project: 'acme-web',
    title: 'Refactor components',
    private_title: 'Extract shared hooks from React components',
    model: 'claude-sonnet-4-6',
    evaluation: {
      prompt_quality: 4,
      context_provided: 3,
      context_provided_reason: 'Component tree not provided',
      task_outcome: 'completed' as const,
      iteration_count: 4,
      independence_level: 4,
      independence_level_reason: 'Needed guidance on hook naming',
      scope_quality: 4,
      scope_quality_reason: 'Number of components to refactor was unclear',
      tools_leveraged: 6,
    },
    started_at: iso(1, 5, 0),     // yesterday, 5h before anchor offset
    ended_at: iso(1, 3, 0),      // yesterday (2h session)
    duration_seconds: 7200,
    heartbeat_count: 7,
    record_count: 10,
    chain_start_hash: 'f1g2h3i4',
    chain_end_hash: 'j5k6l7m8',
    seal_signature: 'sig-006',
  },

  // 2 days ago — VS Code, SQL, data work
  {
    session_id: 'sess-e2e-007',
    client: 'vscode',
    task_type: 'data',
    languages: ['sql', 'python'],
    files_touched: 4,
    project: 'ml-pipeline',
    title: 'Database migration',
    private_title: 'Create PostgreSQL migration for analytics tables',
    model: 'gpt-4o',
    evaluation: {
      prompt_quality: 5,
      context_provided: 5,
      task_outcome: 'completed' as const,
      iteration_count: 2,
      independence_level: 5,
      scope_quality: 5,
      tools_leveraged: 3,
    },
    started_at: iso(2, 5, 0),     // 2 days ago
    ended_at: iso(2, 4, 0),      // (1h session)
    duration_seconds: 3600,
    heartbeat_count: 3,
    record_count: 6,
    chain_start_hash: 'g1h2i3j4',
    chain_end_hash: 'k5l6m7n8',
    seal_signature: 'sig-007',
  },

  // 3 days ago — Claude Code, session with no evaluation
  {
    session_id: 'sess-e2e-008',
    client: 'claude-code',
    task_type: 'planning',
    languages: ['markdown'],
    files_touched: 1,
    project: 'acme-api',
    title: 'API planning',
    private_title: 'Plan REST API endpoints for v2 release',
    model: 'claude-sonnet-4-6',
    started_at: iso(3, 5, 0),     // 3 days ago
    ended_at: iso(3, 4, 30),     // (30min session)
    duration_seconds: 1800,
    heartbeat_count: 1,
    record_count: 4,
    chain_start_hash: 'h1i2j3k4',
    chain_end_hash: 'l5m6n7o8',
    seal_signature: 'sig-008',
  },

  // Dashboard conversation (yesterday)
  {
    session_id: 'sess-e2e-009',
    conversation_id: CONV_ID_2,
    conversation_index: 0,
    client: 'cursor',
    task_type: 'coding',
    languages: ['typescript', 'css'],
    files_touched: 6,
    project: 'acme-web',
    title: 'Dashboard charts',
    private_title: 'Prompt 1: Add Recharts integration for analytics dashboard',
    model: 'gpt-4o',
    evaluation: {
      prompt_quality: 4,
      context_provided: 3,
      context_provided_reason: 'Missing design mockups',
      task_outcome: 'partial' as const,
      task_outcome_reason: 'Only 2 of 4 chart types implemented',
      iteration_count: 5,
      independence_level: 4,
      independence_level_reason: 'Needed input on chart library choice',
      scope_quality: 3,
      scope_quality_reason: 'Too many chart types in one session',
      tools_leveraged: 5,
    },
    started_at: iso(1, 2, 30),    // yesterday
    ended_at: iso(1, 1, 0),      // (90min session)
    duration_seconds: 5400,
    heartbeat_count: 5,
    record_count: 8,
    chain_start_hash: 'i1j2k3l4',
    chain_end_hash: 'm5n6o7p8',
    seal_signature: 'sig-009',
  },
  {
    session_id: 'sess-e2e-010',
    conversation_id: CONV_ID_2,
    conversation_index: 1,
    client: 'cursor',
    task_type: 'coding',
    languages: ['typescript'],
    files_touched: 4,
    project: 'acme-web',
    title: 'Remaining charts',
    private_title: 'Prompt 2: Complete remaining bar and pie charts',
    model: 'gpt-4o',
    evaluation: {
      prompt_quality: 5,
      context_provided: 5,
      task_outcome: 'completed' as const,
      iteration_count: 2,
      independence_level: 5,
      scope_quality: 5,
      tools_leveraged: 4,
    },
    started_at: iso(1, 0, 55),    // yesterday
    ended_at: iso(1, 0, 25),     // (30min session)
    duration_seconds: 1800,
    heartbeat_count: 1,
    record_count: 4,
    chain_start_hash: 'j1k2l3m4',
    chain_end_hash: 'n5o6p7q8',
    seal_signature: 'sig-010',
  },
];

// ── Milestones ────────────────────────────────────────────────────────────────

export const SEED_MILESTONES = [
  {
    id: 'm_e2e_001',
    session_id: 'sess-e2e-001',
    title: 'JWT authentication',
    private_title: 'Implemented JWT auth with refresh token rotation',
    project: 'acme-api',
    category: 'feature',
    complexity: 'complex',
    duration_minutes: 90,
    languages: ['typescript'],
    client: 'claude-code',
    created_at: iso(0, 4, 0),
    published: false,
    published_at: null,
    chain_hash: 'mh-001',
  },
  {
    id: 'm_e2e_002',
    session_id: 'sess-e2e-002',
    title: 'Pipeline bugfix',
    private_title: 'Fixed pandas merge duplication in ETL pipeline',
    project: 'ml-pipeline',
    category: 'bugfix',
    complexity: 'medium',
    duration_minutes: 60,
    languages: ['python'],
    client: 'cursor',
    created_at: iso(0, 2, 30),
    published: false,
    published_at: null,
    chain_hash: 'mh-002',
  },
  {
    id: 'm_e2e_003',
    session_id: 'sess-e2e-003',
    title: 'Auth middleware',
    private_title: 'Created Express auth middleware with role-based access',
    project: 'acme-api',
    category: 'feature',
    complexity: 'medium',
    duration_minutes: 20,
    languages: ['typescript', 'go'],
    client: 'claude-code',
    created_at: iso(0, 1, 55),
    published: false,
    published_at: null,
    chain_hash: 'mh-003',
  },
  {
    id: 'm_e2e_004',
    session_id: 'sess-e2e-005',
    title: 'Auth test fixes',
    private_title: 'Fixed 2 failing auth integration tests',
    project: 'acme-api',
    category: 'bugfix',
    complexity: 'simple',
    duration_minutes: 15,
    languages: ['typescript'],
    client: 'claude-code',
    created_at: iso(0, 1, 5),
    published: false,
    published_at: null,
    chain_hash: 'mh-004',
  },
  {
    id: 'm_e2e_005',
    session_id: 'sess-e2e-006',
    title: 'React hooks refactor',
    private_title: 'Extracted 5 shared hooks from React component tree',
    project: 'acme-web',
    category: 'refactor',
    complexity: 'complex',
    duration_minutes: 120,
    languages: ['javascript'],
    client: 'windsurf',
    created_at: iso(1, 3, 0),
    published: false,
    published_at: null,
    chain_hash: 'mh-005',
  },
  {
    id: 'm_e2e_006',
    session_id: 'sess-e2e-007',
    title: 'Analytics tables',
    private_title: 'Created PostgreSQL migration for analytics schema',
    project: 'ml-pipeline',
    category: 'feature',
    complexity: 'medium',
    duration_minutes: 60,
    languages: ['sql', 'python'],
    client: 'vscode',
    created_at: iso(2, 4, 0),
    published: false,
    published_at: null,
    chain_hash: 'mh-006',
  },
  {
    id: 'm_e2e_007',
    session_id: 'sess-e2e-009',
    title: 'Dashboard charts',
    private_title: 'Added Recharts bar and line charts to analytics dashboard',
    project: 'acme-web',
    category: 'feature',
    complexity: 'complex',
    duration_minutes: 90,
    languages: ['typescript', 'css'],
    client: 'cursor',
    created_at: iso(1, 1, 0),
    published: false,
    published_at: null,
    chain_hash: 'mh-007',
  },
];

// ── Config ────────────────────────────────────────────────────────────────────

export const SEED_CONFIG = {
  milestone_tracking: true,
  auto_sync: false,
  evaluation_framework: 'space',
  sync_interval_hours: 24,
};

// ── Derived constants for test assertions ─────────────────────────────────────

export const TOTAL_SESSIONS = SEED_SESSIONS.length;           // 10
export const TOTAL_MILESTONES = SEED_MILESTONES.length;       // 7
export const TOTAL_CONVERSATIONS = 2;                         // 2 conversations
export const UNIQUE_CLIENTS = ['claude-code', 'cursor', 'windsurf', 'vscode'];
export const UNIQUE_LANGUAGES = ['typescript', 'python', 'go', 'javascript', 'sql', 'css', 'markdown'];
export const UNIQUE_PROJECTS = ['acme-api', 'ml-pipeline', 'acme-web'];
export const FEATURES_COUNT = 4;  // m_001, m_003, m_006, m_007
export const BUGS_COUNT = 2;      // m_002, m_004
export const COMPLEX_COUNT = 3;   // m_001, m_005, m_007
export const SESSIONS_TODAY = 5;  // sess-001 through sess-005
export const SESSIONS_YESTERDAY = 3; // sess-006, sess-009, sess-010

/** Session we'll use for delete tests (standalone, today, no conversation) */
export const DELETABLE_SESSION_ID = 'sess-e2e-002';
export const DELETABLE_SESSION_TITLE = 'Fix pandas DataFrame merge causing duplicate rows';

/** Conversation we'll use for conversation delete test */
export const DELETABLE_CONV_ID = CONV_ID_2;
export const DELETABLE_CONV_SESSION_COUNT = 2;

/** Milestone we'll use for milestone delete test */
export const DELETABLE_MILESTONE_ID = 'm_e2e_006';
export const DELETABLE_MILESTONE_TITLE = 'Created PostgreSQL migration for analytics schema';
