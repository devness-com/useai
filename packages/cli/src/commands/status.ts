import { Command } from 'commander';
import { existsSync, statSync, readdirSync } from 'node:fs';
import chalk from 'chalk';
import { readJson } from '@useai/shared/utils';
import {
  USEAI_DIR,
  SESSIONS_FILE,
  MILESTONES_FILE,
  DATA_DIR,
} from '@useai/shared/constants';
import { formatDuration } from '@useai/shared/utils';
import type { SessionSeal, Milestone } from '@useai/shared/types';
import { getConfig } from '../services/config.service.js';
import { header, table, info } from '../utils/display.js';

function dirSize(dirPath: string): number {
  if (!existsSync(dirPath)) return 0;
  let total = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const parentPath = entry.parentPath ?? (entry as unknown as { path: string }).path ?? dirPath;
        try {
          total += statSync(`${parentPath}/${entry.name}`).size;
        } catch {
          // skip files we can't stat
        }
      }
    }
  } catch {
    // directory not readable
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const statusCommand = new Command('status')
  .description('Full transparency dashboard — see everything stored locally')
  .action(() => {
    const sessions = readJson<SessionSeal[]>(SESSIONS_FILE, []);
    const milestones = readJson<Milestone[]>(MILESTONES_FILE, []);
    const config = getConfig();

    const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    const unpublished = milestones.filter((m) => !m.published).length;
    const published = milestones.filter((m) => m.published).length;

    const storageSize = dirSize(USEAI_DIR);

    console.log(header('useai Status'));

    console.log(
      table([
        ['Sessions recorded', chalk.bold(String(sessions.length))],
        ['Total tracked time', chalk.bold(formatDuration(totalSeconds))],
        ['Milestones', chalk.bold(`${unpublished} unpublished, ${published} published`)],
        ['Local storage', chalk.bold(formatBytes(storageSize))],
        ['Data directory', chalk.dim(DATA_DIR)],
      ]),
    );

    console.log(header('Settings'));

    console.log(
      table([
        ['Milestone tracking', config.milestone_tracking ? chalk.green('on') : chalk.red('off')],
        ['Auto sync', config.auto_sync ? chalk.green('on') : chalk.red('off')],
        ['Sync interval', `${config.sync_interval_hours}h`],
        ['Last sync', config.last_sync_at ?? chalk.dim('never')],
        ['Logged in', config.auth ? chalk.green(config.auth.user.email) : chalk.dim('no')],
      ]),
    );

    console.log(header('Privacy'));
    console.log(
      info('useai NEVER captures code, file contents, prompts, or responses.'),
    );
    console.log(
      info('Only durations, tool names, languages, and task types are recorded.'),
    );

    console.log('');
  });
