import type { SessionEvaluation } from '../types/chain.js';
import type { EvaluationFramework, DimensionRubric, InstructionTextOpts } from './types.js';

const rubrics: DimensionRubric[] = [
  {
    dimension: 'prompt_quality',
    label: 'Prompt Quality',
    spaceMapping: 'Communication',
    weight: 0.30,
    levels: {
      1: 'Vague, no goal stated, AI must guess intent entirely',
      2: 'Goal implied but ambiguous, missing key constraints',
      3: 'Clear goal, some constraints provided, missing edge cases',
      4: 'Clear goal with constraints, minor ambiguity remains',
      5: 'Crystal clear goal, all constraints stated, acceptance criteria defined',
    },
  },
  {
    dimension: 'context_provided',
    label: 'Context Provided',
    spaceMapping: 'Communication',
    weight: 0.25,
    levels: {
      1: 'No context provided \u2014 no files, errors, or background',
      2: 'Minimal context \u2014 vague references without specifics',
      3: 'Some files or errors provided but incomplete picture',
      4: 'Good context with relevant files, errors, and background',
      5: 'Comprehensive context: files, errors, constraints, and expected behavior',
    },
  },
  {
    dimension: 'independence_level',
    label: 'Independence Level',
    spaceMapping: 'Efficiency',
    weight: 0.25,
    levels: {
      1: 'Needed constant guidance, every step required approval',
      2: 'Frequent back-and-forth, many clarifying questions needed',
      3: 'Some back-and-forth on approach, core decisions made by user',
      4: 'Mostly self-directed, only major decisions needed input',
      5: 'Gave clear spec, AI executed autonomously with minimal interruption',
    },
  },
  {
    dimension: 'scope_quality',
    label: 'Scope Quality',
    spaceMapping: 'Performance',
    weight: 0.20,
    levels: {
      1: 'Vague or impossibly broad \u2014 no clear deliverable',
      2: 'Poorly defined \u2014 scope creep likely, unclear boundaries',
      3: 'Reasonable scope with some ambiguity in deliverables',
      4: 'Well-scoped with clear deliverables, minor gaps',
      5: 'Precise, achievable, well-decomposed into actionable steps',
    },
  },
];

export const spaceFramework: EvaluationFramework = {
  id: 'space',
  name: 'SPACE',
  description: 'Based on the SPACE developer productivity framework (GitHub/Microsoft Research). Weighted rubrics with explicit per-level criteria.',
  version: '1.0.0',
  rubrics,

  computeSessionScore(evaluation: SessionEvaluation): number {
    const { prompt_quality, context_provided, independence_level, scope_quality } = evaluation;
    return (
      (prompt_quality / 5) * 0.30 +
      (context_provided / 5) * 0.25 +
      (independence_level / 5) * 0.25 +
      (scope_quality / 5) * 0.20
    ) * 100;
  },

  getInstructionText(opts?: InstructionTextOpts): string {
    const reasonsLevel = opts?.evaluationReasons ?? 'all';
    const lines = [
      '- At the END of every response, call `useai_end` with languages used, files_touched_count, milestones, and an `evaluation` object.',
      '  - **milestones**: Array of objects, each with required `title` (string, generic — no project/file names), `category` (string), and optional `private_title` (string, detailed — can include project names and specifics). Example: `[{"title": "Implemented auth flow", "private_title": "Added OAuth2 to UserService in acme-api", "category": "feature"}]`',
      '  - **milestone category values**: feature, bugfix, refactor, test, docs, setup, deployment, fix, analysis, research, investigation, performance, cleanup, chore, security, migration, design, devops, config, other',
      '  - **task_type values**: coding, debugging, testing, planning, reviewing, documenting, learning, deployment, devops, research, migration, design, data, security, configuration, code_review, investigation, infrastructure, analysis, ops, setup, refactoring, other',
      '- **Evaluation rubric (SPACE framework):** Score each metric 1-5 using these criteria:',
      '  - **prompt_quality** (Communication, weight 0.30): 1=vague/no goal, 3=clear goal but missing edge cases, 5=crystal clear with acceptance criteria',
      '  - **context_provided** (Communication, weight 0.25): 1=no context, 3=some files/errors but incomplete, 5=comprehensive with constraints',
      '  - **independence_level** (Efficiency, weight 0.25): 1=constant guidance needed, 3=some back-and-forth, 5=clear spec with autonomous execution',
      '  - **scope_quality** (Performance, weight 0.20): 1=vague/impossibly broad, 3=reasonable with ambiguity, 5=precise and well-decomposed',
      '- Also include: task_outcome (completed/partial/abandoned/blocked), iteration_count, tools_leveraged count.',
    ];
    if (reasonsLevel === 'all') {
      lines.push('- For EVERY scored metric, you MUST provide a *_reason field explaining the score. For < 5: what was lacking + tip to improve. For 5: what the user did well. Always provide task_outcome_reason.');
    } else if (reasonsLevel === 'below_perfect') {
      lines.push('- For any scored metric < 5, you MUST provide a *_reason field explaining what was lacking and a tip to improve. Only skip *_reason for a perfect 5. Always provide task_outcome_reason if outcome is not "completed".');
    }
    // 'none' → no mention of reasons
    return lines.join('\n');
  },
};
