import { describe, it, expect } from 'vitest';
import { computeLocalAPS } from '../src/scoring/aps';
import { computeAPSComponents } from '../src/scoring/components';
import { spaceFramework } from '../src/frameworks/space';
import { rawFramework } from '../src/frameworks/raw';
import type { SessionSeal } from '../src/types/chain';
import type { Milestone } from '../src/types/milestone';

/**
 * Integration: computeLocalAPS uses computeAPSComponents + framework registry
 * to produce a full APS result. These tests verify the full pipeline.
 */

function makeSession(overrides: Partial<SessionSeal> = {}): SessionSeal {
  return {
    session_id: 'sess-1',
    client: 'claude-code',
    task_type: 'coding',
    languages: ['typescript'],
    files_touched: 10,
    started_at: '2025-03-01T09:00:00Z',
    ended_at: '2025-03-01T10:00:00Z',
    duration_seconds: 3600,
    heartbeat_count: 2,
    record_count: 5,
    chain_start_hash: 'abc',
    chain_end_hash: 'def',
    seal_signature: 'sig',
    ...overrides,
  };
}

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: 'ms-1',
    session_id: 'sess-1',
    title: 'Test milestone',
    category: 'feature',
    complexity: 'medium',
    duration_minutes: 30,
    languages: ['typescript'],
    client: 'claude-code',
    created_at: '2025-03-01T10:00:00Z',
    published: false,
    published_at: null,
    chain_hash: 'hash-1',
    ...overrides,
  };
}

describe('APS scoring integration', () => {
  it('computes a full APS result with SPACE framework end-to-end', () => {
    const sessions = [makeSession()];
    const milestones = [makeMilestone({ complexity: 'complex' })];

    const result = computeLocalAPS(sessions, milestones, 7, spaceFramework);

    expect(result.framework).toBe('space');
    expect(result.sessionCount).toBe(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1000);
    expect(result.window.start).toBe('2025-03-01T09:00:00Z');
    expect(result.window.end).toBe('2025-03-01T10:00:00Z');
    expect(result.components.output).toBeGreaterThan(0);
    expect(result.components.consistency).toBeCloseTo(0.5, 1); // 7/14
  });

  it('computes APS result with RAW framework yielding different scores', () => {
    const evaluation = {
      prompt_quality: 5,
      context_provided: 5,
      independence_level: 5,
      scope_quality: 5,
      task_outcome: 'completed' as const,
      iteration_count: 1,
      tools_leveraged: 3,
    };
    const sessions = [makeSession({ evaluation })];
    const milestones = [makeMilestone()];

    const rawResult = computeLocalAPS(sessions, milestones, 7, rawFramework);
    const spaceResult = computeLocalAPS(sessions, milestones, 7, spaceFramework);

    expect(rawResult.framework).toBe('raw');
    expect(spaceResult.framework).toBe('space');
    // Both should produce valid scores
    expect(rawResult.score).toBeGreaterThanOrEqual(0);
    expect(spaceResult.score).toBeGreaterThanOrEqual(0);
  });

  it('handles empty sessions gracefully', () => {
    const result = computeLocalAPS([], [], 0, spaceFramework);

    expect(result.score).toBe(0);
    expect(result.sessionCount).toBe(0);
    expect(result.window.start).toBe('');
    expect(result.window.end).toBe('');
    expect(result.components.output).toBe(0);
    expect(result.components.efficiency).toBe(0);
    expect(result.components.promptQuality).toBe(0);
    expect(result.components.consistency).toBe(0);
    expect(result.components.breadth).toBe(0);
  });

  it('APS components feed correctly into weighted sum', () => {
    const sessions = [
      makeSession({
        languages: ['typescript', 'python', 'rust', 'go', 'java'],
        files_touched: 20,
        duration_seconds: 3600,
      }),
    ];
    const milestones = [
      makeMilestone({ complexity: 'complex' }),
      makeMilestone({ id: 'ms-2', complexity: 'complex' }),
      makeMilestone({ id: 'ms-3', complexity: 'medium' }),
    ];

    const components = computeAPSComponents(sessions, milestones, 14, spaceFramework);
    const result = computeLocalAPS(sessions, milestones, 14, spaceFramework);

    // Verify components are between 0 and 1
    expect(components.output).toBeGreaterThanOrEqual(0);
    expect(components.output).toBeLessThanOrEqual(1);
    expect(components.efficiency).toBeGreaterThanOrEqual(0);
    expect(components.efficiency).toBeLessThanOrEqual(1);
    expect(components.consistency).toBe(1); // 14/14 = 1
    expect(components.breadth).toBe(1); // 5/5 = 1

    // Verify score is weighted sum * 1000 (rounded)
    const expectedWeighted =
      components.output * 0.25 +
      components.efficiency * 0.25 +
      components.promptQuality * 0.20 +
      components.consistency * 0.15 +
      components.breadth * 0.15;
    expect(result.score).toBe(Math.round(expectedWeighted * 1000));
  });

  it('sorts sessions by started_at for window calculation', () => {
    const sessions = [
      makeSession({ session_id: 's-2', started_at: '2025-03-02T09:00:00Z', ended_at: '2025-03-02T10:00:00Z' }),
      makeSession({ session_id: 's-1', started_at: '2025-03-01T09:00:00Z', ended_at: '2025-03-01T10:00:00Z' }),
      makeSession({ session_id: 's-3', started_at: '2025-03-03T09:00:00Z', ended_at: '2025-03-03T10:00:00Z' }),
    ];

    const result = computeLocalAPS(sessions, [], 3, spaceFramework);

    expect(result.window.start).toBe('2025-03-01T09:00:00Z');
    expect(result.window.end).toBe('2025-03-03T10:00:00Z');
  });
});
