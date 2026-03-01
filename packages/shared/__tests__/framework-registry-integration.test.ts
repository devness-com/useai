import { describe, it, expect } from 'vitest';
import { getFramework, getFrameworkIds, buildInstructionsText } from '../src/frameworks/registry';
import { rawFramework } from '../src/frameworks/raw';
import { spaceFramework } from '../src/frameworks/space';
import type { SessionEvaluation } from '../src/types/chain';

/**
 * Integration: getFramework + buildInstructionsText exercise the registry,
 * framework objects, and their instruction text generation together.
 */

describe('Framework registry integration', () => {
  describe('getFramework', () => {
    it('returns SPACE framework by default', () => {
      const fw = getFramework();
      expect(fw.id).toBe('space');
      expect(fw).toBe(spaceFramework);
    });

    it('returns RAW framework by id', () => {
      const fw = getFramework('raw');
      expect(fw.id).toBe('raw');
      expect(fw).toBe(rawFramework);
    });

    it('returns SPACE framework for unknown ids', () => {
      const fw = getFramework('unknown');
      expect(fw.id).toBe('space');
    });

    it('returns SPACE for undefined', () => {
      const fw = getFramework(undefined);
      expect(fw.id).toBe('space');
    });
  });

  describe('getFrameworkIds', () => {
    it('returns array containing space and raw', () => {
      const ids = getFrameworkIds();
      expect(ids).toContain('space');
      expect(ids).toContain('raw');
      expect(ids.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('framework scoring comparison', () => {
    it('SPACE and RAW produce different scores for non-uniform evaluations', () => {
      const evaluation: SessionEvaluation = {
        prompt_quality: 5,
        context_provided: 3,
        independence_level: 2,
        scope_quality: 4,
        task_outcome: 'completed',
        iteration_count: 3,
        tools_leveraged: 2,
      };

      const spaceScore = spaceFramework.computeSessionScore(evaluation);
      const rawScore = rawFramework.computeSessionScore(evaluation);

      // SPACE: (5/5*0.30 + 3/5*0.25 + 2/5*0.25 + 4/5*0.20) * 100
      // = (0.30 + 0.15 + 0.10 + 0.16) * 100 = 71
      expect(spaceScore).toBeCloseTo(71, 0);
      // RAW: (5+3+2+4)/20*100 = 70
      expect(rawScore).toBeCloseTo(70, 0);
      expect(spaceScore).not.toBe(rawScore);
    });

    it('SPACE and RAW produce same scores for uniform evaluations', () => {
      const evaluation: SessionEvaluation = {
        prompt_quality: 5,
        context_provided: 5,
        independence_level: 5,
        scope_quality: 5,
        task_outcome: 'completed',
        iteration_count: 1,
        tools_leveraged: 5,
      };

      const spaceScore = spaceFramework.computeSessionScore(evaluation);
      const rawScore = rawFramework.computeSessionScore(evaluation);

      expect(spaceScore).toBe(100);
      expect(rawScore).toBe(100);
    });
  });

  describe('buildInstructionsText', () => {
    it('includes UseAI Session Tracking header', () => {
      const text = buildInstructionsText();
      expect(text).toContain('## UseAI Session Tracking');
    });

    it('includes useai_start and useai_end instructions', () => {
      const text = buildInstructionsText('space');
      expect(text).toContain('useai_start');
      expect(text).toContain('useai_end');
    });

    it('includes SPACE rubric details when framework is space', () => {
      const text = buildInstructionsText('space');
      expect(text).toContain('SPACE framework');
      expect(text).toContain('prompt_quality');
    });

    it('includes prompt capture instruction by default', () => {
      const text = buildInstructionsText('raw');
      expect(text).toContain('prompt');
    });

    it('omits prompt capture instruction when capturePrompt is false', () => {
      const text = buildInstructionsText('raw', { capturePrompt: false });
      expect(text).not.toContain("user's full verbatim prompt text");
    });

    it('includes reasons instructions based on evaluationReasons level', () => {
      const allText = buildInstructionsText('space', { evaluationReasons: 'all' });
      expect(allText).toContain('EVERY scored metric');

      const belowText = buildInstructionsText('space', { evaluationReasons: 'below_perfect' });
      expect(belowText).toContain('metric < 5');

      const noneText = buildInstructionsText('space', { evaluationReasons: 'none' });
      expect(noneText).not.toContain('EVERY scored metric');
      expect(noneText).not.toContain('metric < 5');
    });
  });
});
