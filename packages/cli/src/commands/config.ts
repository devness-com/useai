import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig, updateConfig } from '../services/config.service.js';
import { header, table, success } from '../utils/display.js';

export const configCommand = new Command('config')
  .description('View or update settings')
  .option('--sync', 'Enable auto-sync')
  .option('--no-sync', 'Disable auto-sync')
  .option('--milestones', 'Enable milestone tracking')
  .option('--no-milestones', 'Disable milestone tracking')
  .action(() => {
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

    const config = getConfig();

    if (!changed) {
      console.log(header('Current Settings'));
      console.log(
        table([
          ['Milestone tracking', config.milestone_tracking ? chalk.green('on') : chalk.red('off')],
          ['Auto sync', config.auto_sync ? chalk.green('on') : chalk.red('off')],
          ['Sync interval', `${config.sync_interval_hours}h`],
          ['Last sync', config.last_sync_at ?? chalk.dim('never')],
          ['Logged in', config.auth ? chalk.green(config.auth.user.email) : chalk.dim('no')],
        ]),
      );
      console.log('');
    }
  });
