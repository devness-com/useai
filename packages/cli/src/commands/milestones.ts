import { Command } from 'commander';
import chalk from 'chalk';
import { readJson, formatDuration } from '@useai/shared/utils';
import { MILESTONES_FILE } from '@useai/shared/constants';
import type { Milestone } from '@useai/shared/types';
import { header, table, info } from '../utils/display.js';

export const milestonesCommand = new Command('milestones')
  .description('List local milestones')
  .option('-v, --verbose', 'Show full milestone details')
  .action((opts: { verbose?: boolean }) => {
    const milestones = readJson<Milestone[]>(MILESTONES_FILE, []);

    if (milestones.length === 0) {
      console.log(info('No milestones recorded yet.'));
      return;
    }

    console.log(header(`Milestones (${milestones.length})`));

    for (const m of milestones) {
      const status = m.published
        ? chalk.green('published')
        : chalk.yellow('local');

      const displayTitle = m.private_title ?? m.title;
      console.log(
        `\n  ${chalk.bold(displayTitle)}  ${status}`,
      );
      console.log(
        table([
          ['Category', m.category],
          ['Complexity', m.complexity],
          ['Duration', formatDuration(m.duration_minutes * 60)],
          ['Date', m.created_at.slice(0, 10)],
        ]),
      );

      if (opts.verbose) {
        const verboseRows: [string, string][] = [
          ['ID', chalk.dim(m.id)],
          ['Session', chalk.dim(m.session_id)],
          ['Client', m.client],
          ['Languages', m.languages.join(', ') || 'none'],
          ['Chain hash', chalk.dim(m.chain_hash.slice(0, 16) + '...')],
          ['Published at', m.published_at ?? 'n/a'],
        ];
        if (m.private_title) {
          verboseRows.push(['Public title', m.title]);
        }
        console.log(table(verboseRows));
      }
    }

    console.log('');
  });
