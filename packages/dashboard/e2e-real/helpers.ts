import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), 'useai-e2e-real');
const TEST_PORT = 19201;

// ─── Navigation ──────────────────────────────────────────────────────────────

/** Navigate to the dashboard and wait for it to load with real daemon data */
export async function gotoDashboard(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('time-travel-panel')).toBeVisible({ timeout: 15_000 });
  // Wait for real data to load (sessions, milestones, config, health)
  await page.waitForTimeout(1000);
}

/** Switch to Sessions or Insights tab */
export async function switchTab(page: Page, tab: 'Sessions' | 'Insights') {
  await page.getByRole('button', { name: tab }).click();
  await page.waitForTimeout(300);
}

/** Click a scale button */
export async function selectScale(page: Page, scale: string) {
  await page.getByTestId(`scale-${scale}`).click();
  await page.waitForTimeout(300);
}

/** Get the time display text */
export async function getTimeDisplay(page: Page): Promise<string> {
  return page.getByTestId('time-display').innerText();
}

/** Get the date display text */
export async function getDateDisplay(page: Page): Promise<string> {
  return page.getByTestId('date-display').innerText();
}

/** Get the period label text */
export async function getPeriodLabel(page: Page): Promise<string> {
  return page.getByTestId('period-label').innerText();
}

// ─── Data verification ───────────────────────────────────────────────────────

/** Read the current sessions.json from the test data directory */
export function readSessionsFile(): any[] {
  const raw = readFileSync(join(TEST_HOME, 'data', 'sessions.json'), 'utf-8');
  return JSON.parse(raw);
}

/** Read the current milestones.json from the test data directory */
export function readMilestonesFile(): any[] {
  const raw = readFileSync(join(TEST_HOME, 'data', 'milestones.json'), 'utf-8');
  return JSON.parse(raw);
}

/** Read the current config.json from the test data directory */
export function readConfigFile(): Record<string, unknown> {
  const raw = readFileSync(join(TEST_HOME, 'config.json'), 'utf-8');
  return JSON.parse(raw);
}

/** Fetch data directly from the test daemon API */
export async function fetchFromDaemon(path: string): Promise<any> {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}${path}`);
  return res.json();
}

/** Delete via daemon API */
export async function deleteFromDaemon(path: string): Promise<any> {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}${path}`, { method: 'DELETE' });
  return res.json();
}
