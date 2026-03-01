import { describe, it, expect } from 'vitest';
import { computeAPSComponents } from '../src/scoring/components';
import { spaceFramework } from '../src/frameworks/space';
import { rawFramework } from '../src/frameworks/raw';
import type { SessionSeal } from '../src/types/chain';
import type { Milestone } from '../src/types/milestone';

/**
 * Integration: computeAPSComponents interacts with EvaluationFramework.computeSessionScore
 * to produce prompt quality scores. Tests verify the real framework logic is used.
 */

function makeSession(overrides: Partial<SessionSeal> = {}): SessionSeal {
  return {
    session_id: 'sess-1',
    client: 'claude-code',
    task_type: 'coding',
    languages: ['typescript'],
    files_touched: 5,
    started_at: '2025-03-01T09:00:00Z',
    ended_at: '2025-03-01T10:00:00Z',
    duration_seconds: 3600,
    heartbeat_count: 0,
    record_count: 3,
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
    title: 'Milestone',
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

describe('APS components with real frameworks', () => {
  describe('output component (complexity-weighted milestones)', () => {
    it('weights simple milestones at 1, medium at 2, complex at 4', () => {
      const simpleMs = [makeMilestone({ complexity: 'simple' })];
      const mediumMs = [makeMilestone({ complexity: 'medium' })];
      const complexMs = [makeMilestone({ complexity: 'complex' })];

      const simpleComps = computeAPSComponents([], simpleMs, 0);
      const mediumComps = computeAPSComponents([], mediumMs, 0);
      const complexComps = computeAPSComponents([], complexMs, 0);

      // simple=1/10=0.1, medium=2/10=0.2, complex=4/10=0.4
      expect(simpleComps.output).toBeCloseTo(0.1, 5);
      expect(mediumComps.output).toBeCloseTo(0.2, 5);
      expect(complexComps.output).toBeCloseTo(0.4, 5);
    });

    it('caps output at 1.0 when complexity-weighted sum exceeds 10', () => {
      const milestones = Array.from({ length: 5 }, (_, i) =>
        makeMilestone({ id: `ms-${i}`, complexity: 'complex' }),
      ); // 5 * 4 = 20 > 10

      const comps = computeAPSComponents([], milestones, 0);
      expect(comps.output).toBe(1);
    });

    it('uses default weight 2 for unknown complexity values', () => {
      const milestones = [makeMilestone({ complexity: 'unknown_level' })];
      const comps = computeAPSComponents([], milestones, 0);
      expect(comps.output).toBeCloseTo(0.2, 5); // 2/10
    });
  });

  describe('efficiency component (files per hour)', () => {
    it('computes files per hour capped at 20/hr', () => {
      const sessions = [makeSession({ files_touched: 10, duration_seconds: 3600 })];
      const comps = computeAPSComponents(sessions, [], 0);
      // 10 files / 1 hour / 20 = 0.5
      expect(comps.efficiency).toBeCloseTo(0.5, 5);
    });

    it('caps efficiency at 1.0 for high output', () => {
      const sessions = [makeSession({ files_touched: 40, duration_seconds: 3600 })];
      const comps = computeAPSComponents(sessions, [], 0);
      expect(comps.efficiency).toBe(1);
    });

    it('handles zero duration gracefully using Math.max(hours, 1)', () => {
      const sessions = [makeSession({ files_touched: 5, duration_seconds: 0 })];
      const comps = computeAPSComponents(sessions, [], 0);
      // 5 files / max(0,1) hour / 20 = 0.25
      expect(comps.efficiency).toBeCloseTo(0.25, 5);
    });
  });

  describe('promptQuality with SPACE framework', () => {
    it('uses SPACE weighted scoring for sessions with evaluation', () => {
      const evaluation = {
        prompt_quality: 5,
        context_provided: 4,
        independence_level: 3,
        scope_quality: 5,
        task_outcome: 'completed' as const,
        iteration_count: 1,
        tools_leveraged: 2,
      };
      const sessions = [makeSession({ evaluation })];

      const comps = computeAPSComponents(sessions, [], 0, spaceFramework);

      // SPACE: (5/5*0.30 + 4/5*0.25 + 3/5*0.25 + 5/5*0.20) * 100 = 84
      // promptQuality = 84 / 100 = 0.84
      const expectedScore = spaceFramework.computeSessionScore(evaluation);
      expect(comps.promptQuality).toBeCloseTo(expectedScore / 100, 5);
    });

    it('uses RAW equal-weight scoring when raw framework is passed', () => {
      const evaluation = {
        prompt_quality: 5,
        context_provided: 4,
        independence_level: 3,
        scope_quality: 5,
        task_outcome: 'completed' as const,
        iteration_count: 1,
        tools_leveraged: 2,
      };
      const sessions = [makeSession({ evaluation })];

      const comps = computeAPSComponents(sessions, [], 0, rawFramework);

      // RAW: (5+4+3+5)/20*100 = 85
      // promptQuality = 85/100 = 0.85
      const expectedScore = rawFramework.computeSessionScore(evaluation);
      expect(comps.promptQuality).toBeCloseTo(expectedScore / 100, 5);
    });

    it('falls back to simple average when no framework is passed', () => {
      const evaluation = {
        prompt_quality: 4,
        context_provided: 4,
        independence_level: 4,
        scope_quality: 4,
        task_outcome: 'completed' as const,
        iteration_count: 1,
        tools_leveraged: 1,
      };
      const sessions = [makeSession({ evaluation })];

      const comps = computeAPSComponents(sessions, [], 0);

      // Fallback: (4+4+4+4)/20 = 0.8
      expect(comps.promptQuality).toBeCloseTo(0.8, 5);
    });
  });

  describe('consistency component (streak)', () => {
    it('computes streak / 14 capped at 1', () => {
      expect(computeAPSComponents([], [], 7).consistency).toBeCloseTo(0.5, 5);
      expect(computeAPSComponents([], [], 14).consistency).toBe(1);
      expect(computeAPSComponents([], [], 28).consistency).toBe(1);
      expect(computeAPSComponents([], [], 0).consistency).toBe(0);
    });
  });

  describe('breadth component (unique languages)', () => {
    it('counts unique languages across sessions capped at 5', () => {
      const sessions = [
        makeSession({ session_id: 's1', languages: ['typescript', 'python'] }),
        makeSession({ session_id: 's2', languages: ['python', 'rust', 'go'] }),
      ];
      const comps = computeAPSComponents(sessions, [], 0);
      // unique: typescript, python, rust, go = 4 languages
      expect(comps.breadth).toBeCloseTo(4 / 5, 5);
    });

    it('caps breadth at 1.0 when 5+ unique languages', () => {
      const sessions = [
        makeSession({ languages: ['ts', 'py', 'rs', 'go', 'java', 'c'] }),
      ];
      const comps = computeAPSComponents(sessions, [], 0);
      expect(comps.breadth).toBe(1);
    });
  });
});
