#!/usr/bin/env node

export {};

let command = process.argv[2];

// CLI mode: handle explicit setup commands (mcp command or --flags)
if (command === 'mcp' || command?.startsWith('--')) {
  const args = command === 'mcp' ? process.argv.slice(3) : process.argv.slice(2);
  const { runSetup } = await import('./setup.js');
  await runSetup(args);
  process.exit(0);
}

// No command + TTY: if already installed → update, otherwise → first-time setup
if (!command && process.stdin.isTTY) {
  const { AI_TOOLS } = await import('./tools.js');
  const isInstalled = AI_TOOLS.some((t) => {
    try { return t.isConfigured(); } catch { return false; }
  });

  if (isInstalled) {
    command = 'update';
  } else {
    const { runSetup } = await import('./setup.js');
    await runSetup([]);
    process.exit(0);
  }
}

// Update mode: check for new version, remove MCP configs, restart daemon, reinstall configs
if (command === 'update') {
  const { default: chalk } = await import('chalk');
  const { fetchLatestVersion, fetchDaemonHealth, killDaemon, ensureDaemon, installClaudeCodeHooks, VERSION } =
    await import('@useai/shared');
  const { AI_TOOLS } = await import('./tools.js');

  console.log(chalk.dim('  Checking for updates...'));

  const latest = await fetchLatestVersion();
  if (!latest) {
    console.log(chalk.red('  ✗ Could not reach npm registry'));
    process.exit(1);
  }

  const healthBefore = await fetchDaemonHealth();
  const runningVersion = (healthBefore?.version as string) ?? VERSION;

  if (runningVersion === latest && VERSION === latest) {
    console.log(chalk.green(`  ✓ Already up to date (v${latest})`));
    process.exit(0);
  }

  console.log(`  ${chalk.dim('Current:')} v${runningVersion}`);
  console.log(`  ${chalk.dim('Latest:')}  v${latest}`);
  console.log();

  // 1. Snapshot which tools are currently configured
  const configuredTools = AI_TOOLS.filter((t) => {
    try { return t.isConfigured(); } catch { return false; }
  });

  // 2. Remove MCP config from all configured tools
  if (configuredTools.length > 0) {
    console.log(chalk.dim('  Removing MCP configs from configured tools...'));
    for (const tool of configuredTools) {
      try {
        tool.remove();
        console.log(chalk.dim(`  ↻ ${tool.name}`));
      } catch {
        console.log(chalk.red(`  ✗ Failed to remove ${tool.name}`));
      }
    }
    console.log();
  }

  // 3. Kill old daemon
  console.log(chalk.dim('  Stopping daemon...'));
  await killDaemon();

  // 4. Clear npx cache to force fresh fetch
  console.log(chalk.dim('  Clearing npx cache...'));
  const { execSync } = await import('node:child_process');
  try {
    execSync('npm cache clean --force', { stdio: 'ignore', timeout: 15000 });
  } catch {
    // non-fatal — ensureDaemon uses --prefer-online anyway
  }

  // 5. Start updated daemon
  console.log(chalk.dim('  Starting updated daemon...'));
  const daemonOk = await ensureDaemon({ preferOnline: true });

  if (!daemonOk) {
    console.log(chalk.red('  ✗ Failed to start updated daemon'));
    console.log();
    console.log(chalk.bold('  To debug, run the daemon in foreground mode:'));
    console.log(chalk.cyan('    npx @devness/useai@latest daemon --port 19200'));
    process.exit(1);
  }

  // 6. Verify new version
  const healthAfter = await fetchDaemonHealth();
  const newVersion = (healthAfter?.version as string) ?? 'unknown';
  console.log(chalk.green(`\n  ✓ Daemon updated: v${runningVersion} → v${newVersion}`));

  // 7. Reinstall MCP configs on the same tools
  if (configuredTools.length > 0) {
    console.log(chalk.dim('\n  Reinstalling MCP configs...'));
    for (const tool of configuredTools) {
      try {
        if (tool.supportsUrl) {
          tool.installHttp();
          console.log(chalk.green(`  ✓ ${tool.name} → ${chalk.dim('HTTP (daemon)')}`));
        } else {
          tool.install();
          console.log(chalk.green(`  ✓ ${tool.name} → ${chalk.dim('stdio')}`));
        }
      } catch {
        console.log(chalk.red(`  ✗ ${tool.name}`));
      }
    }
  }

  // 8. Reinstall Claude Code hooks
  try {
    const hooksInstalled = installClaudeCodeHooks();
    if (hooksInstalled) {
      console.log(chalk.green('  ✓ Claude Code hooks reinstalled'));
    }
  } catch { /* ignore */ }

  console.log(`\n  Done! UseAI updated to v${newVersion} in ${chalk.bold(String(configuredTools.length))} tool${configuredTools.length === 1 ? '' : 's'}.`);
  console.log(chalk.dim(`  Dashboard: http://127.0.0.1:19200/dashboard\n`));
  process.exit(0);
}

// Daemon mode: start HTTP server with StreamableHTTP transport
if (command === 'daemon') {
  const { startDaemon } = await import('./daemon.js');
  const portArg = process.argv.indexOf('--port');
  const port = portArg !== -1 ? parseInt(process.argv[portArg + 1]!, 10) : undefined;
  await startDaemon(port);
  // daemon runs until killed — don't fall through
  await new Promise(() => {}); // block forever
}

// Unknown command guard — prevent falling into stdio mode accidentally
if (command) {
  console.error(`Unknown command: "${command}"`);
  console.error('Available commands: mcp, daemon, update');
  process.exit(1);
}

// ── MCP Server (stdio mode — stdin is piped from an AI tool) ────────────────

const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
const { VERSION, ensureDir } = await import('@useai/shared');
const { SessionState } = await import('./session-state.js');
const { registerTools } = await import('./register-tools.js');

const session = new SessionState();
const server = new McpServer({
  name: 'UseAI',
  version: VERSION,
});

registerTools(server, session);

async function main() {
  ensureDir();

  try {
    session.initializeKeystore();
  } catch {
    // signingAvailable remains false
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('useai MCP server failed to start:', error);
  process.exit(1);
});
