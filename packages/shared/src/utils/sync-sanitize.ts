import type { SessionSeal, SessionEvaluation } from '../types/chain.js';
import type { SyncIncludeConfig, EvaluationReasonsLevel } from '../types/config.js';

/**
 * Strip reason fields from an evaluation based on the configured level.
 * Mutates the evaluation object in place.
 */
export function filterEvaluationReasons(evaluation: SessionEvaluation, level: EvaluationReasonsLevel): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ev = evaluation as any;

  const reasonKeys = [
    'prompt_quality_reason',
    'context_provided_reason',
    'independence_level_reason',
    'scope_quality_reason',
  ] as const;

  if (level === 'none') {
    for (const key of reasonKeys) {
      delete ev[key];
    }
    delete ev.task_outcome_reason;
  } else if (level === 'below_perfect') {
    const scoreMap: Record<string, string> = {
      prompt_quality_reason: 'prompt_quality',
      context_provided_reason: 'context_provided',
      independence_level_reason: 'independence_level',
      scope_quality_reason: 'scope_quality',
    };
    for (const [reasonKey, scoreKey] of Object.entries(scoreMap)) {
      if (ev[scoreKey] === 5) {
        delete ev[reasonKey];
      }
    }
    // task_outcome_reason: keep if not 'completed', strip if completed
    if (evaluation.task_outcome === 'completed') {
      delete ev.task_outcome_reason;
    }
  }
}

/**
 * Sanitize a SessionSeal for cloud sync based on user's sync.include config.
 * The evaluationReasonsLevel is inherited from capture.evaluation_reasons.
 * Returns a new object — does not mutate the original.
 */
export function sanitizeSealForSync(
  seal: SessionSeal,
  include: SyncIncludeConfig,
  evaluationReasonsLevel?: EvaluationReasonsLevel,
): SessionSeal {
  const s = { ...seal };

  if (!include.prompts) {
    delete s.prompt;
    delete s.prompt_images;
  }
  if (!include.private_titles) delete s.private_title;
  if (!include.projects) delete s.project;
  if (!include.model) delete s.model;
  if (!include.languages) s.languages = [];

  const reasonsLevel = evaluationReasonsLevel ?? 'all';
  if (!include.evaluations) {
    delete s.evaluation;
    delete s.session_score;
    delete s.evaluation_framework;
  } else if (s.evaluation && reasonsLevel !== 'all') {
    s.evaluation = { ...s.evaluation };
    filterEvaluationReasons(s.evaluation, reasonsLevel);
  }

  return s;
}
