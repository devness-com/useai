import { describe, it, expect } from 'vitest';
import { computeLocalAPS } from '../src/scoring/aps';
import { getFramework } from '../src/frameworks/registry';
import { migrateConfig } from '../src/utils/config-migrate';
import { sanitizeSealForSync } from '../src/utils/sync-sanitize';
import { milestoneInputSchema, taskTypeSchema, complexitySchema } from '../src/validation/schemas';
import { DEFAULT_CONFIG } from '../src/constants/defaults';
import { resolveClient, TOOL_DISPLAY_NAMES } from '../src/constants/tools';
import type { SessionSeal } from '../src/types/chain';
import type { Milestone } from '../src/types/milestone';

/**
 * Integration: End-to-end pipeline tests that simulate realistic workflows
 * crossing multiple modules: validation → config → scoring → sync sanitization.
 */

describe('Full pipeline: session lifecycle integration', () => {
  it('validates input, scores session, and sanitizes for sync', () => {
    // Step 1: Validate task type
    const taskResult = taskTypeSchema.safeParse('debug'); // alias
    expect(taskResult.success).toBe(true);
    const taskType = taskResult.success ? taskResult.data : 'other';
    expect(taskType).toBe('debugging');

    // Step 2: Validate milestone inputs
    const msInput = milestoneInputSchema.safeParse({
      title: 'Fixed auth token expiry',
      category: 'bug',      // alias → bugfix
      complexity: 'basic',  // alias → simple
    });
    expect(msInput.success).toBe(true);

    // Step 3: Create session seal with evaluation
    const seal: SessionSeal = {
      session_id: 'sess-123',
      client: resolveClient('claude-code'),
      task_type: taskType,
      languages: ['typescript'],
      files_touched: 3,
      prompt: 'Fix the auth token expiry issue',
      private_title: 'Fix JWT expiry in acme-api auth module',
      project: 'acme-api',
      model: 'claude-3-opus',
      title: 'Fix auth expiry',
      evaluation: {
        prompt_quality: 4,
        prompt_quality_reason: 'Clear but missing test expectations',
        context_provided: 5,
        context_provided_reason: 'Full context provided',
        independence_level: 4,
        independence_level_reason: 'Mostly self-directed',
        scope_quality: 5,
        scope_quality_reason: 'Well scoped',
        task_outcome: 'completed',
        task_outcome_reason: 'Bug fixed and tests pass',
        iteration_count: 2,
        tools_leveraged: 3,
      },
      started_at: '2025-03-01T09:00:00Z',
      ended_at: '2025-03-01T09:45:00Z',
      duration_seconds: 2700,
      heartbeat_count: 1,
      record_count: 4,
      chain_start_hash: 'start-hash',
      chain_end_hash: 'end-hash',
      seal_signature: 'signature',
    };

    // Step 4: Get framework and compute APS score
    const config = migrateConfig({});
    const framework = getFramework(config.evaluation_framework);
    expect(framework.id).toBe('space');

    const milestone: Milestone = {
      id: 'ms-1',
      session_id: 'sess-123',
      title: msInput.success ? msInput.data.title : 'Milestone',
      category: msInput.success ? msInput.data.category : 'other',
      complexity: msInput.success ? (msInput.data.complexity ?? 'medium') : 'medium',
      duration_minutes: 45,
      languages: ['typescript'],
      client: 'claude-code',
      created_at: '2025-03-01T09:45:00Z',
      published: false,
      published_at: null,
      chain_hash: 'ms-hash',
    };

    const apsResult = computeLocalAPS([seal], [milestone], 5, framework);
    expect(apsResult.score).toBeGreaterThan(0);
    expect(apsResult.framework).toBe('space');
    expect(apsResult.sessionCount).toBe(1);

    // Step 5: Sanitize for sync
    const sanitized = sanitizeSealForSync(seal, config.sync.include);
    expect(sanitized.prompt).toBeUndefined(); // prompts are off by default
    expect(sanitized.private_title).toBeUndefined();
    expect(sanitized.evaluation).toBeDefined();
    expect(sanitized.model).toBe('claude-3-opus');
  });

  it('end-to-end with legacy config migration', () => {
    // Legacy config format
    const legacyRaw = {
      milestone_tracking: true,
      auto_sync: true,
      sync_interval_hours: 6,
    };

    const config = migrateConfig(legacyRaw);

    // Verify migration
    expect(config.capture.milestones).toBe(true);
    expect(config.sync.enabled).toBe(true);
    expect(config.sync.interval_hours).toBe(6);

    // Get framework from migrated config
    const framework = getFramework(config.evaluation_framework);
    expect(framework.id).toBe('space');

    // Compute APS with the framework
    const sessions: SessionSeal[] = [
      {
        session_id: 'sess-1',
        client: 'cursor',
        task_type: 'coding',
        languages: ['python', 'sql'],
        files_touched: 8,
        started_at: '2025-03-01T14:00:00Z',
        ended_at: '2025-03-01T15:30:00Z',
        duration_seconds: 5400,
        heartbeat_count: 2,
        record_count: 6,
        chain_start_hash: 'h1',
        chain_end_hash: 'h2',
        seal_signature: 's1',
        evaluation: {
          prompt_quality: 3,
          context_provided: 4,
          independence_level: 5,
          scope_quality: 3,
          task_outcome: 'completed',
          iteration_count: 4,
          tools_leveraged: 2,
        },
      },
    ];

    const result = computeLocalAPS(sessions, [], 10, framework);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1000);
    expect(result.components.breadth).toBeCloseTo(2 / 5, 5); // python, sql
    expect(result.components.consistency).toBeCloseTo(10 / 14, 2); // 10/14
  });

  it('resolves client names and maps to display names', () => {
    const clients = ['claude-code', 'cursor', 'windsurf', 'gemini-cli-mcp-client'];
    for (const raw of clients) {
      const resolved = resolveClient(raw);
      const displayName = TOOL_DISPLAY_NAMES[resolved];
      expect(displayName, `${raw} -> ${resolved} should have display name`).toBeTruthy();
    }
  });

  it('validates and scores with complexity aliases end-to-end', () => {
    // Parse complexity through schema
    const complexities = [
      { input: 'basic', expected: 'simple' },
      { input: 'intermediate', expected: 'medium' },
      { input: 'advanced', expected: 'complex' },
    ];

    for (const { input, expected } of complexities) {
      const result = complexitySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(expected);
      }
    }
  });
});
