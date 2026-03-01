import { describe, it, expect } from 'vitest';
import { sanitizeSealForSync, filterEvaluationReasons } from '../src/utils/sync-sanitize';
import { DEFAULT_SYNC_INCLUDE_CONFIG } from '../src/constants/defaults';
import type { SessionSeal, SessionEvaluation } from '../src/types/chain';
import type { SyncIncludeConfig } from '../src/types/config';

/**
 * Integration: sanitizeSealForSync uses SyncIncludeConfig (from constants/defaults)
 * and filterEvaluationReasons to strip fields from seals before cloud sync.
 * Tests verify full sanitization pipeline with real config values.
 */

function makeSeal(overrides: Partial<SessionSeal> = {}): SessionSeal {
  return {
    session_id: 'sess-1',
    client: 'claude-code',
    task_type: 'coding',
    languages: ['typescript', 'python'],
    files_touched: 5,
    prompt: 'Write a test for the auth module',
    prompt_images: [{ type: 'image', description: 'screenshot of error' }],
    private_title: 'Auth test for acme-api',
    project: 'acme-api',
    model: 'claude-3-opus',
    title: 'Auth test',
    started_at: '2025-03-01T09:00:00Z',
    ended_at: '2025-03-01T10:00:00Z',
    duration_seconds: 3600,
    heartbeat_count: 1,
    record_count: 4,
    chain_start_hash: 'abc',
    chain_end_hash: 'def',
    seal_signature: 'sig',
    evaluation: {
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
    },
    session_score: 85,
    evaluation_framework: 'space',
    ...overrides,
  };
}

describe('Sync sanitize integration', () => {
  describe('sanitizeSealForSync with default config', () => {
    it('strips prompts, private_titles, and projects with defaults', () => {
      const seal = makeSeal();
      const result = sanitizeSealForSync(seal, DEFAULT_SYNC_INCLUDE_CONFIG);

      // Default: prompts=false, private_titles=false, projects=false
      expect(result.prompt).toBeUndefined();
      expect(result.prompt_images).toBeUndefined();
      expect(result.private_title).toBeUndefined();
      expect(result.project).toBeUndefined();
      // Default: model=true, languages=true, evaluations=true
      expect(result.model).toBe('claude-3-opus');
      expect(result.languages).toEqual(['typescript', 'python']);
      expect(result.evaluation).toBeDefined();
    });

    it('does not mutate the original seal', () => {
      const seal = makeSeal();
      const originalPrompt = seal.prompt;
      sanitizeSealForSync(seal, DEFAULT_SYNC_INCLUDE_CONFIG);

      expect(seal.prompt).toBe(originalPrompt);
      expect(seal.private_title).toBe('Auth test for acme-api');
    });
  });

  describe('sanitizeSealForSync with custom include configs', () => {
    it('includes prompts when config allows it', () => {
      const include: SyncIncludeConfig = {
        ...DEFAULT_SYNC_INCLUDE_CONFIG,
        prompts: true,
      };
      const seal = makeSeal();
      const result = sanitizeSealForSync(seal, include);

      expect(result.prompt).toBe('Write a test for the auth module');
    });

    it('strips evaluation when evaluations is false', () => {
      const include: SyncIncludeConfig = {
        ...DEFAULT_SYNC_INCLUDE_CONFIG,
        evaluations: false,
      };
      const seal = makeSeal();
      const result = sanitizeSealForSync(seal, include);

      expect(result.evaluation).toBeUndefined();
      expect(result.session_score).toBeUndefined();
      expect(result.evaluation_framework).toBeUndefined();
    });

    it('empties languages array when languages is false', () => {
      const include: SyncIncludeConfig = {
        ...DEFAULT_SYNC_INCLUDE_CONFIG,
        languages: false,
      };
      const seal = makeSeal();
      const result = sanitizeSealForSync(seal, include);

      expect(result.languages).toEqual([]);
    });

    it('strips model when model is false', () => {
      const include: SyncIncludeConfig = {
        ...DEFAULT_SYNC_INCLUDE_CONFIG,
        model: false,
      };
      const seal = makeSeal();
      const result = sanitizeSealForSync(seal, include);

      expect(result.model).toBeUndefined();
    });
  });

  describe('filterEvaluationReasons integration via sanitizeSealForSync', () => {
    it('strips all reasons when evaluation_reasons is none', () => {
      const seal = makeSeal();
      const result = sanitizeSealForSync(seal, DEFAULT_SYNC_INCLUDE_CONFIG, 'none');

      expect(result.evaluation).toBeDefined();
      expect((result.evaluation as any).prompt_quality_reason).toBeUndefined();
      expect((result.evaluation as any).context_provided_reason).toBeUndefined();
      expect((result.evaluation as any).independence_level_reason).toBeUndefined();
      expect((result.evaluation as any).scope_quality_reason).toBeUndefined();
      expect((result.evaluation as any).task_outcome_reason).toBeUndefined();
      // Scores should be preserved
      expect(result.evaluation!.prompt_quality).toBe(4);
    });

    it('strips reasons for perfect 5s when evaluation_reasons is below_perfect', () => {
      const seal = makeSeal();
      const result = sanitizeSealForSync(seal, DEFAULT_SYNC_INCLUDE_CONFIG, 'below_perfect');

      // context_provided=5 → reason stripped
      expect((result.evaluation as any).context_provided_reason).toBeUndefined();
      // prompt_quality=4, independence_level=3, scope_quality=4 → reasons kept
      expect((result.evaluation as any).prompt_quality_reason).toBe('Good but missing edge cases');
      expect((result.evaluation as any).independence_level_reason).toBe('Some back-and-forth');
      expect((result.evaluation as any).scope_quality_reason).toBe('Well scoped with minor gaps');
      // task_outcome=completed → task_outcome_reason stripped
      expect((result.evaluation as any).task_outcome_reason).toBeUndefined();
    });

    it('preserves all reasons when evaluation_reasons is all', () => {
      const seal = makeSeal();
      const result = sanitizeSealForSync(seal, DEFAULT_SYNC_INCLUDE_CONFIG, 'all');

      expect((result.evaluation as any).prompt_quality_reason).toBe('Good but missing edge cases');
      expect((result.evaluation as any).context_provided_reason).toBe('Excellent context');
      expect((result.evaluation as any).task_outcome_reason).toBe('All tests passing');
    });
  });

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
      expect((evaluation as any).context_provided_reason).toBeUndefined(); // 5 → stripped
      expect((evaluation as any).independence_level_reason).toBeUndefined(); // 5 → stripped
      expect((evaluation as any).scope_quality_reason).toBe('Minor gaps');
      expect((evaluation as any).task_outcome_reason).toBe('Dependency issue'); // not completed → kept
    });
  });
});
