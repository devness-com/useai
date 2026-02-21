import { Command } from 'commander';
import { readJson } from '@useai/shared/utils';
import { SESSIONS_FILE, MILESTONES_FILE } from '@useai/shared/constants';
import type { SessionSeal, Milestone } from '@useai/shared/types';
import { getConfig } from '../services/config.service.js';

export const exportCommand = new Command('export')
  .description('Export all local data as JSON to stdout')
  .action(() => {
    const config = getConfig();
    const sessions = readJson<SessionSeal[]>(SESSIONS_FILE, []);
    const milestones = readJson<Milestone[]>(MILESTONES_FILE, []);

    const data = {
      exported_at: new Date().toISOString(),
      config,
      sessions,
      milestones,
    };

    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  });
