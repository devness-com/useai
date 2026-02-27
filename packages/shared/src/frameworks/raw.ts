import type { SessionEvaluation } from '../types/chain.js';
import type { EvaluationFramework, DimensionRubric, InstructionTextOpts } from './types.js';

const rubrics: DimensionRubric[] = [
  {
    dimension: 'prompt_quality',
    label: 'Prompt Quality',
    weight: 0.25,
    levels: {
      1: 'Vague or ambiguous',
      2: 'Some goal stated but unclear',
      3: 'Clear goal, some missing details',
      4: 'Clear goal with most constraints',
      5: 'Crystal clear with acceptance criteria',
    },
  },
  {
    dimension: 'context_provided',
    label: 'Context Provided',
    weight: 0.25,
    levels: {
      1: 'No context provided',
      2: 'Minimal context',
      3: 'Some files or errors provided',
      4: 'Good context with some gaps',
      5: 'Comprehensive context with constraints',
    },
  },
  {
    dimension: 'independence_level',
    label: 'Independence Level',
    weight: 0.25,
    levels: {
      1: 'Needed constant guidance',
      2: 'Frequent back-and-forth',
      3: 'Some back-and-forth on approach',
      4: 'Mostly self-directed',
      5: 'Gave clear spec, AI executed autonomously',
    },
  },
  {
    dimension: 'scope_quality',
    label: 'Scope Quality',
    weight: 0.25,
    levels: {
      1: 'Vague or impossibly broad',
      2: 'Poorly defined scope',
      3: 'Reasonable scope with some ambiguity',
      4: 'Well-scoped with minor gaps',
      5: 'Precise, achievable, well-decomposed',
    },
  },
];

export const rawFramework: EvaluationFramework = {
  id: 'raw',
  name: 'Basic',
  description: 'Simple equal-weight average, no detailed rubric. Good for getting started.',
  version: '1.0.0',
  rubrics,

  computeSessionScore(evaluation: SessionEvaluation): number {
    const { prompt_quality, context_provided, independence_level, scope_quality } = evaluation;
    return ((prompt_quality + context_provided + independence_level + scope_quality) / 20) * 100;
  },

  getInstructionText(opts?: InstructionTextOpts): string {
    const reasonsLevel = opts?.evaluationReasons ?? 'all';
    const lines = [
      '- At the END of every response, call `useai_end` with languages used, files_touched_count, milestones, and an `evaluation` object honestly assessing: prompt_quality (1-5), context_provided (1-5), task_outcome, iteration_count, independence_level (1-5), scope_quality (1-5), tools_leveraged count.',
      '  - **milestones**: Array of objects, each with required `title` (string, generic — no project/file names), `category` (string), and optional `private_title` (string, detailed — can include project names and specifics). Example: `[{"title": "Implemented auth flow", "private_title": "Added OAuth2 to UserService in acme-api", "category": "feature"}]`',
      '  - **milestone category values**: feature, bugfix, refactor, test, docs, setup, deployment, fix, analysis, research, investigation, performance, cleanup, chore, security, migration, design, devops, config, other',
      '  - **task_type values**: coding, debugging, testing, planning, reviewing, documenting, learning, deployment, devops, research, migration, design, data, security, configuration, code_review, investigation, infrastructure, analysis, ops, setup, refactoring, other',
    ];
    if (reasonsLevel === 'all') {
      lines.push('- For EVERY scored metric, you MUST provide a *_reason field explaining the score. For < 5: what was lacking + tip to improve. For 5: what the user did well. Always provide task_outcome_reason.');
    } else if (reasonsLevel === 'below_perfect') {
      lines.push('- For any scored metric < 5, you MUST provide a *_reason field explaining what was lacking and a tip to improve. Only skip *_reason for a perfect 5. Always provide task_outcome_reason if outcome is not "completed".');
    }
    return lines.join('\n');
  },
};
