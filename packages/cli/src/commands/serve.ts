import { Command } from 'commander';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import { ensureDaemon, DAEMON_PORT } from '@useai/shared';

export const serveCommand = new Command('serve')
  .description('Open the local UseAI dashboard')
  .option('--open', 'Open the dashboard in your default browser')
  .action(async (opts) => {
    const url = `http://127.0.0.1:${DAEMON_PORT}/dashboard`;

    console.log(chalk.dim('  Ensuring daemon is running...'));
    const started = await ensureDaemon();

    if (!started) {
      console.log(chalk.red('  Failed to start daemon. Try: useai daemon start --foreground'));
      process.exit(1);
    }

    console.log(chalk.green(`  Dashboard running at ${chalk.bold(url)}`));

    if (opts.open) {
      const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${cmd} ${url}`, (err) => {
        if (err) {
          console.log(chalk.yellow(`  Could not open browser: ${err.message}`));
          console.log(chalk.dim(`  Open manually: ${url}`));
        }
      });
    }

    console.log(chalk.dim('  Press Ctrl+C to exit'));

    // Keep process alive
    const keepAlive = setInterval(() => {}, 60_000);
    const shutdown = () => {
      clearInterval(keepAlive);
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
