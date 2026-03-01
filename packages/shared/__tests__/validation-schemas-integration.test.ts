import { describe, it, expect } from 'vitest';
import {
  taskTypeSchema,
  milestoneCategorySchema,
  complexitySchema,
  milestoneInputSchema,
  syncPayloadSchema,
  publishPayloadSchema,
} from '../src/validation/schemas';

/**
 * Integration: Validates that schemas work together — milestoneInputSchema
 * composes milestoneCategorySchema + complexitySchema. syncPayloadSchema
 * validates full sync payloads. Tests verify real data flows through
 * nested schema composition with aliases.
 */

describe('Validation schemas integration', () => {
  describe('milestoneInputSchema composes category + complexity', () => {
    it('accepts valid milestone input with canonical values', () => {
      const result = milestoneInputSchema.safeParse({
        title: 'Implemented user auth',
        category: 'feature',
        complexity: 'medium',
      });
      expect(result.success).toBe(true);
    });

    it('accepts milestone input with aliased category and complexity', () => {
      const result = milestoneInputSchema.safeParse({
        title: 'Fixed login bug',
        category: 'bug',       // alias → bugfix
        complexity: 'basic',   // alias → simple
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('bugfix');
        expect(result.data.complexity).toBe('simple');
      }
    });

    it('allows complexity to be optional', () => {
      const result = milestoneInputSchema.safeParse({
        title: 'Added docs',
        category: 'docs',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.complexity).toBeUndefined();
      }
    });

    it('rejects empty title', () => {
      const result = milestoneInputSchema.safeParse({
        title: '',
        category: 'feature',
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown category', () => {
      const result = milestoneInputSchema.safeParse({
        title: 'Something',
        category: 'nonexistent_category',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('taskTypeSchema with aliases', () => {
    it('accepts canonical task types', () => {
      const types = ['coding', 'debugging', 'testing', 'planning', 'reviewing'];
      for (const t of types) {
        expect(taskTypeSchema.safeParse(t).success, `${t} should be valid`).toBe(true);
      }
    });

    it('normalizes verb aliases to canonical gerund forms', () => {
      const aliases: Record<string, string> = {
        review: 'reviewing',
        document: 'documenting',
        debug: 'debugging',
        test: 'testing',
        code: 'coding',
        plan: 'planning',
        refactor: 'refactoring',
      };

      for (const [alias, canonical] of Object.entries(aliases)) {
        const result = taskTypeSchema.safeParse(alias);
        expect(result.success, `${alias} should be valid`).toBe(true);
        if (result.success) {
          expect(result.data).toBe(canonical);
        }
      }
    });

    it('rejects completely invalid task types', () => {
      expect(taskTypeSchema.safeParse('swimming').success).toBe(false);
      expect(taskTypeSchema.safeParse('').success).toBe(false);
      expect(taskTypeSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('complexitySchema with aliases', () => {
    it('accepts canonical complexity levels', () => {
      const levels = ['simple', 'medium', 'complex', 'low', 'high', 'trivial', 'easy', 'moderate', 'hard', 'difficult'];
      for (const l of levels) {
        expect(complexitySchema.safeParse(l).success, `${l} should be valid`).toBe(true);
      }
    });

    it('normalizes basic → simple, intermediate → medium, advanced → complex', () => {
      expect(complexitySchema.parse('basic')).toBe('simple');
      expect(complexitySchema.parse('intermediate')).toBe('medium');
      expect(complexitySchema.parse('advanced')).toBe('complex');
    });
  });

  describe('milestoneCategorySchema with aliases', () => {
    it('normalizes common aliases', () => {
      expect(milestoneCategorySchema.parse('bug')).toBe('bugfix');
      expect(milestoneCategorySchema.parse('bug-fix')).toBe('bugfix');
      expect(milestoneCategorySchema.parse('doc')).toBe('docs');
      expect(milestoneCategorySchema.parse('feat')).toBe('feature');
      expect(milestoneCategorySchema.parse('perf')).toBe('performance');
      expect(milestoneCategorySchema.parse('refactoring')).toBe('refactor');
    });
  });

  describe('syncPayloadSchema validates full sync payload', () => {
    it('accepts a valid sync payload', () => {
      const payload = {
        date: '2025-03-01',
        total_seconds: 7200,
        clients: { 'claude-code': 3600, cursor: 3600 },
        task_types: { coding: 5400, debugging: 1800 },
        languages: { typescript: 7200 },
        sessions: [
          {
            session_id: 'sess-1',
            client: 'claude-code',
            task_type: 'coding',
            languages: ['typescript'],
            files_touched: 5,
            started_at: '2025-03-01T09:00:00Z',
            ended_at: '2025-03-01T10:00:00Z',
            duration_seconds: 3600,
            heartbeat_count: 1,
            record_count: 4,
            chain_start_hash: 'abc',
            chain_end_hash: 'def',
            seal_signature: 'sig',
          },
        ],
        sync_signature: 'sync-sig',
      };

      const result = syncPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const payload = {
        date: '03-01-2025', // invalid format
        total_seconds: 0,
        clients: {},
        task_types: {},
        languages: {},
        sessions: [],
        sync_signature: 'sig',
      };

      expect(syncPayloadSchema.safeParse(payload).success).toBe(false);
    });

    it('rejects negative total_seconds', () => {
      const payload = {
        date: '2025-03-01',
        total_seconds: -1,
        clients: {},
        task_types: {},
        languages: {},
        sessions: [],
        sync_signature: 'sig',
      };

      expect(syncPayloadSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe('publishPayloadSchema validates milestone publishing', () => {
    it('accepts valid publish payload', () => {
      const payload = {
        milestones: [
          {
            id: 'ms-1',
            title: 'Implemented auth',
            category: 'feature',
            complexity: 'medium',
            duration_minutes: 30,
            languages: ['typescript'],
            client: 'claude-code',
            chain_hash: 'hash-1',
          },
        ],
      };

      const result = publishPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('normalizes category aliases in publish payload', () => {
      const payload = {
        milestones: [
          {
            id: 'ms-1',
            title: 'Fix login',
            category: 'bug',         // alias → bugfix
            complexity: 'basic',     // alias → simple
            duration_minutes: 15,
            languages: ['python'],
            client: 'cursor',
            chain_hash: 'hash-2',
          },
        ],
      };

      const result = publishPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.milestones[0].category).toBe('bugfix');
        expect(result.data.milestones[0].complexity).toBe('simple');
      }
    });
  });
});
