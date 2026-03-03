/**
 * MCP Setup — UseAI-specific orchestrator.
 *
 * Uses @clack/prompts for interactive CLI flows and picocolors for styling.
 * @clack/prompts is imported dynamically to avoid bundling into the MCP server runtime.
 *
 * IMPORTANT: This file is only loaded for CLI setup, never during MCP server runtime.
 */

import pc from 'picocolors';
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
import { AI_TOOLS, USEAI_INSTRUCTIONS_TEXT, resolveTools, type AiTool } from './tools.js';

// ── Lazy-load @clack/prompts ─────────────────────────────────────────────────
// Avoids bundling interactive UI into the MCP server runtime.

let _p: typeof import('@clack/prompts') | undefined;
async function getClack() {
  if (!_p) _p = await import('@clack/prompts');
  return _p;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortenPath(path: string): string {
  const home = process.env['HOME'] ?? '';
  return home && path.startsWith(home) ? '~' + path.slice(home.length) : path;
}

function showManualHints(p: typeof import('@clack/prompts'), installedTools: AiTool[]): void {
  const hints = installedTools
    .map((t) => ({ name: t.name, hint: t.getManualHint() }))
    .filter((h): h is { name: string; hint: string } => h.hint !== null);

  if (hints.length === 0) return;

  const lines = hints.map(({ name, hint }) => `${pc.bold(name)}: ${hint}`);
  lines.push('', ...USEAI_INSTRUCTIONS_TEXT.split('\n'));
  p.note(lines.join('\n'), `Manual setup needed for ${hints.length} tool${hints.length === 1 ? '' : 's'}`);
}

// ── Result types for grouped display ─────────────────────────────────────────

interface InstallResult {
  tool: AiTool;
  ok: boolean;
  mode: 'http' | 'stdio';
  error?: string;
}

function configureToolAndCollect(tool: AiTool, useDaemon: boolean): InstallResult {
  try {
    if (useDaemon && tool.supportsUrl) {
      tool.installHttp();
      return { tool, ok: true, mode: 'http' };
    }
    tool.install();
    return { tool, ok: true, mode: 'stdio' };
  } catch (e) {
    return { tool, ok: false, mode: 'stdio', error: (e as Error).message };
  }
}

function showGroupedResults(p: typeof import('@clack/prompts'), results: InstallResult[]): void {
  const httpOk = results.filter((r) => r.ok && r.mode === 'http');
  const stdioOk = results.filter((r) => r.ok && r.mode === 'stdio');
  const failed = results.filter((r) => !r.ok);

  if (httpOk.length > 0) {
    p.log.success(`HTTP (daemon): ${httpOk.map((r) => r.tool.name).join(', ')}`);
  }
  if (stdioOk.length > 0) {
    p.log.success(`stdio: ${stdioOk.map((r) => r.tool.name).join(', ')}`);
  }
  if (failed.length > 0) {
    for (const r of failed) {
      p.log.error(`${r.tool.name} — ${r.error}`);
    }
  }
}

// ── Daemon-first install (default) ──────────────────────────────────────────

async function daemonInstallFlow(tools: AiTool[], autoYes: boolean, explicit: boolean): Promise<void> {
  const p = await getClack();

  p.intro(pc.bgCyan(pc.black(' useai ')));

  // 1. Ensure daemon is running
  const s = p.spinner();
  s.start('Starting UseAI daemon...');
  const daemonOk = await ensureDaemon();

  if (!daemonOk) {
    s.stop('Could not start daemon');
    p.note(
      [
        'Check if the port is in use:',
        `  lsof -i :${DAEMON_PORT}`,
        '',
        'Run in foreground to debug:',
        `  npx @devness/useai daemon --port ${DAEMON_PORT}`,
        '',
        'For containers/CI, use stdio mode:',
        '  npx @devness/useai mcp --stdio',
      ].join('\n'),
      'Troubleshooting',
    );
    p.outro('Setup failed.');
    return;
  }

  const useDaemon = true;
  s.stop(`Daemon running on port ${DAEMON_PORT}`);
  p.log.info(`Dashboard: ${pc.cyan(`http://127.0.0.1:${DAEMON_PORT}/dashboard`)}`);

  // 2. Install auto-start
  const platform = detectPlatform();
  if (platform !== 'unsupported') {
    try {
      installAutostart();
      p.log.success(`Auto-start service installed (${platform})`);
    } catch {
      p.log.warn('Could not install auto-start service');
    }
  }

  // 3. When tools are explicitly named, configure them directly
  if (explicit) {
    const results: InstallResult[] = [];
    for (const tool of tools) {
      results.push(configureToolAndCollect(tool, useDaemon));
    }
    showGroupedResults(p, results);
    installHooksAndFinish(p, tools, results.filter((r) => r.ok).length, useDaemon);
    return;
  }

  // 4. Scan for AI tools
  const scanSpinner = p.spinner();
  scanSpinner.start('Scanning for AI tools...');
  const detected = tools.filter((t) => t.detect());
  scanSpinner.stop(`Found ${detected.length} AI tool${detected.length === 1 ? '' : 's'}`);

  if (detected.length === 0) {
    p.log.error('No AI tools detected on this machine.');
    p.outro('Setup complete.');
    return;
  }

  const alreadyConfigured = detected.filter((t) => t.isConfigured());
  const unconfigured = detected.filter((t) => !t.isConfigured());

  // Show detected tools summary
  const toolLines = [
    ...alreadyConfigured.map((t) => `${pc.green('✓')} ${t.name} ${pc.dim('(already configured)')}`),
    ...unconfigured.map((t) => `${pc.dim('○')} ${t.name}`),
  ];
  p.note(toolLines.join('\n'), `${detected.length} AI tool${detected.length === 1 ? '' : 's'} detected`);

  if (unconfigured.length === 0) {
    p.log.success('All detected tools are already configured.');
    // Still re-run install on configured tools to ensure config is up to date
    for (const tool of alreadyConfigured) {
      try { configureToolAndCollect(tool, useDaemon); } catch { /* ignore */ }
    }
    installHooksAndFinish(p, alreadyConfigured, alreadyConfigured.length, useDaemon);
    return;
  }

  // 5. Interactive selection (or auto-select with -y)
  let toInstall: AiTool[];
  if (autoYes) {
    toInstall = unconfigured;
  } else {
    const selected = await p.multiselect({
      message: `Select tools to configure ${pc.dim('(space to toggle)')}`,
      options: unconfigured.map((t) => ({
        value: t.id,
        label: t.name,
        hint: shortenPath(t.getConfigPath()),
      })),
      initialValues: unconfigured.map((t) => t.id),
      required: true,
    });

    if (p.isCancel(selected)) {
      p.cancel('Setup cancelled.');
      return;
    }
    toInstall = unconfigured.filter((t) => (selected as string[]).includes(t.id));
  }

  if (toInstall.length === 0) {
    p.log.info('No tools selected.');
    p.outro('Setup complete.');
    return;
  }

  // 6. Pre-install summary + confirmation
  const mode = useDaemon ? 'HTTP (daemon)' : 'stdio';
  const summaryLines = [
    `Tools:      ${toInstall.map((t) => t.name).join(', ')}`,
    `Mode:       ${mode}`,
  ];
  if (useDaemon && platform !== 'unsupported') {
    summaryLines.push(`Auto-start: ${platform}`);
  }
  summaryLines.push('Hooks:      Claude Code (UserPromptSubmit + Stop + SessionEnd)');
  p.note(summaryLines.join('\n'), 'Installation Summary');

  const shouldProceed = await p.confirm({ message: 'Proceed with installation?' });
  if (p.isCancel(shouldProceed) || !shouldProceed) {
    p.cancel('Setup cancelled.');
    return;
  }

  // 7. Configure selected tools
  const results: InstallResult[] = [];
  for (const tool of toInstall) {
    results.push(configureToolAndCollect(tool, useDaemon));
  }

  // Re-run install on already-configured tools to ensure config is up to date
  for (const tool of alreadyConfigured) {
    try { configureToolAndCollect(tool, useDaemon); } catch { /* ignore */ }
  }

  showGroupedResults(p, results);
  installHooksAndFinish(p, [...toInstall, ...alreadyConfigured], results.filter((r) => r.ok).length, useDaemon);
}

function installHooksAndFinish(
  p: typeof import('@clack/prompts'),
  allTools: AiTool[],
  configuredCount: number,
  useDaemon: boolean,
): void {
  try {
    const hooksInstalled = installClaudeCodeHooks();
    if (hooksInstalled) {
      p.log.success('Claude Code hooks installed (UserPromptSubmit + Stop + SessionEnd)');
    }
  } catch {
    p.log.warn('Could not install Claude Code hooks');
  }

  showManualHints(p, allTools);

  const mode = useDaemon ? 'daemon mode' : 'stdio mode';
  const dashboard = useDaemon ? `\n  Dashboard → ${pc.cyan(`http://127.0.0.1:${DAEMON_PORT}/dashboard`)}` : '';
  p.outro(`UseAI configured in ${pc.bold(String(configuredCount))} tool${configuredCount === 1 ? '' : 's'} (${mode}).${dashboard}`);
}

// ── Full remove flow (tools + daemon + autostart + hooks) ───────────────────

async function fullRemoveFlow(tools: AiTool[], autoYes: boolean, explicit: boolean): Promise<void> {
  const p = await getClack();

  p.intro(pc.bgCyan(pc.black(' useai ')));

  // 1. Remove tool configs
  if (explicit) {
    const toRemove = tools.filter((t) => {
      try { return t.isConfigured(); } catch { return false; }
    });
    const notConfigured = tools.filter((t) => {
      try { return !t.isConfigured(); } catch { return true; }
    });

    for (const tool of notConfigured) {
      p.log.info(`${tool.name} is not configured — skipping.`);
    }

    for (const tool of toRemove) {
      try {
        tool.remove();
        p.log.success(`Removed from ${tool.name}`);
      } catch (e) {
        p.log.error(`${tool.name} — ${(e as Error).message}`);
      }
    }
  } else {
    const configured = tools.filter((t) => {
      try { return t.isConfigured(); } catch { return false; }
    });

    if (configured.length === 0) {
      p.log.info('UseAI is not configured in any AI tools.');
    } else {
      let toRemove: AiTool[];
      if (autoYes) {
        toRemove = configured;
      } else {
        const selected = await p.multiselect({
          message: `Select tools to remove UseAI from ${pc.dim('(space to toggle)')}`,
          options: configured.map((t) => ({
            value: t.id,
            label: t.name,
            hint: shortenPath(t.getConfigPath()),
          })),
          initialValues: configured.map((t) => t.id),
          required: true,
        });

        if (p.isCancel(selected)) {
          p.cancel('Removal cancelled.');
          return;
        }
        toRemove = configured.filter((t) => (selected as string[]).includes(t.id));
      }

      if (toRemove.length === 0) {
        p.log.info('No tools selected.');
      } else {
        for (const tool of toRemove) {
          try {
            tool.remove();
            p.log.success(`Removed from ${tool.name}`);
          } catch (e) {
            p.log.error(`${tool.name} — ${(e as Error).message}`);
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
      p.log.success('Claude Code hooks removed');
    } catch { /* ignore */ }

    // 3. Stop daemon
    try {
      await killDaemon();
      p.log.success('Daemon stopped');
    } catch {
      p.log.info('Daemon was not running');
    }

    // 4. Remove autostart
    if (isAutostartInstalled()) {
      try {
        removeAutostart();
        p.log.success('Auto-start service removed');
      } catch {
        p.log.error('Failed to remove auto-start service');
      }
    }

    p.outro('UseAI fully removed.');
  } else {
    p.outro('Other tools still configured — daemon and hooks kept running.');
  }
}

// ── Help ────────────────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
  ${pc.bold('Usage:')} npx @devness/useai mcp [tools...] [options]

  Configure UseAI MCP server in your AI tools.
  Default: starts daemon, installs auto-start, configures tools with HTTP.

  ${pc.bold('Arguments:')}
    tools       Specific tool names (e.g. codex cursor vscode)

  ${pc.bold('Options:')}
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
      console.log(pc.red(`  Unknown tool${unmatched.length === 1 ? '' : 's'}: ${unmatched.join(', ')}`));
      console.log(pc.dim(`  Available: ${AI_TOOLS.map((t) => t.id).join(', ')}`));
      return;
    }
    tools = matched;
  }

  if (isStatus) {
    const p = await getClack();
    const detected = tools.filter((t) => t.detect());
    if (detected.length === 0) {
      p.log.warn('No supported AI tools detected on this system.');
      return;
    }
    const nameWidth = Math.max(...detected.map((t) => t.name.length));
    const lines = detected.map((tool) => {
      const name = tool.name.padEnd(nameWidth);
      const path = pc.dim(shortenPath(tool.getConfigPath()));
      if (tool.isConfigured()) {
        return `${name}  ${pc.green('✓ Configured')}    ${path}`;
      }
      return `${name}  ${pc.yellow('✗ Not set up')}    ${path}`;
    });
    p.note(lines.join('\n'), 'AI Tool MCP Status');
  } else if (isRemove) {
    await fullRemoveFlow(tools, autoYes, explicit);
  } else if (isStdio) {
    // For stdio flow, use lazy-loaded @clack/prompts same as daemon flow
    const p = await getClack();
    p.intro(pc.bgCyan(pc.black(' useai ')));

    if (explicit) {
      const results: InstallResult[] = [];
      for (const tool of tools) {
        results.push(configureToolAndCollect(tool, false));
      }
      showGroupedResults(p, results);
      showManualHints(p, tools);
      p.outro('Setup complete.');
      return;
    }

    const s = p.spinner();
    s.start('Scanning for AI tools...');
    const detected = tools.filter((t) => t.detect());
    s.stop(`Found ${detected.length} AI tool${detected.length === 1 ? '' : 's'}`);

    if (detected.length === 0) {
      p.log.error('No AI tools detected on this machine.');
      p.outro('Setup complete.');
      return;
    }

    const alreadyConfigured = detected.filter((t) => t.isConfigured());
    const unconfigured = detected.filter((t) => !t.isConfigured());

    const toolLines = [
      ...alreadyConfigured.map((t) => `${pc.green('✓')} ${t.name} ${pc.dim('(already configured)')}`),
      ...unconfigured.map((t) => `${pc.dim('○')} ${t.name}`),
    ];
    p.note(toolLines.join('\n'), `${detected.length} AI tool${detected.length === 1 ? '' : 's'} detected`);

    if (unconfigured.length === 0) {
      p.log.success('All detected tools are already configured.');
      p.outro('Nothing to do.');
      return;
    }

    let toInstall: AiTool[];
    if (autoYes) {
      toInstall = unconfigured;
    } else {
      const selected = await p.multiselect({
        message: `Select tools to configure ${pc.dim('(space to toggle)')}`,
        options: unconfigured.map((t) => ({
          value: t.id,
          label: t.name,
          hint: shortenPath(t.getConfigPath()),
        })),
        initialValues: unconfigured.map((t) => t.id),
        required: true,
      });

      if (p.isCancel(selected)) {
        p.cancel('Setup cancelled.');
        return;
      }
      toInstall = unconfigured.filter((t) => (selected as string[]).includes(t.id));
    }

    if (toInstall.length === 0) {
      p.log.info('No tools selected.');
      p.outro('Setup complete.');
      return;
    }

    const results: InstallResult[] = [];
    for (const tool of toInstall) {
      results.push(configureToolAndCollect(tool, false));
    }

    for (const tool of alreadyConfigured) {
      try { tool.install(); } catch { /* ignore */ }
    }

    showGroupedResults(p, results);
    showManualHints(p, [...toInstall, ...alreadyConfigured]);

    const configuredCount = results.filter((r) => r.ok).length;
    p.outro(`UseAI configured in ${pc.bold(String(configuredCount))} tool${configuredCount === 1 ? '' : 's'} (stdio mode).`);
  } else {
    await daemonInstallFlow(tools, autoYes, explicit);
  }
}
