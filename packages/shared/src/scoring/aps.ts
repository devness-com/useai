import type { SessionSeal } from '../types/chain.js';
import type { Milestone } from '../types/milestone.js';
import type { EvaluationFramework } from '../frameworks/types.js';
import { getFramework } from '../frameworks/registry.js';
import type { APSResult } from './types.js';
import { computeAPSComponents } from './components.js';

const APS_WEIGHTS = {
  output: 0.25,
  efficiency: 0.25,
  promptQuality: 0.20,
  consistency: 0.15,
  breadth: 0.15,
};

export function computeLocalAPS(
  sessions: SessionSeal[],
  milestones: Milestone[],
  streak: number,
  framework?: EvaluationFramework,
): APSResult {
  const fw = framework ?? getFramework();
  const components = computeAPSComponents(sessions, milestones, streak, fw);

  const weightedSum =
    components.output * APS_WEIGHTS.output +
    components.efficiency * APS_WEIGHTS.efficiency +
    components.promptQuality * APS_WEIGHTS.promptQuality +
    components.consistency * APS_WEIGHTS.consistency +
    components.breadth * APS_WEIGHTS.breadth;

  const score = Math.round(weightedSum * 1000);

  // Determine time window from sessions
  let start = '';
  let end = '';
  if (sessions.length > 0) {
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    );
    start = sorted[0]!.started_at;
    end = sorted[sorted.length - 1]!.ended_at;
  }

  return {
    score,
    components,
    sessionCount: sessions.length,
    framework: fw.id,
    window: { start, end },
  };
}
