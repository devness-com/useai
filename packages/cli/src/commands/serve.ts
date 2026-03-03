import { Command } from 'commander';
import { exec } from 'node:child_process';
import pc from 'picocolors';
import { ensureDaemon, DAEMON_PORT } from '@useai/shared';

export const serveCommand = new Command('serve')
  .description('Open the local UseAI dashboard')
  .option('--open', 'Open the dashboard in your default browser')
  .action(async (opts) => {
    const url = `http://127.0.0.1:${DAEMON_PORT}/dashboard`;

    console.log(pc.dim('  Ensuring daemon is running...'));
    const started = await ensureDaemon();

    if (!started) {
      console.log(pc.red('  Failed to start daemon. Try: useai daemon start --foreground'));
      process.exit(1);
    }

    console.log(pc.green(`  Dashboard running at ${pc.bold(url)}`));

    if (opts.open) {
      const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${cmd} ${url}`, (err) => {
        if (err) {
          console.log(pc.yellow(`  Could not open browser: ${err.message}`));
          console.log(pc.dim(`  Open manually: ${url}`));
        }
      });
    }

    console.log(pc.dim('  Press Ctrl+C to exit'));

    // Keep process alive
    const keepAlive = setInterval(() => {}, 60_000);
    const shutdown = () => {
      clearInterval(keepAlive);
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
