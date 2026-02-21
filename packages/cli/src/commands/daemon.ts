import { Command } from 'commander';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import {
  DAEMON_PORT,
  readPidFile,
  isProcessRunning,
  fetchDaemonHealth,
  killDaemon,
  findPidsByPort,
  ensureDaemon,
  detectPlatform,
  installAutostart,
  removeAutostart,
  isAutostartInstalled,
  recoverAutostart,
} from '@useai/shared';
import { formatDuration } from '@useai/shared/utils';

// ── daemon start ───────────────────────────────────────────────────────────────

const startCommand = new Command('start')
  .description('Start the UseAI daemon')
  .option('-p, --port <port>', 'Port to listen on', String(DAEMON_PORT))
  .option('--foreground', 'Run in foreground (don\'t daemonize)')
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);

    // Check if already running
    const pid = readPidFile();
    if (pid && isProcessRunning(pid.pid)) {
      const health = await fetchDaemonHealth(pid.port);
      if (health) {
        console.log(chalk.yellow(`  Daemon already running (PID ${pid.pid}, port ${pid.port})`));
        return;
      }
    }

    if (opts.foreground) {
      const child = spawn('npx', ['-y', '@devness/useai@latest', 'daemon', '--port', String(port)], {
        stdio: 'inherit',
      });

      child.on('exit', (code) => {
        process.exit(code ?? 0);
      });
      return;
    }

    // Daemonize using ensureDaemon
    console.log(chalk.dim('  Starting daemon...'));
    const started = await ensureDaemon();

    if (started) {
      const newPid = readPidFile();
      console.log(chalk.green(`  ✓ Daemon started (PID ${newPid?.pid ?? 'unknown'}, port ${port})`));
    } else {
      console.log(chalk.red(`  ✗ Daemon failed to start within 8 seconds`));
      console.log(chalk.dim(`    Try: useai daemon start --foreground`));
    }
  });

// ── daemon stop ────────────────────────────────────────────────────────────────

const stopCommand = new Command('stop')
  .description('Stop the UseAI daemon')
  .option('-p, --port <port>', 'Port to stop daemon on', String(DAEMON_PORT))
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const pid = readPidFile();

    if (pid && isProcessRunning(pid.pid)) {
      console.log(chalk.dim(`  Stopping daemon (PID ${pid.pid})...`));
      await killDaemon();
      console.log(chalk.green(`  ✓ Daemon stopped`));
      return;
    }

    // PID file stale or missing — check if something is on the port
    const pids = findPidsByPort(port);
    if (pids.length > 0) {
      console.log(chalk.dim(`  Stopping daemon on port ${port} (PIDs: ${pids.join(', ')})...`));
      await killDaemon();
      console.log(chalk.green(`  ✓ Daemon stopped`));
      return;
    }

    console.log(chalk.dim('  Daemon is not running'));
  });

// ── daemon status ──────────────────────────────────────────────────────────────

const statusCommand = new Command('status')
  .description('Show daemon status')
  .action(async () => {
    const pid = readPidFile();

    if (!pid) {
      console.log(chalk.dim('  Daemon is not running'));
      return;
    }

    if (!isProcessRunning(pid.pid)) {
      console.log(chalk.dim('  Daemon is not running (stale PID file)'));
      return;
    }

    const health = await fetchDaemonHealth(pid.port);

    if (!health) {
      console.log(chalk.yellow(`  Daemon process exists (PID ${pid.pid}) but health check failed`));
      return;
    }

    const uptime = health['uptime_seconds'] as number;
    const platform = detectPlatform();
    const autostartStatus = isAutostartInstalled()
      ? chalk.green('installed') + chalk.dim(` (${platform})`)
      : chalk.dim('not installed');

    console.log(chalk.bold.cyan('\n  UseAI Daemon'));
    console.log(chalk.bold.cyan('  ────────────'));
    console.log(`  Status:          ${chalk.green('running')}`);
    console.log(`  PID:             ${pid.pid}`);
    console.log(`  Port:            ${pid.port}`);
    console.log(`  Version:         ${health['version']}`);
    console.log(`  Uptime:          ${formatDuration(uptime)}`);
    console.log(`  Active sessions: ${health['active_sessions']}`);
    console.log(`  Auto-start:      ${autostartStatus}`);
    console.log();
  });

// ── daemon autostart ──────────────────────────────────────────────────────────

const autostartInstallCommand = new Command('install')
  .description('Install auto-start service (survives reboots)')
  .action(() => {
    const platform = detectPlatform();
    if (platform === 'unsupported') {
      console.log(chalk.red(`  ✗ Auto-start is not supported on ${process.platform}`));
      return;
    }

    try {
      installAutostart();
      console.log(chalk.green(`  ✓ Auto-start installed (${platform})`));
    } catch (e) {
      console.log(chalk.red(`  ✗ Failed to install auto-start: ${(e as Error).message}`));
    }
  });

const autostartRemoveCommand = new Command('remove')
  .description('Remove auto-start service')
  .action(() => {
    try {
      removeAutostart();
      console.log(chalk.green(`  ✓ Auto-start removed`));
    } catch (e) {
      console.log(chalk.red(`  ✗ Failed to remove auto-start: ${(e as Error).message}`));
    }
  });

const autostartStatusCommand = new Command('status')
  .description('Check auto-start status')
  .action(() => {
    const platform = detectPlatform();
    const installed = isAutostartInstalled();

    if (installed) {
      console.log(chalk.green(`  ✓ Auto-start is installed (${platform})`));
    } else {
      console.log(chalk.dim(`  Auto-start is not installed`));
    }
  });

const autostartRecoverCommand = new Command('recover')
  .description('Recover auto-start from disabled/failed state (after crash loops)')
  .action(() => {
    const platform = detectPlatform();
    if (platform === 'unsupported') {
      console.log(chalk.red(`  ✗ Auto-start is not supported on ${process.platform}`));
      return;
    }

    if (!isAutostartInstalled()) {
      console.log(chalk.yellow('  Auto-start is not installed. Run: useai daemon autostart install'));
      return;
    }

    const result = recoverAutostart();
    if (result.recovered) {
      console.log(chalk.green(`  ✓ ${result.message}`));
    } else {
      console.log(chalk.yellow(`  ${result.message}`));
    }
  });

const autostartCommand = new Command('autostart')
  .description('Manage auto-start service')
  .addCommand(autostartInstallCommand)
  .addCommand(autostartRemoveCommand)
  .addCommand(autostartStatusCommand)
  .addCommand(autostartRecoverCommand);

// ── Parent command ─────────────────────────────────────────────────────────────

export const daemonCommand = new Command('daemon')
  .description('Manage the UseAI HTTP daemon')
  .addCommand(startCommand)
  .addCommand(stopCommand)
  .addCommand(statusCommand)
  .addCommand(autostartCommand);
