/**
 * MCP Setup — UseAI-specific orchestrator.
 *
 * Uses shared building blocks from @devness/mcp-setup for stdio flows,
 * adds daemon/hooks/autostart logic for the default (HTTP) flow.
 *
 * IMPORTANT: @inquirer/prompts and @devness/mcp-setup are imported dynamically
 * to avoid bundling Node 20+ APIs (styleText from "util") into the MCP server.
 * This file is only loaded for CLI setup, never during MCP server runtime.
 */

import * as readline from 'node:readline/promises';
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
  CONFIG_FILE,
  readJson,
  writeJson,
  getFramework,
  getFrameworkIds,
} from '@useai/shared';
import type { LocalConfig } from '@useai/shared';
import { AI_TOOLS, USEAI_INSTRUCTIONS_TEXT, resolveTools, type AiTool } from './tools.js';

// Lazy-load @devness/mcp-setup (it imports @inquirer/prompts which needs Node 20+)
type SetupRunner = {
  showStatus: (tools?: AiTool[]) => void;
  installFlow: (tools: AiTool[], autoYes: boolean, explicit: boolean) => Promise<void>;
};
let _shared: SetupRunner | undefined;

async function getShared(): Promise<SetupRunner> {
  if (!_shared) {
    const { createSetupRunner } = await import('@devness/mcp-setup');
    _shared = createSetupRunner({
      productName: 'UseAI',
      tools: AI_TOOLS,
      resolveTools,
      instructionsText: USEAI_INSTRUCTIONS_TEXT,
    });
  }
  return _shared;
}

/**
 * Interactive multi-select with @inquirer/prompts checkbox, falling back to
 * a simple readline prompt on Node < 20 (where @inquirer/prompts crashes).
 */
async function multiSelect(
  message: string,
  choices: { name: string; value: string; checked?: boolean }[],
): Promise<string[]> {
  try {
    const { checkbox } = await import('@inquirer/prompts');
    return await checkbox({ message, choices });
  } catch {
    // Fallback: numbered list via readline (works on Node 18+)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log(`  ${message}\n`);
      choices.forEach((c, i) => {
        const marker = c.checked !== false ? chalk.green('*') : ' ';
        console.log(`  ${marker} ${i + 1}. ${c.name}`);
      });
      console.log();
      const answer = await rl.question('  Enter numbers to select (comma-separated), or press Enter for all: ');
      if (!answer.trim()) return choices.map((c) => c.value);
      const indices = answer.split(',').map((n) => parseInt(n.trim(), 10) - 1);
      return choices.filter((_, i) => indices.includes(i)).map((c) => c.value);
    } finally {
      rl.close();
    }
  }
}

/**
 * Single-select with @inquirer/prompts, falling back to readline on Node < 20.
 */
async function singleSelect(
  message: string,
  choices: { name: string; value: string; description?: string }[],
): Promise<string> {
  try {
    const { select } = await import('@inquirer/prompts');
    return await select({ message, choices });
  } catch {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log(`  ${message}\n`);
      choices.forEach((c, i) => {
        const desc = c.description ? chalk.dim(` — ${c.description}`) : '';
        console.log(`  ${i + 1}. ${c.name}${desc}`);
      });
      console.log();
      const answer = await rl.question('  Enter number: ');
      const idx = parseInt(answer.trim(), 10) - 1;
      return choices[idx]?.value ?? choices[0]!.value;
    } finally {
      rl.close();
    }
  }
}

/**
 * Prompt for evaluation framework selection and persist to config.
 * Returns the chosen framework ID.
 */
async function selectFramework(autoYes: boolean): Promise<string> {
  const config = readJson<LocalConfig>(CONFIG_FILE, {
    milestone_tracking: true,
    auto_sync: true,
    evaluation_framework: 'space',
  });
  const currentId = config.evaluation_framework ?? 'space';

  if (autoYes) {
    return currentId;
  }

  const frameworkIds = getFrameworkIds();
  const choices = frameworkIds.map((id) => {
    const fw = getFramework(id);
    const current = id === currentId ? ' (current)' : '';
    const recommended = id === 'space' ? ' (Recommended)' : '';
    return { name: `${fw.name}${recommended}${current}`, value: id, description: fw.description };
  });

  console.log(chalk.dim('\n  Evaluation Framework'));
  console.log(chalk.dim('  Controls how AI models score your sessions.'));
  console.log(chalk.dim('  SPACE is based on the developer productivity framework by GitHub/Microsoft Research.'));
  console.log(chalk.dim('  Learn more: https://queue.acm.org/detail.cfm?id=3454124\n'));

  const chosen = await singleSelect('Choose evaluation framework:', choices);

  if (chosen !== currentId) {
    writeJson(CONFIG_FILE, { ...config, evaluation_framework: chosen });
    const fw = getFramework(chosen);
    console.log(chalk.green(`  ✓ Framework set to ${chalk.bold(fw.name)}`));
  } else {
    console.log(chalk.dim(`  Keeping ${getFramework(currentId).name} framework.`));
  }

  return chosen;
}

// ── Manual Hints (for tools that need manual instruction placement) ───────

function showManualHints(installedTools: AiTool[]): void {
  const hints = installedTools
    .map((t) => ({ name: t.name, hint: t.getManualHint() }))
    .filter((h): h is { name: string; hint: string } => h.hint !== null);

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

// ── Spinner ─────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function startSpinner(message: string): { stop: (finalMessage: string) => void } {
  let frame = 0;
  const interval = setInterval(() => {
    const symbol = chalk.cyan(SPINNER_FRAMES[frame % SPINNER_FRAMES.length]);
    process.stdout.write(`\r  ${symbol} ${chalk.dim(message)}`);
    frame++;
  }, 80);

  return {
    stop(finalMessage: string) {
      clearInterval(interval);
      process.stdout.write(`\r${' '.repeat(message.length + 10)}\r`); // clear line
      console.log(finalMessage);
    },
  };
}

// ── Daemon-first install (default) ──────────────────────────────────────────

async function daemonInstallFlow(tools: AiTool[], autoYes: boolean, explicit: boolean): Promise<void> {
  // 1. Ensure daemon is running
  const spinner = startSpinner('Starting UseAI daemon...');
  const daemonOk = await ensureDaemon();

  if (!daemonOk) {
    spinner.stop(chalk.red(`  \u2717 Could not start daemon on port ${DAEMON_PORT}`));
    console.log();
    console.log(chalk.bold('  To debug, run the daemon in foreground mode:'));
    console.log(chalk.cyan(`    npx @devness/useai@latest daemon --port ${DAEMON_PORT}`));
    console.log();
    console.log(chalk.dim('  If you need stdio mode (e.g. containers/CI), use: npx @devness/useai mcp --stdio'));
    return;
  }

  const useDaemon = true;
  spinner.stop(chalk.green(`  \u2713 Daemon running on port ${DAEMON_PORT}`));
  console.log(chalk.dim(`    Dashboard: http://127.0.0.1:${DAEMON_PORT}/dashboard`));

  // 2. Install auto-start (only if daemon is working)
  if (useDaemon) {
    const platform = detectPlatform();
    if (platform !== 'unsupported') {
      try {
        installAutostart();
        console.log(chalk.green(`  \u2713 Auto-start service installed (${platform})`));
      } catch {
        console.log(chalk.yellow(`  \u26A0 Could not install auto-start service`));
      }
    }
  }

  // 3. When tools are explicitly named, configure them directly
  if (explicit) {
    console.log();
    let configuredCount = 0;
    for (const tool of tools) {
      try {
        configureToolDaemon(tool, useDaemon);
        configuredCount++;
      } catch (e) {
        console.log(chalk.red(`  \u2717 ${tool.name.padEnd(18)} \u2014 ${(e as Error).message}`));
      }
    }
    installHooksAndFinish(tools, configuredCount, useDaemon);
    return;
  }

  // 4. Scan for AI tools
  console.log(chalk.dim('\n  Scanning for AI tools...\n'));

  const detected = tools.filter((t) => t.detect());
  if (detected.length === 0) {
    console.log(chalk.red('  No AI tools detected on this machine.'));
    return;
  }

  const alreadyConfigured = detected.filter((t) => t.isConfigured());
  const unconfigured = detected.filter((t) => !t.isConfigured());

  console.log(`  Found ${chalk.bold(String(detected.length))} AI tool${detected.length === 1 ? '' : 's'} on this machine:\n`);

  for (const tool of alreadyConfigured) {
    console.log(chalk.green(`  \u2705 ${tool.name}`) + chalk.dim('  (already configured)'));
  }
  for (const tool of unconfigured) {
    console.log(chalk.dim(`  \u2610  ${tool.name}`));
  }
  console.log();

  if (unconfigured.length === 0) {
    console.log(chalk.green('  All detected tools are already configured.'));
    // Still re-run install on configured tools to ensure config is up to date
    for (const tool of alreadyConfigured) {
      try { configureToolDaemon(tool, useDaemon); } catch { /* ignore */ }
    }
    installHooksAndFinish(alreadyConfigured, alreadyConfigured.length, useDaemon);
    return;
  }

  // 5. Interactive selection (or auto-select with -y)
  let toInstall: AiTool[];
  if (autoYes) {
    toInstall = unconfigured;
  } else {
    let selected: string[];
    try {
      selected = await multiSelect(
        'Select tools to configure:',
        unconfigured.map((t) => ({ name: t.name, value: t.id, checked: true })),
      );
    } catch {
      console.log('\n');
      return;
    }
    toInstall = unconfigured.filter((t) => selected.includes(t.id));
  }

  if (toInstall.length === 0) {
    console.log(chalk.dim('  No tools selected.'));
    return;
  }

  // 6. Framework selection
  await selectFramework(autoYes);

  // 7. Configure selected tools
  console.log(`\n  Configuring ${toInstall.length} tool${toInstall.length === 1 ? '' : 's'}...\n`);

  let configuredCount = 0;
  for (const tool of toInstall) {
    try {
      configureToolDaemon(tool, useDaemon);
      configuredCount++;
    } catch (e) {
      console.log(chalk.red(`  \u2717 ${tool.name.padEnd(18)} \u2014 ${(e as Error).message}`));
    }
  }

  // Re-run install on already-configured tools to ensure config is up to date
  for (const tool of alreadyConfigured) {
    try { configureToolDaemon(tool, useDaemon); } catch { /* ignore */ }
  }

  installHooksAndFinish([...toInstall, ...alreadyConfigured], configuredCount, useDaemon);
}

function configureToolDaemon(tool: AiTool, useDaemon: boolean): void {
  if (useDaemon && tool.supportsUrl) {
    tool.installHttp();
    console.log(chalk.green(`  \u2713 ${tool.name.padEnd(18)} \u2192 ${chalk.dim('HTTP (daemon)')}`));
  } else if (useDaemon && !tool.supportsUrl) {
    tool.install();
    console.log(chalk.green(`  \u2713 ${tool.name.padEnd(18)} \u2192 ${chalk.dim('stdio (no URL support)')}`));
  } else {
    tool.install();
    console.log(chalk.green(`  \u2713 ${tool.name.padEnd(18)} \u2192 ${chalk.dim('stdio')}`));
  }
}

function installHooksAndFinish(allTools: AiTool[], configuredCount: number, useDaemon: boolean): void {
  try {
    const hooksInstalled = installClaudeCodeHooks();
    if (hooksInstalled) {
      console.log(chalk.green('  \u2713 Claude Code hooks installed (UserPromptSubmit + Stop + SessionEnd)'));
    }
  } catch {
    console.log(chalk.yellow('  \u26A0 Could not install Claude Code hooks'));
  }

  showManualHints(allTools);

  const mode = useDaemon ? 'daemon mode' : 'stdio mode';
  console.log(`\n  Done! UseAI configured in ${chalk.bold(String(configuredCount))} tool${configuredCount === 1 ? '' : 's'} (${mode}).`);
  if (useDaemon) {
    console.log(`    Dashboard \u2192 ${chalk.cyan(`http://127.0.0.1:${DAEMON_PORT}/dashboard`)}`);
  }
  console.log();
}

// ── Full remove flow (tools + daemon + autostart + hooks) ───────────────────

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
      console.log(chalk.dim(`  ${tool.name} is not configured \u2014 skipping.`));
    }

    if (toRemove.length > 0) {
      console.log();
      for (const tool of toRemove) {
        try {
          tool.remove();
          console.log(chalk.green(`  \u2713 Removed from ${tool.name}`));
        } catch (e) {
          console.log(chalk.red(`  \u2717 ${tool.name} \u2014 ${(e as Error).message}`));
        }
      }
    }
  } else {
    const configured = tools.filter((t) => {
      try { return t.isConfigured(); } catch { return false; }
    });

    if (configured.length === 0) {
      console.log(chalk.dim('  UseAI is not configured in any AI tools.'));
    } else {
      console.log(`\n  Found UseAI configured in ${chalk.bold(String(configured.length))} tool${configured.length === 1 ? '' : 's'}:\n`);

      let toRemove: AiTool[];
      if (autoYes) {
        toRemove = configured;
      } else {
        let selected: string[];
        try {
          selected = await multiSelect(
            'Select tools to remove UseAI from:',
            configured.map((t) => ({ name: t.name, value: t.id, checked: true })),
          );
        } catch {
          console.log('\n');
          return;
        }
        toRemove = configured.filter((t) => selected.includes(t.id));
      }

      if (toRemove.length === 0) {
        console.log(chalk.dim('  No tools selected.'));
      } else {
        console.log(`\n  Removing from ${toRemove.length} tool${toRemove.length === 1 ? '' : 's'}...\n`);
        for (const tool of toRemove) {
          try {
            tool.remove();
            console.log(chalk.green(`  \u2713 Removed from ${tool.name}`));
          } catch (e) {
            console.log(chalk.red(`  \u2717 ${tool.name} \u2014 ${(e as Error).message}`));
          }
        }
      }
    }
  }

  // Check if any tools remain configured after removal
  const anyRemaining = AI_TOOLS.some((t) => {
    try { return t.isConfigured(); } catch { return false; }
  });

  if (anyRemaining) {
    console.log(chalk.dim('\nDone! Other tools still configured \u2014 daemon and hooks kept running.\n'));
    return;
  }

  // 2. Remove Claude Code hooks (only when no tools remain)
  try {
    removeClaudeCodeHooks();
    console.log(chalk.green('  \u2713 Claude Code hooks removed'));
  } catch { /* ignore */ }

  // 3. Stop daemon
  console.log();
  try {
    await killDaemon();
    console.log(chalk.green('  \u2713 Daemon stopped'));
  } catch {
    console.log(chalk.dim('  Daemon was not running'));
  }

  // 4. Remove autostart
  if (isAutostartInstalled()) {
    try {
      removeAutostart();
      console.log(chalk.green('  \u2713 Auto-start service removed'));
    } catch {
      console.log(chalk.red('  \u2717 Failed to remove auto-start service'));
    }
  }

  console.log(chalk.dim('\nDone! UseAI fully removed.\n'));
}

// ── Help ────────────────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
  ${chalk.bold('Usage:')} npx @devness/useai@latest mcp [tools...] [options]

  Configure UseAI MCP server in your AI tools.
  Default: starts daemon, installs auto-start, configures tools with HTTP.

  ${chalk.bold('Arguments:')}
    tools       Specific tool names (e.g. codex cursor vscode)

  ${chalk.bold('Options:')}
    --stdio     Use stdio config (legacy mode for containers/CI)
    --remove    Remove UseAI from configured tools, stop daemon, remove auto-start
    --status    Show configuration status without modifying
    -y, --yes   Skip confirmation, auto-select all detected tools
    -h, --help  Show this help message
`);
}

// ── Main Entry ──────────────────────────────────────────────────────────────

export async function runSetup(args: string[]): Promise<void> {
  const flags = new Set(args.filter((a) => a.startsWith('-')));
  const toolNames = args.filter((a) => !a.startsWith('-'));

  if (flags.has('-h') || flags.has('--help')) {
    showHelp();
    return;
  }

  const isRemove = flags.has('--remove');
  const isStatus = flags.has('--status');
  const isStdio = flags.has('--stdio');
  const autoYes = flags.has('-y') || flags.has('--yes');
  const explicit = toolNames.length > 0;

  let tools = AI_TOOLS;

  if (explicit) {
    const { matched, unmatched } = resolveTools(toolNames);
    if (unmatched.length > 0) {
      console.log(chalk.red(`  Unknown tool${unmatched.length === 1 ? '' : 's'}: ${unmatched.join(', ')}`));
      console.log(chalk.dim(`  Available: ${AI_TOOLS.map((t) => t.id).join(', ')}`));
      return;
    }
    tools = matched;
  }

  if (isStatus) {
    // Only show tools that are actually installed on this system
    const detected = tools.filter((t) => t.detect());
    (await getShared()).showStatus(detected);
  } else if (isRemove) {
    await fullRemoveFlow(tools, autoYes, explicit);
  } else if (isStdio) {
    await (await getShared()).installFlow(tools, autoYes, explicit);
  } else {
    await daemonInstallFlow(tools, autoYes, explicit);
  }
}
