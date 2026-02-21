import { Command } from 'commander';
import chalk from 'chalk';
import {
  VERSION,
  DAEMON_PORT,
  fetchDaemonHealth,
  killDaemon,
  ensureDaemon,
  fetchLatestVersion,
} from '@useai/shared';

export const updateCommand = new Command('update')
  .description('Update UseAI daemon to the latest version')
  .action(async () => {
    console.log(chalk.dim('  Checking for updates...'));

    // 1. Fetch latest version from npm
    const latest = await fetchLatestVersion();
    if (!latest) {
      console.log(chalk.red('  \u2717 Could not reach npm registry'));
      return;
    }

    // 2. Check current running daemon version
    const health = await fetchDaemonHealth();
    const currentVersion = (health?.['version'] as string) ?? VERSION;

    if (currentVersion === latest) {
      console.log(chalk.green(`  \u2713 Already up to date (v${latest})`));
      return;
    }

    console.log(`  ${chalk.dim('Current:')} v${currentVersion}`);
    console.log(`  ${chalk.dim('Latest:')}  v${latest}`);
    console.log();

    // 3. Kill old daemon
    console.log(chalk.dim('  Stopping current daemon...'));
    await killDaemon();

    // 4. Spawn new daemon with --prefer-online to force fresh npm fetch
    console.log(chalk.dim('  Starting updated daemon...'));
    const ok = await ensureDaemon();

    if (!ok) {
      console.log(chalk.red('  \u2717 Failed to start updated daemon'));
      console.log(chalk.dim('    Try running in foreground to debug:'));
      console.log(chalk.dim(`    npx -y --prefer-online @devness/useai@latest daemon --port ${DAEMON_PORT}`));
      return;
    }

    // 5. Verify new version
    const newHealth = await fetchDaemonHealth();
    const newVersion = (newHealth?.['version'] as string) ?? 'unknown';

    console.log();
    console.log(chalk.green(`  \u2713 Updated: v${currentVersion} \u2192 v${newVersion}`));
    console.log(chalk.dim(`    Dashboard: http://127.0.0.1:${DAEMON_PORT}/dashboard`));
  });
