import type { SessionEvaluation } from '../types/chain.js';
import type { EvaluationFramework, DimensionRubric } from './types.js';

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
  name: 'Raw',
  description: 'Equal-weight average across all scored dimensions. Minimal rubric guidance.',
  version: '1.0.0',
  rubrics,

  computeSessionScore(evaluation: SessionEvaluation): number {
    const { prompt_quality, context_provided, independence_level, scope_quality } = evaluation;
    return ((prompt_quality + context_provided + independence_level + scope_quality) / 20) * 100;
  },

  getInstructionText(): string {
    return '- At the END of every response, call `useai_end` with languages used, files_touched_count, milestones (generic descriptions only \u2014 no project names, file paths, or company names), and an `evaluation` object honestly assessing: prompt_quality (1-5), context_provided (1-5), task_outcome, iteration_count, independence_level (1-5), scope_quality (1-5), tools_leveraged count.';
  },
};
