import type { SessionEvaluation } from '../types/chain.js';
import type { EvaluationReasonsLevel } from '../types/config.js';

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
