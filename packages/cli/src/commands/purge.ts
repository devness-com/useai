import { Command } from 'commander';
import { existsSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { USEAI_DIR } from '@useai/shared/constants';
import { error, success, info } from '../utils/display.js';

function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

export const purgeCommand = new Command('purge')
  .description('Delete ALL local useai data')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (opts: { yes?: boolean }) => {
    if (!existsSync(USEAI_DIR)) {
      console.log(info('No useai data directory found. Nothing to purge.'));
      return;
    }

    if (!opts.yes) {
      console.log(error(`This will permanently delete all data in ${USEAI_DIR}`));
      const confirmed = await confirm('  Type "yes" to confirm: ');
      if (!confirmed) {
        console.log(info('Purge cancelled.'));
        return;
      }
    }

    rmSync(USEAI_DIR, { recursive: true, force: true });
    console.log(success('All local useai data has been deleted.'));
  });
