import { Command } from 'commander';
import pc from 'picocolors';
import {
  VERSION,
  DAEMON_PORT,
  fetchDaemonHealth,
  killDaemon,
  ensureDaemon,
  fetchLatestVersion,
  installClaudeCodeHooks,
} from '@useai/shared';
import { AI_TOOLS } from '../services/tools.js';
import { success, error, info } from '../utils/display.js';

export const updateCommand = new Command('update')
  .description('Update UseAI to the latest version (daemon + MCP configs)')
  .action(async () => {
    console.log(pc.dim('  Checking for updates...'));

    // 1. Fetch latest version from npm
    const latest = await fetchLatestVersion();
    if (!latest) {
      console.log(pc.red('  ✗ Could not reach npm registry'));
      return;
    }

    // 2. Check current running daemon version
    const health = await fetchDaemonHealth();
    const currentVersion = (health?.['version'] as string) ?? VERSION;

    if (currentVersion === latest) {
      console.log(pc.green(`  ✓ Already up to date (v${latest})`));
      return;
    }

    console.log(`  ${pc.dim('Current:')} v${currentVersion}`);
    console.log(`  ${pc.dim('Latest:')}  v${latest}`);
    console.log();

    // 3. Snapshot which tools are currently configured
    const configuredTools = AI_TOOLS.filter((t) => {
      try { return t.isConfigured(); } catch { return false; }
    });

    // 4. Remove MCP config from all configured tools
    if (configuredTools.length > 0) {
      console.log(pc.dim('  Removing MCP configs from configured tools...'));
      for (const tool of configuredTools) {
        try {
          tool.remove();
          console.log(info(`  ↻ ${tool.name}`));
        } catch {
          console.log(error(`  ✗ Failed to remove ${tool.name}`));
        }
      }
      console.log();
    }

    // 5. Kill old daemon
    console.log(pc.dim('  Stopping current daemon...'));
    await killDaemon();

    // 6. Spawn new daemon with --prefer-online to force fresh npm fetch
    console.log(pc.dim('  Starting updated daemon...'));
    const daemonOk = await ensureDaemon();

    if (!daemonOk) {
      console.log(pc.red('  ✗ Failed to start updated daemon'));
      console.log(pc.dim('    Try running in foreground to debug:'));
      console.log(pc.dim(`    npx -y --prefer-online @devness/useai@latest daemon --port ${DAEMON_PORT}`));

      // Still reinstall tools in stdio mode so the user isn't left broken
      if (configuredTools.length > 0) {
        console.log(pc.dim('\n  Reinstalling MCP configs (stdio fallback)...'));
        for (const tool of configuredTools) {
          try {
            tool.install();
            console.log(success(`  ✓ ${tool.name} → ${pc.dim('stdio')}`));
          } catch {
            console.log(error(`  ✗ ${tool.name}`));
          }
        }
      }
      return;
    }

    // 7. Verify new version
    const newHealth = await fetchDaemonHealth();
    const newVersion = (newHealth?.['version'] as string) ?? 'unknown';

    console.log(pc.green(`\n  ✓ Daemon updated: v${currentVersion} → v${newVersion}`));

    // 8. Reinstall MCP configs on the same tools with latest version
    if (configuredTools.length > 0) {
      console.log(pc.dim('\n  Reinstalling MCP configs...'));
      for (const tool of configuredTools) {
        try {
          if (tool.supportsUrl) {
            tool.installHttp();
            console.log(success(`  ✓ ${tool.name} → ${pc.dim('HTTP (daemon)')}`));
          } else {
            tool.install();
            console.log(success(`  ✓ ${tool.name} → ${pc.dim('stdio')}`));
          }
        } catch {
          console.log(error(`  ✗ ${tool.name}`));
        }
      }
    }

    // 9. Reinstall Claude Code hooks
    try {
      const hooksInstalled = installClaudeCodeHooks();
      if (hooksInstalled) {
        console.log(success('  ✓ Claude Code hooks reinstalled'));
      }
    } catch { /* ignore */ }

    console.log(`\n  Done! UseAI updated to v${newVersion} in ${pc.bold(String(configuredTools.length))} tool${configuredTools.length === 1 ? '' : 's'}.\n`);
    console.log(pc.dim(`  Dashboard: http://127.0.0.1:${DAEMON_PORT}/dashboard`));
  });
