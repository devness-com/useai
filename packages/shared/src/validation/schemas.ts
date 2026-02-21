import { z } from 'zod';

export const taskTypeSchema = z.enum([
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
  // aliases models commonly try
  'code_review',
  'code-review',
  'investigation',
  'infrastructure',
  'analysis',
  'ops',
  'setup',
  'refactoring',
  'other',
]);

export const milestoneCategorySchema = z.enum([
  'feature',
  'bugfix',
  'refactor',
  'test',
  'docs',
  'setup',
  'deployment',
  // aliases models commonly try
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
]);

export const complexitySchema = z.enum([
  'simple',
  'medium',
  'complex',
  // aliases models commonly try
  'low',
  'high',
  'trivial',
  'easy',
  'moderate',
  'hard',
  'difficult',
]);

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
