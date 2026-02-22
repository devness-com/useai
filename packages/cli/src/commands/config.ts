import { Command } from 'commander';
import chalk from 'chalk';
import { getFrameworkIds } from '@useai/shared';
import { getConfig, updateConfig } from '../services/config.service.js';
import { reinjectInstructions } from '../services/tools.js';
import { header, table, success, error, info } from '../utils/display.js';

export const configCommand = new Command('config')
  .description('View or update settings')
  .option('--sync', 'Enable auto-sync')
  .option('--no-sync', 'Disable auto-sync')
  .option('--milestones', 'Enable milestone tracking')
  .option('--no-milestones', 'Disable milestone tracking')
  .option('--framework <name>', 'Set evaluation framework: space (recommended), raw (basic)')
  .action((opts) => {
    let changed = false;

    if (process.argv.includes('--no-sync')) {
      updateConfig({ auto_sync: false });
      console.log(success('Auto-sync disabled.'));
      changed = true;
    } else if (process.argv.includes('--sync')) {
      updateConfig({ auto_sync: true });
      console.log(success('Auto-sync enabled.'));
      changed = true;
    }

    if (process.argv.includes('--no-milestones')) {
      updateConfig({ milestone_tracking: false });
      console.log(success('Milestone tracking disabled.'));
      changed = true;
    } else if (process.argv.includes('--milestones')) {
      updateConfig({ milestone_tracking: true });
      console.log(success('Milestone tracking enabled.'));
      changed = true;
    }

    if (opts.framework) {
      const validIds = getFrameworkIds();
      if (!validIds.includes(opts.framework)) {
        console.log(error(`Unknown framework: ${opts.framework}. Valid: ${validIds.join(', ')}`));
      } else {
        updateConfig({ evaluation_framework: opts.framework });
        console.log(success(`Evaluation framework set to ${chalk.bold(opts.framework)}.`));

        // Re-inject instructions into configured tools with new framework text
        const results = reinjectInstructions(opts.framework);
        if (results.length > 0) {
          for (const r of results) {
            console.log(r.ok ? info(`  ↻ ${r.tool} instructions updated`) : error(`  ✗ ${r.tool}`));
          }
        }
        changed = true;
      }
    }

    const config = getConfig();

    if (!changed) {
      console.log(header('Current Settings'));
      console.log(
        table([
          ['Milestone tracking', config.milestone_tracking ? chalk.green('on') : chalk.red('off')],
          ['Auto sync', config.auto_sync ? chalk.green('on') : chalk.red('off')],
          ['Eval framework', chalk.cyan(config.evaluation_framework ?? 'raw')],
          ['Sync interval', `${config.sync_interval_hours}h`],
          ['Last sync', config.last_sync_at ?? chalk.dim('never')],
          ['Logged in', config.auth ? chalk.green(config.auth.user.email) : chalk.dim('no')],
        ]),
      );
      console.log('');
    }
  });
