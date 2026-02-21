import { Command } from 'commander';
import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import {
  DAEMON_PORT,
  ensureDaemon,
  killDaemon,
  installAutostart,
  removeAutostart,
  isAutostartInstalled,
  detectPlatform,
  installClaudeCodeHooks,
  removeClaudeCodeHooks,
} from '@useai/shared';
import { AI_TOOLS, MCP_HTTP_URL, USEAI_INSTRUCTIONS_TEXT, resolveTools, type AiTool } from '../services/tools.js';
import { header, success, error, info } from '../utils/display.js';

function shortenPath(p: string): string {
  const home = process.env['HOME'] ?? '';
  return home && p.startsWith(home) ? p.replace(home, '~') : p;
}

function showManualHints(installedTools: AiTool[]): void {
  const hints = installedTools
    .map((t) => ({ name: t.name, hint: t.getManualHint() }))
    .filter((h) => h.hint !== null);

  if (hints.length === 0) return;

  console.log(chalk.yellow(`\n  ⚠ Manual setup needed for ${hints.length} tool${hints.length === 1 ? '' : 's'}:\n`));
  for (const { name, hint } of hints) {
    console.log(`  ${chalk.bold(name)}: ${hint}`);
  }
  console.log();
  for (const line of USEAI_INSTRUCTIONS_TEXT.split('\n')) {
    console.log(`  ${line}`);
  }
  console.log();
}

function showStatus(tools: AiTool[]): void {
  console.log(header('AI Tool MCP Status'));

  const rows: string[] = [];
  const nameWidth = Math.max(...tools.map((t) => t.name.length));
  const statusWidth = 16;

  for (const tool of tools) {
    const detected = tool.detect();
    const name = tool.name.padEnd(nameWidth);

    if (!detected) {
      rows.push(`  ${chalk.dim(name)}  ${chalk.dim('— Not found'.padEnd(statusWidth))}`);
    } else if (tool.isConfigured()) {
      rows.push(
        `  ${name}  ${chalk.green('✓ Configured'.padEnd(statusWidth))}  ${chalk.dim(shortenPath(tool.getConfigPath()))}`,
      );
    } else {
      rows.push(
        `  ${name}  ${chalk.yellow('✗ Not set up'.padEnd(statusWidth))}  ${chalk.dim(shortenPath(tool.getConfigPath()))}`,
      );
    }
  }

  console.log(rows.join('\n'));
  console.log();
}

// ── Daemon-first install (default) ────────────────────────────────────────────

async function daemonInstallFlow(tools: AiTool[], explicit: boolean): Promise<void> {
  // 1. Ensure daemon is running
  console.log(info('Ensuring UseAI daemon is running...'));
  const daemonOk = await ensureDaemon();

  let useDaemon = true;
  if (daemonOk) {
    console.log(success(`✓ Daemon running on port ${DAEMON_PORT}`));
  } else {
    useDaemon = false;
    console.log(error('✗ Could not start daemon — falling back to stdio config'));
    console.log(info(`(Run with --foreground to debug: npx @devness/useai@latest daemon --port ${DAEMON_PORT})`));
  }

  // 2. Install auto-start (only if daemon is working)
  if (useDaemon) {
    const platform = detectPlatform();
    if (platform !== 'unsupported') {
      try {
        installAutostart();
        console.log(success(`✓ Auto-start service installed (${platform})`));
      } catch {
        console.log(chalk.yellow(`  ⚠ Could not install auto-start service`));
      }
    }
  }

  // 3. Configure tools
  const targetTools = explicit ? tools : tools.filter((t) => t.detect());

  if (targetTools.length === 0) {
    console.log(error('\n  No AI tools detected on this machine.'));
    return;
  }

  let configuredCount = 0;
  console.log();
  for (const tool of targetTools) {
    try {
      if (useDaemon && tool.supportsUrl) {
        tool.installHttp();
        console.log(success(`✓ ${tool.name.padEnd(18)} → ${chalk.dim('HTTP (daemon)')}`));
      } else if (useDaemon && !tool.supportsUrl) {
        tool.install();
        console.log(success(`✓ ${tool.name.padEnd(18)} → ${chalk.dim('stdio (no URL support)')}`));
      } else {
        tool.install();
        console.log(success(`✓ ${tool.name.padEnd(18)} → ${chalk.dim('stdio')}`));
      }
      configuredCount++;
    } catch (e) {
      console.log(error(`✗ ${tool.name.padEnd(18)} — ${(e as Error).message}`));
    }
  }

  // 4. Install Claude Code hooks (UserPromptSubmit + Stop + SessionEnd)
  try {
    const hooksInstalled = installClaudeCodeHooks();
    if (hooksInstalled) {
      console.log(success('✓ Claude Code hooks installed (UserPromptSubmit + Stop + SessionEnd)'));
    }
  } catch {
    console.log(chalk.yellow('  ⚠ Could not install Claude Code hooks'));
  }

  showManualHints(targetTools);

  const mode = useDaemon ? 'daemon mode' : 'stdio mode';
  console.log(`\n  Done! UseAI configured in ${chalk.bold(String(configuredCount))} tool${configuredCount === 1 ? '' : 's'} (${mode}).\n`);
}

// ── Stdio-only install (legacy) ───────────────────────────────────────────────

async function stdioInstallFlow(tools: AiTool[], autoYes: boolean, explicit: boolean): Promise<void> {
  if (explicit) {
    console.log();
    for (const tool of tools) {
      try {
        const wasConfigured = tool.isConfigured();
        tool.install();
        if (wasConfigured) {
          console.log(success(`✓ ${tool.name.padEnd(18)}   ${chalk.dim('(updated)')}`));
        } else {
          console.log(success(`✓ ${tool.name.padEnd(18)} → ${chalk.dim(shortenPath(tool.getConfigPath()))}`));
        }
      } catch (err) {
        console.log(error(`✗ ${tool.name.padEnd(18)} — ${(err as Error).message}`));
      }
    }
    showManualHints(tools);
    console.log();
    return;
  }

  console.log(info('Scanning for AI tools...\n'));

  const detected = tools.filter((t) => t.detect());
  if (detected.length === 0) {
    console.log(error('No AI tools detected on this machine.'));
    return;
  }

  const alreadyConfigured = detected.filter((t) => t.isConfigured());
  const unconfigured = detected.filter((t) => !t.isConfigured());

  console.log(`  Found ${chalk.bold(String(detected.length))} AI tool${detected.length === 1 ? '' : 's'} on this machine:\n`);

  for (const tool of alreadyConfigured) {
    console.log(chalk.green(`  ✅ ${tool.name}`) + chalk.dim('  (already configured)'));
  }
  for (const tool of unconfigured) {
    console.log(chalk.dim(`  ☐  ${tool.name}`));
  }
  console.log();

  if (unconfigured.length === 0) {
    console.log(success('All detected tools are already configured.'));
    return;
  }

  let toInstall: AiTool[];
  if (autoYes) {
    toInstall = unconfigured;
  } else {
    let selected: string[];
    try {
      selected = await checkbox({
        message: 'Select tools to configure:',
        choices: unconfigured.map((t) => ({
          name: t.name,
          value: t.id,
          checked: true,
        })),
      });
    } catch {
      console.log('\n');
      return;
    }
    toInstall = unconfigured.filter((t) => selected.includes(t.id));
  }

  if (toInstall.length === 0) {
    console.log(info('No tools selected.'));
    return;
  }

  console.log(`\n  Configuring ${toInstall.length} tool${toInstall.length === 1 ? '' : 's'}...\n`);

  for (const tool of toInstall) {
    try {
      tool.install();
      console.log(success(`✓ ${tool.name.padEnd(18)} → ${chalk.dim(shortenPath(tool.getConfigPath()))}`));
    } catch (err) {
      console.log(error(`✗ ${tool.name.padEnd(18)} — ${(err as Error).message}`));
    }
  }

  // Re-run install on already-configured tools to ensure instructions are injected
  for (const tool of alreadyConfigured) {
    try { tool.install(); } catch { /* ignore */ }
  }

  showManualHints([...toInstall, ...alreadyConfigured]);

  console.log(`\n  Done! UseAI MCP server configured in ${chalk.bold(String(toInstall.length))} tool${toInstall.length === 1 ? '' : 's'}.\n`);
}

// ── Full remove flow (tools + daemon + autostart) ─────────────────────────────

async function fullRemoveFlow(tools: AiTool[], autoYes: boolean, explicit: boolean): Promise<void> {
  // 1. Remove tool configs
  if (explicit) {
    const toRemove = tools.filter((t) => {
      try { return t.isConfigured(); } catch { return false; }
    });
    const notConfigured = tools.filter((t) => {
      try { return !t.isConfigured(); } catch { return true; }
    });

    for (const tool of notConfigured) {
      console.log(info(`${tool.name} is not configured — skipping.`));
    }

    if (toRemove.length > 0) {
      console.log();
      for (const tool of toRemove) {
        try {
          tool.remove();
          console.log(success(`✓ Removed from ${tool.name}`));
        } catch (err) {
          console.log(error(`✗ ${tool.name} — ${(err as Error).message}`));
        }
      }
    }
  } else {
    const configured = tools.filter((t) => {
      try { return t.isConfigured(); } catch { return false; }
    });

    if (configured.length === 0) {
      console.log(info('UseAI is not configured in any AI tools.'));
    } else {
      console.log(`\n  Found UseAI configured in ${chalk.bold(String(configured.length))} tool${configured.length === 1 ? '' : 's'}:\n`);

      let toRemove: AiTool[];
      if (autoYes) {
        toRemove = configured;
      } else {
        let selected: string[];
        try {
          selected = await checkbox({
            message: 'Select tools to remove UseAI from:',
            choices: configured.map((t) => ({
              name: t.name,
              value: t.id,
              checked: true,
            })),
          });
        } catch {
          console.log('\n');
          return;
        }
        toRemove = configured.filter((t) => selected.includes(t.id));
      }

      if (toRemove.length === 0) {
        console.log(info('No tools selected.'));
      } else {
        console.log(`\n  Removing from ${toRemove.length} tool${toRemove.length === 1 ? '' : 's'}...\n`);
        for (const tool of toRemove) {
          try {
            tool.remove();
            console.log(success(`✓ Removed from ${tool.name}`));
          } catch (err) {
            console.log(error(`✗ ${tool.name} — ${(err as Error).message}`));
          }
        }
      }
    }
  }

  // Check if any tools remain configured after removal
  const anyRemaining = AI_TOOLS.some((t) => {
    try { return t.isConfigured(); } catch { return false; }
  });

  if (!anyRemaining) {
    // 2. Remove Claude Code hooks
    try {
      removeClaudeCodeHooks();
      console.log(success('✓ Claude Code hooks removed'));
    } catch { /* ignore */ }

    // 3. Stop daemon
    console.log();
    try {
      await killDaemon();
      console.log(success('✓ Daemon stopped'));
    } catch {
      console.log(info('Daemon was not running'));
    }

    // 4. Remove autostart
    if (isAutostartInstalled()) {
      try {
        removeAutostart();
        console.log(success('✓ Auto-start service removed'));
      } catch {
        console.log(error('✗ Failed to remove auto-start service'));
      }
    }

    console.log(info('\nDone! UseAI fully removed.\n'));
  } else {
    console.log(info('\nDone! Other tools still configured — daemon and hooks kept running.\n'));
  }
}

export const mcpCommand = new Command('mcp')
  .description('Configure UseAI MCP server in your AI tools')
  .argument('[tools...]', 'Specific tool names (e.g. codex cursor vscode)')
  .option('--stdio', 'Use stdio config (legacy mode for containers/CI)')
  .option('--remove', 'Remove UseAI from configured tools, stop daemon, remove auto-start')
  .option('--status', 'Show configuration status without modifying')
  .option('-y, --yes', 'Skip confirmation, auto-select all detected tools')
  .action(async (toolNames: string[], opts: { stdio?: boolean; remove?: boolean; status?: boolean; yes?: boolean }) => {
    const explicit = toolNames.length > 0;
    let tools = AI_TOOLS;

    if (explicit) {
      const { matched, unmatched } = resolveTools(toolNames);
      if (unmatched.length > 0) {
        console.log(error(`Unknown tool${unmatched.length === 1 ? '' : 's'}: ${unmatched.join(', ')}`));
        console.log(info(`Available: ${AI_TOOLS.map((t) => t.id).join(', ')}`));
        return;
      }
      tools = matched;
    }

    if (opts.status) {
      showStatus(tools);
    } else if (opts.remove) {
      await fullRemoveFlow(tools, !!opts.yes, explicit);
    } else if (opts.stdio) {
      await stdioInstallFlow(tools, !!opts.yes, explicit);
    } else {
      await daemonInstallFlow(tools, explicit);
    }
  });
