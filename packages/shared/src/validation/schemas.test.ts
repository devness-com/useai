import { describe, expect, it } from 'vitest';
import {
  taskTypeSchema,
  milestoneCategorySchema,
  complexitySchema,
  milestoneInputSchema,
  syncPayloadSchema,
  publishPayloadSchema,
} from './schemas';

describe('taskTypeSchema', () => {
  const validTypes = [
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
    'code_review',
    'code-review',
    'investigation',
    'infrastructure',
    'analysis',
    'ops',
    'setup',
    'refactoring',
    'other',
  ] as const;

  it.each(validTypes)('accepts valid task type "%s"', (type) => {
    expect(taskTypeSchema.parse(type)).toBe(type);
  });

  const aliases: [string, string][] = [
    ['review', 'reviewing'],
    ['document', 'documenting'],
    ['debug', 'debugging'],
    ['test', 'testing'],
    ['code', 'coding'],
    ['learn', 'learning'],
    ['deploy', 'deployment'],
    ['plan', 'planning'],
    ['migrate', 'migration'],
    ['refactor', 'refactoring'],
    ['investigate', 'investigation'],
    ['configure', 'configuration'],
    ['designing', 'design'],
  ];

  it.each(aliases)('normalizes alias "%s" to "%s"', (alias, canonical) => {
    expect(taskTypeSchema.parse(alias)).toBe(canonical);
  });

  it('rejects an unknown task type', () => {
    expect(() => taskTypeSchema.parse('banana')).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => taskTypeSchema.parse('')).toThrow();
  });

  it('rejects a number', () => {
    expect(() => taskTypeSchema.parse(42)).toThrow();
  });
});

describe('milestoneCategorySchema', () => {
  const validCategories = [
    'feature',
    'bugfix',
    'refactor',
    'test',
    'docs',
    'setup',
    'deployment',
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
  ] as const;

  it.each(validCategories)('accepts valid category "%s"', (category) => {
    expect(milestoneCategorySchema.parse(category)).toBe(category);
  });

  const aliases: [string, string][] = [
    ['bug', 'bugfix'],
    ['bug-fix', 'bugfix'],
    ['doc', 'docs'],
    ['document', 'docs'],
    ['documenting', 'docs'],
    ['feat', 'feature'],
    ['perf', 'performance'],
    ['refactoring', 'refactor'],
  ];

  it.each(aliases)('normalizes alias "%s" to "%s"', (alias, canonical) => {
    expect(milestoneCategorySchema.parse(alias)).toBe(canonical);
  });

  it('rejects an invalid category', () => {
    expect(() => milestoneCategorySchema.parse('enhancement')).toThrow();
  });

  it('rejects null', () => {
    expect(() => milestoneCategorySchema.parse(null)).toThrow();
  });
});

describe('complexitySchema', () => {
  it.each(['simple', 'medium', 'complex', 'low', 'high', 'trivial', 'easy', 'moderate', 'hard', 'difficult'] as const)(
    'accepts valid complexity "%s"',
    (complexity) => {
      expect(complexitySchema.parse(complexity)).toBe(complexity);
    },
  );

  const aliases: [string, string][] = [
    ['basic', 'simple'],
    ['intermediate', 'medium'],
    ['advanced', 'complex'],
  ];

  it.each(aliases)('normalizes alias "%s" to "%s"', (alias, canonical) => {
    expect(complexitySchema.parse(alias)).toBe(canonical);
  });

  it('rejects an invalid complexity value', () => {
    expect(() => complexitySchema.parse('impossible')).toThrow();
  });

  it('rejects undefined', () => {
    expect(() => complexitySchema.parse(undefined)).toThrow();
  });
});

describe('milestoneInputSchema', () => {
  describe('valid inputs', () => {
    it('accepts a milestone with all fields', () => {
      const input = {
        title: 'Implement user authentication',
        category: 'feature',
        complexity: 'complex',
      };
      const result = milestoneInputSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('accepts a milestone without optional complexity', () => {
      const input = {
        title: 'Fix login redirect bug',
        category: 'bugfix',
      };
      const result = milestoneInputSchema.parse(input);
      expect(result).toEqual({ title: 'Fix login redirect bug', category: 'bugfix' });
      expect(result.complexity).toBeUndefined();
    });

    it('accepts a title at minimum length (1 character)', () => {
      const result = milestoneInputSchema.parse({
        title: 'A',
        category: 'docs',
      });
      expect(result.title).toBe('A');
    });

    it('accepts a title at maximum length (500 characters)', () => {
      const longTitle = 'X'.repeat(500);
      const result = milestoneInputSchema.parse({
        title: longTitle,
        category: 'refactor',
      });
      expect(result.title).toHaveLength(500);
    });
  });

  describe('title validation', () => {
    it('rejects an empty title', () => {
      expect(() =>
        milestoneInputSchema.parse({ title: '', category: 'feature' }),
      ).toThrow();
    });

    it('rejects a title exceeding 500 characters', () => {
      expect(() =>
        milestoneInputSchema.parse({
          title: 'Y'.repeat(501),
          category: 'feature',
        }),
      ).toThrow();
    });

    it('rejects a missing title', () => {
      expect(() =>
        milestoneInputSchema.parse({ category: 'feature' }),
      ).toThrow();
    });

    it('rejects a non-string title', () => {
      expect(() =>
        milestoneInputSchema.parse({ title: 123, category: 'feature' }),
      ).toThrow();
    });
  });

  describe('category validation', () => {
    it('rejects a missing category', () => {
      expect(() =>
        milestoneInputSchema.parse({ title: 'Some task' }),
      ).toThrow();
    });

    it('rejects an invalid category', () => {
      expect(() =>
        milestoneInputSchema.parse({
          title: 'Some task',
          category: 'maintenance',
        }),
      ).toThrow();
    });
  });

  describe('complexity validation', () => {
    it('rejects an invalid complexity value', () => {
      expect(() =>
        milestoneInputSchema.parse({
          title: 'Some task',
          category: 'feature',
          complexity: 'extreme',
        }),
      ).toThrow();
    });
  });
});

describe('syncPayloadSchema', () => {
  const validSession = {
    session_id: 'sess-abc123',
    client: 'vscode',
    task_type: 'coding',
    languages: ['typescript', 'javascript'],
    files_touched: 12,
    started_at: '2026-02-15T09:00:00Z',
    ended_at: '2026-02-15T10:30:00Z',
    duration_seconds: 5400,
    heartbeat_count: 180,
    record_count: 45,
    chain_start_hash: 'a1b2c3d4e5f6',
    chain_end_hash: 'f6e5d4c3b2a1',
    seal_signature: 'sig_session_001',
  };

  const validPayload = {
    date: '2026-02-15',
    total_seconds: 7200,
    clients: { vscode: 5400, cursor: 1800 },
    task_types: { coding: 3600, debugging: 1800, testing: 1800 },
    languages: { typescript: 5000, javascript: 2200 },
    sessions: [validSession],
    sync_signature: 'sig_sync_abc123',
  };

  describe('valid payloads', () => {
    it('accepts a complete valid sync payload', () => {
      const result = syncPayloadSchema.parse(validPayload);
      expect(result).toEqual(validPayload);
    });

    it('accepts a payload with an empty sessions array', () => {
      const result = syncPayloadSchema.parse({
        ...validPayload,
        sessions: [],
      });
      expect(result.sessions).toEqual([]);
    });

    it('accepts a payload with multiple sessions', () => {
      const secondSession = {
        ...validSession,
        session_id: 'sess-def456',
        client: 'cursor',
        task_type: 'debugging',
      };
      const result = syncPayloadSchema.parse({
        ...validPayload,
        sessions: [validSession, secondSession],
      });
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].session_id).toBe('sess-abc123');
      expect(result.sessions[1].session_id).toBe('sess-def456');
    });

    it('accepts zero for total_seconds', () => {
      const result = syncPayloadSchema.parse({
        ...validPayload,
        total_seconds: 0,
      });
      expect(result.total_seconds).toBe(0);
    });

    it('accepts empty records for clients, task_types, and languages', () => {
      const result = syncPayloadSchema.parse({
        ...validPayload,
        clients: {},
        task_types: {},
        languages: {},
      });
      expect(result.clients).toEqual({});
      expect(result.task_types).toEqual({});
      expect(result.languages).toEqual({});
    });
  });

  describe('date validation', () => {
    it('accepts a valid YYYY-MM-DD date', () => {
      const result = syncPayloadSchema.parse(validPayload);
      expect(result.date).toBe('2026-02-15');
    });

    it('rejects a date with slashes (MM/DD/YYYY)', () => {
      expect(() =>
        syncPayloadSchema.parse({ ...validPayload, date: '02/15/2026' }),
      ).toThrow();
    });

    it('rejects a date in DD-MM-YYYY format', () => {
      expect(() =>
        syncPayloadSchema.parse({ ...validPayload, date: '15-02-2026' }),
      ).toThrow();
    });

    it('rejects a date with time appended', () => {
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          date: '2026-02-15T10:00:00Z',
        }),
      ).toThrow();
    });

    it('rejects a date with single-digit month or day', () => {
      expect(() =>
        syncPayloadSchema.parse({ ...validPayload, date: '2026-2-5' }),
      ).toThrow();
    });

    it('rejects an empty string date', () => {
      expect(() =>
        syncPayloadSchema.parse({ ...validPayload, date: '' }),
      ).toThrow();
    });

    it('rejects a missing date', () => {
      const { date: _, ...noDate } = validPayload;
      expect(() => syncPayloadSchema.parse(noDate)).toThrow();
    });

    it('rejects a non-string date', () => {
      expect(() =>
        syncPayloadSchema.parse({ ...validPayload, date: 20260215 }),
      ).toThrow();
    });
  });

  describe('numeric field validation', () => {
    it('rejects negative total_seconds', () => {
      expect(() =>
        syncPayloadSchema.parse({ ...validPayload, total_seconds: -100 }),
      ).toThrow();
    });

    it('rejects fractional total_seconds', () => {
      expect(() =>
        syncPayloadSchema.parse({ ...validPayload, total_seconds: 72.5 }),
      ).toThrow();
    });

    it('rejects negative values in clients record', () => {
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          clients: { vscode: -1 },
        }),
      ).toThrow();
    });

    it('rejects fractional values in task_types record', () => {
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          task_types: { coding: 3600.5 },
        }),
      ).toThrow();
    });

    it('rejects negative values in languages record', () => {
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          languages: { typescript: -500 },
        }),
      ).toThrow();
    });
  });

  describe('session nested object validation', () => {
    it('rejects a session with negative files_touched', () => {
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          sessions: [{ ...validSession, files_touched: -1 }],
        }),
      ).toThrow();
    });

    it('rejects a session with negative duration_seconds', () => {
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          sessions: [{ ...validSession, duration_seconds: -10 }],
        }),
      ).toThrow();
    });

    it('rejects a session with fractional heartbeat_count', () => {
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          sessions: [{ ...validSession, heartbeat_count: 5.5 }],
        }),
      ).toThrow();
    });

    it('rejects a session with fractional record_count', () => {
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          sessions: [{ ...validSession, record_count: 2.7 }],
        }),
      ).toThrow();
    });

    it('rejects a session missing required fields', () => {
      const { session_id: _, ...incomplete } = validSession;
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          sessions: [incomplete],
        }),
      ).toThrow();
    });

    it('accepts a session with empty languages array', () => {
      const result = syncPayloadSchema.parse({
        ...validPayload,
        sessions: [{ ...validSession, languages: [] }],
      });
      expect(result.sessions[0].languages).toEqual([]);
    });

    it('rejects a session where languages contains non-strings', () => {
      expect(() =>
        syncPayloadSchema.parse({
          ...validPayload,
          sessions: [{ ...validSession, languages: [42] }],
        }),
      ).toThrow();
    });
  });

  describe('required fields', () => {
    it('rejects payload missing sync_signature', () => {
      const { sync_signature: _, ...noSig } = validPayload;
      expect(() => syncPayloadSchema.parse(noSig)).toThrow();
    });

    it('rejects payload missing sessions', () => {
      const { sessions: _, ...noSessions } = validPayload;
      expect(() => syncPayloadSchema.parse(noSessions)).toThrow();
    });

    it('rejects payload missing total_seconds', () => {
      const { total_seconds: _, ...noTotal } = validPayload;
      expect(() => syncPayloadSchema.parse(noTotal)).toThrow();
    });

    it('rejects an entirely empty object', () => {
      expect(() => syncPayloadSchema.parse({})).toThrow();
    });

    it('rejects null', () => {
      expect(() => syncPayloadSchema.parse(null)).toThrow();
    });

    it('rejects undefined', () => {
      expect(() => syncPayloadSchema.parse(undefined)).toThrow();
    });
  });
});

describe('publishPayloadSchema', () => {
  const validMilestone = {
    id: 'milestone-001',
    title: 'Add OAuth2 authentication flow',
    category: 'feature' as const,
    complexity: 'complex' as const,
    duration_minutes: 120,
    languages: ['typescript', 'yaml'],
    client: 'vscode',
    chain_hash: 'hash_abc123def456',
  };

  describe('valid payloads', () => {
    it('accepts a payload with one milestone', () => {
      const result = publishPayloadSchema.parse({
        milestones: [validMilestone],
      });
      expect(result.milestones).toHaveLength(1);
      expect(result.milestones[0].title).toBe('Add OAuth2 authentication flow');
    });

    it('accepts a payload with multiple milestones', () => {
      const secondMilestone = {
        ...validMilestone,
        id: 'milestone-002',
        title: 'Fix database connection pooling',
        category: 'bugfix' as const,
        complexity: 'medium' as const,
        duration_minutes: 45,
      };
      const result = publishPayloadSchema.parse({
        milestones: [validMilestone, secondMilestone],
      });
      expect(result.milestones).toHaveLength(2);
    });

    it('accepts an empty milestones array', () => {
      const result = publishPayloadSchema.parse({ milestones: [] });
      expect(result.milestones).toEqual([]);
    });

    it('accepts a milestone with empty languages array', () => {
      const result = publishPayloadSchema.parse({
        milestones: [{ ...validMilestone, languages: [] }],
      });
      expect(result.milestones[0].languages).toEqual([]);
    });

    it('accepts zero for duration_minutes', () => {
      const result = publishPayloadSchema.parse({
        milestones: [{ ...validMilestone, duration_minutes: 0 }],
      });
      expect(result.milestones[0].duration_minutes).toBe(0);
    });
  });

  describe('milestone title validation', () => {
    it('rejects a milestone with an empty title', () => {
      expect(() =>
        publishPayloadSchema.parse({
          milestones: [{ ...validMilestone, title: '' }],
        }),
      ).toThrow();
    });

    it('rejects a milestone with a title exceeding 500 characters', () => {
      expect(() =>
        publishPayloadSchema.parse({
          milestones: [{ ...validMilestone, title: 'Z'.repeat(501) }],
        }),
      ).toThrow();
    });
  });

  describe('milestone category and complexity validation', () => {
    it('rejects an invalid category in milestone', () => {
      expect(() =>
        publishPayloadSchema.parse({
          milestones: [{ ...validMilestone, category: 'improvement' }],
        }),
      ).toThrow();
    });

    it('rejects an invalid complexity in milestone', () => {
      expect(() =>
        publishPayloadSchema.parse({
          milestones: [{ ...validMilestone, complexity: 'impossible' }],
        }),
      ).toThrow();
    });

    it('rejects a milestone with missing complexity (required in publish)', () => {
      const { complexity: _, ...noComplexity } = validMilestone;
      expect(() =>
        publishPayloadSchema.parse({
          milestones: [noComplexity],
        }),
      ).toThrow();
    });
  });

  describe('milestone numeric field validation', () => {
    it('rejects negative duration_minutes', () => {
      expect(() =>
        publishPayloadSchema.parse({
          milestones: [{ ...validMilestone, duration_minutes: -30 }],
        }),
      ).toThrow();
    });

    it('rejects fractional duration_minutes', () => {
      expect(() =>
        publishPayloadSchema.parse({
          milestones: [{ ...validMilestone, duration_minutes: 45.5 }],
        }),
      ).toThrow();
    });
  });

  describe('required fields', () => {
    it('rejects a milestone missing id', () => {
      const { id: _, ...noId } = validMilestone;
      expect(() =>
        publishPayloadSchema.parse({ milestones: [noId] }),
      ).toThrow();
    });

    it('rejects a milestone missing client', () => {
      const { client: _, ...noClient } = validMilestone;
      expect(() =>
        publishPayloadSchema.parse({ milestones: [noClient] }),
      ).toThrow();
    });

    it('rejects a milestone missing chain_hash', () => {
      const { chain_hash: _, ...noHash } = validMilestone;
      expect(() =>
        publishPayloadSchema.parse({ milestones: [noHash] }),
      ).toThrow();
    });

    it('rejects payload missing milestones key', () => {
      expect(() => publishPayloadSchema.parse({})).toThrow();
    });

    it('rejects null payload', () => {
      expect(() => publishPayloadSchema.parse(null)).toThrow();
    });
  });
});

describe('schema type inference consistency', () => {
  it('milestoneInputSchema allows complexity to be omitted', () => {
    const withoutComplexity = milestoneInputSchema.parse({
      title: 'Setup CI pipeline',
      category: 'setup',
    });
    expect(withoutComplexity).toEqual({
      title: 'Setup CI pipeline',
      category: 'setup',
    });
    expect('complexity' in withoutComplexity).toBe(false);
  });

  it('publishPayloadSchema requires complexity on milestones', () => {
    const milestone = {
      id: 'ms-1',
      title: 'Deploy to production',
      category: 'deployment',
      duration_minutes: 30,
      languages: ['bash'],
      client: 'terminal',
      chain_hash: 'hash_deploy',
    };
    expect(() =>
      publishPayloadSchema.parse({ milestones: [milestone] }),
    ).toThrow();
  });

  it('strips unknown properties from milestoneInputSchema', () => {
    const result = milestoneInputSchema.parse({
      title: 'Write unit tests',
      category: 'test',
      complexity: 'simple',
      extraField: 'should be removed',
    });
    expect(result).toEqual({
      title: 'Write unit tests',
      category: 'test',
      complexity: 'simple',
    });
    expect('extraField' in result).toBe(false);
  });
});