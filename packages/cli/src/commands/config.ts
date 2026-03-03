import { Command } from 'commander';
import pc from 'picocolors';
import { getFrameworkIds } from '@useai/shared';
import { getUserMode } from '@useai/shared/types';
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
      const cfg = getConfig();
      cfg.sync.enabled = false;
      updateConfig(cfg);
      console.log(success('Cloud sync disabled.'));
      changed = true;
    } else if (process.argv.includes('--sync')) {
      const cfg = getConfig();
      cfg.sync.enabled = true;
      updateConfig(cfg);
      console.log(success('Cloud sync enabled.'));
      changed = true;
    }

    if (process.argv.includes('--no-milestones')) {
      const cfg = getConfig();
      cfg.capture.milestones = false;
      updateConfig(cfg);
      console.log(success('Milestone tracking disabled.'));
      changed = true;
    } else if (process.argv.includes('--milestones')) {
      const cfg = getConfig();
      cfg.capture.milestones = true;
      updateConfig(cfg);
      console.log(success('Milestone tracking enabled.'));
      changed = true;
    }

    if (opts.framework) {
      const validIds = getFrameworkIds();
      if (!validIds.includes(opts.framework)) {
        console.log(error(`Unknown framework: ${opts.framework}. Valid: ${validIds.join(', ')}`));
      } else {
        updateConfig({ evaluation_framework: opts.framework });
        console.log(success(`Evaluation framework set to ${pc.bold(opts.framework)}.`));

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
      const mode = getUserMode(config);
      const modeDisplay = mode === 'cloud'
        ? pc.green('Cloud') + pc.dim(` · @${config.auth!.user.username ?? config.auth!.user.email}`)
        : pc.cyan('Local');

      console.log(header('Current Settings'));
      console.log(
        table([
          ['Mode', modeDisplay],
          ['Milestone tracking', config.capture.milestones ? pc.green('on') : pc.red('off')],
          ['Prompt capture', config.capture.prompt ? pc.green('on') : pc.red('off')],
          ['Eval reasons', config.capture.evaluation_reasons],
          ['Cloud sync', config.sync.enabled ? pc.green('on') : pc.red('off')],
          ['Eval framework', pc.cyan(config.evaluation_framework ?? 'space')],
          ['Sync interval', `${config.sync.interval_hours}h`],
          ['Last sync', config.last_sync_at ?? pc.dim('never')],
        ]),
      );
      console.log('');
    }
  });
