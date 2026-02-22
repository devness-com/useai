import type { SessionSeal } from '../types/chain.js';
import type { Milestone } from '../types/milestone.js';
import type { EvaluationFramework } from '../frameworks/types.js';
import type { APSComponents } from './types.js';

const COMPLEXITY_WEIGHTS: Record<string, number> = {
  simple: 1,
  trivial: 1,
  easy: 1,
  low: 1,
  medium: 2,
  moderate: 2,
  complex: 4,
  hard: 4,
  difficult: 4,
  high: 4,
};

export function computeAPSComponents(
  sessions: SessionSeal[],
  milestones: Milestone[],
  streak: number,
  framework?: EvaluationFramework,
): APSComponents {
  // Output: complexity-weighted milestones, capped at 10
  const complexityWeighted = milestones.reduce((sum, m) => {
    return sum + (COMPLEXITY_WEIGHTS[m.complexity] ?? 2);
  }, 0);
  const output = Math.min(1, complexityWeighted / 10);

  // Efficiency: files per hour, capped at 20/hr
  const totalFiles = sessions.reduce((sum, s) => sum + (s.files_touched ?? 0), 0);
  const totalHours = sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 3600;
  const efficiency = Math.min(1, totalFiles / Math.max(totalHours, 1) / 20);

  // Prompt Quality: average session scores via framework
  let promptQuality = 0;
  const sessionsWithEval = sessions.filter((s) => s.evaluation);
  if (sessionsWithEval.length > 0) {
    if (framework) {
      const totalScore = sessionsWithEval.reduce((sum, s) => {
        return sum + framework.computeSessionScore(s.evaluation!);
      }, 0);
      promptQuality = totalScore / sessionsWithEval.length / 100;
    } else {
      // Fallback: simple average of 4 scored dimensions
      const totalScore = sessionsWithEval.reduce((sum, s) => {
        const e = s.evaluation!;
        return sum + (e.prompt_quality + e.context_provided + e.independence_level + e.scope_quality) / 20;
      }, 0);
      promptQuality = totalScore / sessionsWithEval.length;
    }
  }

  // Consistency: streak days, capped at 14
  const consistency = Math.min(1, streak / 14);

  // Breadth: unique languages, capped at 5
  const uniqueLanguages = new Set(sessions.flatMap((s) => s.languages ?? []));
  const breadth = Math.min(1, uniqueLanguages.size / 5);

  return { output, efficiency, promptQuality, consistency, breadth };
}
