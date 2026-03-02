import { describe, it, expect } from 'vitest';
import { filterEvaluationReasons } from '../src/utils/sync-sanitize';
import type { SessionEvaluation } from '../src/types/chain';

/**
 * Integration: filterEvaluationReasons strips reason fields from evaluations
 * based on the configured level.
 */

describe('Sync sanitize integration', () => {
  describe('filterEvaluationReasons standalone', () => {
    it('removes all reason fields when level is none', () => {
      const evaluation: SessionEvaluation = {
        prompt_quality: 3,
        prompt_quality_reason: 'Reason',
        context_provided: 4,
        context_provided_reason: 'Reason',
        independence_level: 5,
        independence_level_reason: 'Reason',
        scope_quality: 2,
        scope_quality_reason: 'Reason',
        task_outcome: 'partial',
        task_outcome_reason: 'Blocked',
        iteration_count: 2,
        tools_leveraged: 1,
      };

      filterEvaluationReasons(evaluation, 'none');

      expect((evaluation as any).prompt_quality_reason).toBeUndefined();
      expect((evaluation as any).context_provided_reason).toBeUndefined();
      expect((evaluation as any).independence_level_reason).toBeUndefined();
      expect((evaluation as any).scope_quality_reason).toBeUndefined();
      expect((evaluation as any).task_outcome_reason).toBeUndefined();
    });

    it('keeps reasons for non-5 scores when level is below_perfect', () => {
      const evaluation: SessionEvaluation = {
        prompt_quality: 3,
        prompt_quality_reason: 'Needs improvement',
        context_provided: 5,
        context_provided_reason: 'Perfect',
        independence_level: 5,
        independence_level_reason: 'Autonomous',
        scope_quality: 4,
        scope_quality_reason: 'Minor gaps',
        task_outcome: 'blocked',
        task_outcome_reason: 'Dependency issue',
        iteration_count: 5,
        tools_leveraged: 3,
      };

      filterEvaluationReasons(evaluation, 'below_perfect');

      expect((evaluation as any).prompt_quality_reason).toBe('Needs improvement');
      expect((evaluation as any).context_provided_reason).toBeUndefined(); // 5 -> stripped
      expect((evaluation as any).independence_level_reason).toBeUndefined(); // 5 -> stripped
      expect((evaluation as any).scope_quality_reason).toBe('Minor gaps');
      expect((evaluation as any).task_outcome_reason).toBe('Dependency issue'); // not completed -> kept
    });

    it('preserves all reasons when level is all', () => {
      const evaluation: SessionEvaluation = {
        prompt_quality: 4,
        prompt_quality_reason: 'Good but missing edge cases',
        context_provided: 5,
        context_provided_reason: 'Excellent context',
        independence_level: 3,
        independence_level_reason: 'Some back-and-forth',
        scope_quality: 4,
        scope_quality_reason: 'Well scoped with minor gaps',
        task_outcome: 'completed',
        task_outcome_reason: 'All tests passing',
        iteration_count: 3,
        tools_leveraged: 2,
      };

      filterEvaluationReasons(evaluation, 'all');

      expect((evaluation as any).prompt_quality_reason).toBe('Good but missing edge cases');
      expect((evaluation as any).context_provided_reason).toBe('Excellent context');
      expect((evaluation as any).independence_level_reason).toBe('Some back-and-forth');
      expect((evaluation as any).scope_quality_reason).toBe('Well scoped with minor gaps');
      expect((evaluation as any).task_outcome_reason).toBe('All tests passing');
    });
  });
});
