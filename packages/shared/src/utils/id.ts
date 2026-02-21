import { randomUUID } from 'node:crypto';

export function generateSessionId(): string {
  return randomUUID();
}

export function generateRecordId(): string {
  return `r_${randomUUID().slice(0, 12)}`;
}

export function generateMilestoneId(): string {
  return `m_${randomUUID().slice(0, 8)}`;
}
