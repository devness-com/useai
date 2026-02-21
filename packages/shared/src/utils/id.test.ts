import { describe, expect, test } from 'vitest';
import { generateSessionId, generateRecordId, generateMilestoneId } from './id';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('generateSessionId', () => {
  test('returns a valid UUID v4 format', () => {
    const id = generateSessionId();
    expect(id).toMatch(UUID_REGEX);
  });

  test('produces unique values across 100 calls', () => {
    const ids = Array.from({ length: 100 }, () => generateSessionId());
    const unique = new Set(ids);
    expect(unique.size).toBe(100);
  });
});

describe('generateRecordId', () => {
  test('has "r_" prefix', () => {
    const id = generateRecordId();
    expect(id.startsWith('r_')).toBe(true);
  });

  test('has total length of 14 (2-char prefix + 12-char UUID slice)', () => {
    const id = generateRecordId();
    expect(id).toHaveLength(14);
  });

  test('suffix contains only hex characters and hyphens from UUID slice', () => {
    const id = generateRecordId();
    const suffix = id.slice(2);
    // randomUUID().slice(0, 12) from "xxxxxxxx-xxxx-..." yields "xxxxxxxx-xxx"
    expect(suffix).toMatch(/^[0-9a-f]{8}-[0-9a-f]{3}$/);
  });

  test('produces unique values across 100 calls', () => {
    const ids = Array.from({ length: 100 }, () => generateRecordId());
    const unique = new Set(ids);
    expect(unique.size).toBe(100);
  });
});

describe('generateMilestoneId', () => {
  test('has "m_" prefix', () => {
    const id = generateMilestoneId();
    expect(id.startsWith('m_')).toBe(true);
  });

  test('has total length of 10 (2-char prefix + 8-char UUID slice)', () => {
    const id = generateMilestoneId();
    expect(id).toHaveLength(10);
  });

  test('suffix contains only lowercase hex characters', () => {
    const id = generateMilestoneId();
    const suffix = id.slice(2);
    // randomUUID().slice(0, 8) from "xxxxxxxx-xxxx-..." yields "xxxxxxxx"
    expect(suffix).toMatch(/^[0-9a-f]{8}$/);
  });

  test('produces unique values across 100 calls', () => {
    const ids = Array.from({ length: 100 }, () => generateMilestoneId());
    const unique = new Set(ids);
    expect(unique.size).toBe(100);
  });
});

describe('cross-function uniqueness', () => {
  test('ids from different generators do not collide', () => {
    const sessionIds = Array.from({ length: 100 }, () => generateSessionId());
    const recordIds = Array.from({ length: 100 }, () => generateRecordId());
    const milestoneIds = Array.from({ length: 100 }, () =>
      generateMilestoneId()
    );

    const allIds = [...sessionIds, ...recordIds, ...milestoneIds];
    const unique = new Set(allIds);
    expect(unique.size).toBe(300);
  });
});