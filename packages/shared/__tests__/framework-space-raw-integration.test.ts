import { describe, it, expect } from 'vitest';
import { spaceFramework } from '../src/frameworks/space';
import { rawFramework } from '../src/frameworks/raw';
import type { SessionEvaluation } from '../src/types/chain';

/**
 * Integration: Tests that SPACE and RAW framework objects have consistent
 * structure, scoring behavior, and instruction text generation.
 */

describe('SPACE and RAW framework structure integration', () => {
  it('both frameworks have required properties', () => {
    for (const fw of [spaceFramework, rawFramework]) {
      expect(fw.id).toBeTruthy();
      expect(fw.name).toBeTruthy();
      expect(fw.description).toBeTruthy();
      expect(fw.version).toBeTruthy();
      expect(fw.rubrics).toBeInstanceOf(Array);
      expect(fw.rubrics.length).toBeGreaterThanOrEqual(4);
      expect(typeof fw.computeSessionScore).toBe('function');
      expect(typeof fw.getInstructionText).toBe('function');
    }
  });

  it('both frameworks have rubrics covering the same 4 dimensions', () => {
    const expectedDimensions = ['prompt_quality', 'context_provided', 'independence_level', 'scope_quality'];

    for (const fw of [spaceFramework, rawFramework]) {
      const dimensions = fw.rubrics.map((r) => r.dimension);
      for (const dim of expectedDimensions) {
        expect(dimensions).toContain(dim);
      }
    }
  });

  it('rubric weights sum to 1.0 for both frameworks', () => {
    for (const fw of [spaceFramework, rawFramework]) {
      const totalWeight = fw.rubrics.reduce((sum, r) => sum + r.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 5);
    }
  });

  it('each rubric has 5 levels (1-5)', () => {
    for (const fw of [spaceFramework, rawFramework]) {
      for (const rubric of fw.rubrics) {
        expect(Object.keys(rubric.levels).length).toBe(5);
        for (const level of [1, 2, 3, 4, 5] as const) {
          expect(rubric.levels[level]).toBeTruthy();
        }
      }
    }
  });
});

describe('Framework scoring edge cases', () => {
  const minEval: SessionEvaluation = {
    prompt_quality: 1,
    context_provided: 1,
    independence_level: 1,
    scope_quality: 1,
    task_outcome: 'abandoned',
    iteration_count: 10,
    tools_leveraged: 0,
  };

  const maxEval: SessionEvaluation = {
    prompt_quality: 5,
    context_provided: 5,
    independence_level: 5,
    scope_quality: 5,
    task_outcome: 'completed',
    iteration_count: 1,
    tools_leveraged: 5,
  };

  it('minimum scores produce 20 for both frameworks', () => {
    // All 1s: (1+1+1+1)/20*100 = 20 for RAW
    // SPACE: (1/5*0.30 + 1/5*0.25 + 1/5*0.25 + 1/5*0.20)*100 = 20
    expect(rawFramework.computeSessionScore(minEval)).toBeCloseTo(20, 0);
    expect(spaceFramework.computeSessionScore(minEval)).toBeCloseTo(20, 0);
  });

  it('maximum scores produce 100 for both frameworks', () => {
    expect(rawFramework.computeSessionScore(maxEval)).toBe(100);
    expect(spaceFramework.computeSessionScore(maxEval)).toBe(100);
  });

  it('SPACE weights prompt_quality more heavily than scope_quality', () => {
    const highPrompt: SessionEvaluation = {
      ...minEval,
      prompt_quality: 5,
      scope_quality: 1,
    };
    const highScope: SessionEvaluation = {
      ...minEval,
      prompt_quality: 1,
      scope_quality: 5,
    };

    const promptScore = spaceFramework.computeSessionScore(highPrompt);
    const scopeScore = spaceFramework.computeSessionScore(highScope);

    // prompt weight 0.30 > scope weight 0.20
    expect(promptScore).toBeGreaterThan(scopeScore);
  });

  it('RAW weights all dimensions equally', () => {
    const base: SessionEvaluation = {
      prompt_quality: 1,
      context_provided: 1,
      independence_level: 1,
      scope_quality: 1,
      task_outcome: 'completed',
      iteration_count: 1,
      tools_leveraged: 1,
    };

    // Raising any single dimension by 1 should give the same increase
    const dims = ['prompt_quality', 'context_provided', 'independence_level', 'scope_quality'] as const;
    const scores = dims.map((dim) => {
      const e = { ...base, [dim]: 2 };
      return rawFramework.computeSessionScore(e);
    });

    // All should be equal since RAW uses equal weights
    for (const score of scores) {
      expect(score).toBeCloseTo(scores[0], 5);
    }
  });
});

describe('Framework instruction text integration', () => {
  it('SPACE instruction text includes SPACE framework keyword', () => {
    const text = spaceFramework.getInstructionText();
    expect(text).toContain('SPACE framework');
  });

  it('RAW instruction text does not include SPACE keyword', () => {
    const text = rawFramework.getInstructionText();
    expect(text).not.toContain('SPACE framework');
  });

  it('both frameworks include milestone format instructions', () => {
    for (const fw of [spaceFramework, rawFramework]) {
      const text = fw.getInstructionText();
      expect(text).toContain('milestones');
      expect(text).toContain('title');
      expect(text).toContain('category');
    }
  });

  it('both frameworks include task_type values', () => {
    for (const fw of [spaceFramework, rawFramework]) {
      const text = fw.getInstructionText();
      expect(text).toContain('coding');
      expect(text).toContain('debugging');
    }
  });

  it('both frameworks respect evaluationReasons option', () => {
    for (const fw of [spaceFramework, rawFramework]) {
      const allText = fw.getInstructionText({ evaluationReasons: 'all' });
      expect(allText).toContain('EVERY scored metric');

      const belowText = fw.getInstructionText({ evaluationReasons: 'below_perfect' });
      expect(belowText).toContain('metric < 5');

      const noneText = fw.getInstructionText({ evaluationReasons: 'none' });
      expect(noneText).not.toContain('EVERY scored metric');
      expect(noneText).not.toContain('metric < 5');
    }
  });
});
