import { z } from 'zod';

/**
 * Creates an enum schema that normalizes common aliases before validation.
 * Models often send close-but-not-exact values (e.g. "review" instead of "reviewing").
 * The preprocess step maps known aliases to canonical values before the enum check,
 * while unknown values still fail validation as expected.
 */
function enumWithAliases<T extends [string, ...string[]]>(
  values: T,
  aliases: Record<string, T[number]>,
) {
  return z.preprocess(
    (val) => (typeof val === 'string' ? (aliases[val] ?? val) : val),
    z.enum(values),
  );
}

export const taskTypeSchema = enumWithAliases(
  [
    'coding',
    'debugging',
    'testing',
    'planning',
    'reviewing',
    'documenting',
    'learning',
    'deployment',
    'devops',
    'research',
    'migration',
    'design',
    'data',
    'security',
    'configuration',
    // aliases accepted directly in enum (visible in JSON Schema)
    'code_review',
    'code-review',
    'investigation',
    'infrastructure',
    'analysis',
    'ops',
    'setup',
    'refactoring',
    'other',
  ],
  {
    // verb/truncated forms → canonical gerund/noun
    review: 'reviewing',
    document: 'documenting',
    debug: 'debugging',
    test: 'testing',
    code: 'coding',
    learn: 'learning',
    deploy: 'deployment',
    plan: 'planning',
    migrate: 'migration',
    refactor: 'refactoring',
    investigate: 'investigation',
    configure: 'configuration',
    designing: 'design',
  },
);

export const milestoneCategorySchema = enumWithAliases(
  [
    'feature',
    'bugfix',
    'refactor',
    'test',
    'docs',
    'setup',
    'deployment',
    // aliases accepted directly in enum (visible in JSON Schema)
    'fix',
    'bug_fix',
    'testing',
    'documentation',
    'config',
    'configuration',
    'analysis',
    'research',
    'investigation',
    'performance',
    'cleanup',
    'chore',
    'security',
    'migration',
    'design',
    'devops',
    'other',
  ],
  {
    // common model shorthand → canonical
    bug: 'bugfix',
    'bug-fix': 'bugfix',
    doc: 'docs',
    document: 'docs',
    documenting: 'docs',
    feat: 'feature',
    perf: 'performance',
    refactoring: 'refactor',
  },
);

export const complexitySchema = enumWithAliases(
  [
    'simple',
    'medium',
    'complex',
    // aliases accepted directly in enum (visible in JSON Schema)
    'low',
    'high',
    'trivial',
    'easy',
    'moderate',
    'hard',
    'difficult',
  ],
  {
    basic: 'simple',
    intermediate: 'medium',
    advanced: 'complex',
  },
);

export const milestoneInputSchema = z.object({
  title: z.string().min(1).max(500),
  category: milestoneCategorySchema,
  complexity: complexitySchema.optional(),
});

export const syncPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_seconds: z.number().int().nonnegative(),
  clients: z.record(z.string(), z.number().int().nonnegative()),
  task_types: z.record(z.string(), z.number().int().nonnegative()),
  languages: z.record(z.string(), z.number().int().nonnegative()),
  sessions: z.array(
    z.object({
      session_id: z.string(),
      client: z.string(),
      task_type: z.string(),
      languages: z.array(z.string()),
      files_touched: z.number().int().nonnegative(),
      started_at: z.string(),
      ended_at: z.string(),
      duration_seconds: z.number().int().nonnegative(),
      heartbeat_count: z.number().int().nonnegative(),
      record_count: z.number().int().nonnegative(),
      chain_start_hash: z.string(),
      chain_end_hash: z.string(),
      seal_signature: z.string(),
    }),
  ),
  sync_signature: z.string(),
});

export const publishPayloadSchema = z.object({
  milestones: z.array(
    z.object({
      id: z.string(),
      title: z.string().min(1).max(500),
      category: milestoneCategorySchema,
      complexity: complexitySchema,
      duration_minutes: z.number().int().nonnegative(),
      languages: z.array(z.string()),
      client: z.string(),
      chain_hash: z.string(),
    }),
  ),
});
