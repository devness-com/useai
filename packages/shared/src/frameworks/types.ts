import type { SessionEvaluation } from '../types/chain.js';

export type EvaluationFrameworkId = 'raw' | 'space';

export interface DimensionRubric {
  dimension: string;
  label: string;
  spaceMapping?: string;
  weight: number;
  levels: Record<1 | 2 | 3 | 4 | 5, string>;
}

export interface EvaluationFramework {
  id: EvaluationFrameworkId;
  name: string;
  description: string;
  version: string;
  rubrics: DimensionRubric[];
  computeSessionScore(evaluation: SessionEvaluation): number;
  getInstructionText(): string;
}
