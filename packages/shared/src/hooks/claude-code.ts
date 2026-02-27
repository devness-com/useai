import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { USEAI_HOOKS_DIR, DAEMON_PORT } from '../constants/paths.js';

const STOP_GUARD_PATH = join(USEAI_HOOKS_DIR, 'stop-guard.js');
const PROMPT_GUARD_PATH = join(USEAI_HOOKS_DIR, 'prompt-guard.js');
const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

const STOP_GUARD_SCRIPT = `#!/usr/bin/env node
'use strict';
const { readFileSync } = require('node:fs');
let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const hook = JSON.parse(input);
    if (hook.stop_hook_active) process.exit(0);
    if (!hook.transcript_path) process.exit(0);
    let transcript;
    try { transcript = readFileSync(hook.transcript_path, 'utf-8'); } catch { process.exit(0); }
    var starts = (transcript.match(/useai_start/g) || []).length;
    if (starts === 0) process.exit(0);
    var ends = (transcript.match(/useai_end/g) || []).length;
    if (ends >= starts) process.exit(0);
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: 'Before ending, call useai_end with milestones (each with generic title, private_title for details, and category), languages used, and files_touched_count.'
    }));
  } catch { process.exit(0); }
});
`;

const PROMPT_GUARD_SCRIPT = `#!/usr/bin/env node
'use strict';
const { readFileSync } = require('node:fs');
let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const hook = JSON.parse(input);
    if (!hook.transcript_path) process.exit(0);
    let transcript;
    try { transcript = readFileSync(hook.transcript_path, 'utf-8'); } catch { process.exit(0); }
    var starts = (transcript.match(/useai_start/g) || []).length;
    var ends = (transcript.match(/useai_end/g) || []).length;
    if (starts > ends) process.exit(0);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: 'UseAI: Call useai_start with the appropriate task_type before doing any work.'
      }
    }));
  } catch { process.exit(0); }
});
`;

function readSettings(): Record<string, unknown> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  mkdirSync(join(homedir(), '.claude'), { recursive: true });
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Install Claude Code hooks for session lifecycle:
 * - UserPromptSubmit hook: nudges Claude to call useai_start if no open session
 * - Stop hook: forces Claude to call useai_end before stopping
 * - SessionEnd hook: safety-net seal via daemon HTTP API
 *
 * Returns true if hooks were newly installed (false if already present).
 */
export function installClaudeCodeHooks(): boolean {
  // 1. Write hook scripts
  mkdirSync(USEAI_HOOKS_DIR, { recursive: true });
  writeFileSync(STOP_GUARD_PATH, STOP_GUARD_SCRIPT);
  writeFileSync(PROMPT_GUARD_PATH, PROMPT_GUARD_SCRIPT);
  try { chmodSync(STOP_GUARD_PATH, '755'); } catch { /* Windows */ }
  try { chmodSync(PROMPT_GUARD_PATH, '755'); } catch { /* Windows */ }

  // 2. Merge hooks into ~/.claude/settings.json
  const settings = readSettings();
  const hooks = (settings['hooks'] ?? {}) as Record<string, unknown[]>;

  const promptCmd = `node "${PROMPT_GUARD_PATH}"`;
  const stopCmd = `node "${STOP_GUARD_PATH}"`;
  const sealCmd = `curl -sf -X POST http://127.0.0.1:${DAEMON_PORT}/api/seal-active --max-time 3 2>/dev/null || true`;

  let changed = false;

  // UserPromptSubmit hook
  if (!hooks['UserPromptSubmit']) hooks['UserPromptSubmit'] = [];
  const promptArr = hooks['UserPromptSubmit'] as Array<Record<string, unknown>>;
  const hasPrompt = promptArr.some((g) => {
    const inner = g['hooks'] as Array<Record<string, string>> | undefined;
    return inner?.some((h) => h['command']?.includes('prompt-guard'));
  });
  if (!hasPrompt) {
    promptArr.push({ hooks: [{ type: 'command', command: promptCmd, timeout: 10 }] });
    changed = true;
  }

  // Stop hook
  if (!hooks['Stop']) hooks['Stop'] = [];
  const stopArr = hooks['Stop'] as Array<Record<string, unknown>>;
  const hasStop = stopArr.some((g) => {
    const inner = g['hooks'] as Array<Record<string, string>> | undefined;
    return inner?.some((h) => h['command']?.includes('stop-guard'));
  });
  if (!hasStop) {
    stopArr.push({ hooks: [{ type: 'command', command: stopCmd, timeout: 10 }] });
    changed = true;
  }

  // SessionEnd hook
  if (!hooks['SessionEnd']) hooks['SessionEnd'] = [];
  const endArr = hooks['SessionEnd'] as Array<Record<string, unknown>>;
  const hasEnd = endArr.some((g) => {
    const inner = g['hooks'] as Array<Record<string, string>> | undefined;
    return inner?.some((h) => h['command']?.includes('seal-active'));
  });
  if (!hasEnd) {
    endArr.push({ hooks: [{ type: 'command', command: sealCmd, timeout: 5 }] });
    changed = true;
  }

  settings['hooks'] = hooks;
  writeSettings(settings);

  return changed;
}

/**
 * Remove UseAI hooks from Claude Code settings and delete the stop-guard script.
 */
export function removeClaudeCodeHooks(): void {
  // 1. Remove hooks from settings
  if (existsSync(CLAUDE_SETTINGS_PATH)) {
    try {
      const settings = readSettings();
      const hooks = settings['hooks'] as Record<string, unknown[]> | undefined;
      if (hooks) {
        if (hooks['UserPromptSubmit']) {
          hooks['UserPromptSubmit'] = (hooks['UserPromptSubmit'] as Array<Record<string, unknown>>).filter((g) => {
            const inner = g['hooks'] as Array<Record<string, string>> | undefined;
            return !inner?.some((h) => h['command']?.includes('prompt-guard'));
          });
          if ((hooks['UserPromptSubmit'] as unknown[]).length === 0) delete hooks['UserPromptSubmit'];
        }
        if (hooks['Stop']) {
          hooks['Stop'] = (hooks['Stop'] as Array<Record<string, unknown>>).filter((g) => {
            const inner = g['hooks'] as Array<Record<string, string>> | undefined;
            return !inner?.some((h) => h['command']?.includes('stop-guard'));
          });
          if ((hooks['Stop'] as unknown[]).length === 0) delete hooks['Stop'];
        }
        if (hooks['SessionEnd']) {
          hooks['SessionEnd'] = (hooks['SessionEnd'] as Array<Record<string, unknown>>).filter((g) => {
            const inner = g['hooks'] as Array<Record<string, string>> | undefined;
            return !inner?.some((h) => h['command']?.includes('seal-active'));
          });
          if ((hooks['SessionEnd'] as unknown[]).length === 0) delete hooks['SessionEnd'];
        }
        if (Object.keys(hooks).length === 0) delete settings['hooks'];
      }
      writeSettings(settings);
    } catch { /* ignore */ }
  }

  // 2. Remove hook scripts
  try {
    if (existsSync(STOP_GUARD_PATH)) unlinkSync(STOP_GUARD_PATH);
  } catch { /* ignore */ }
  try {
    if (existsSync(PROMPT_GUARD_PATH)) unlinkSync(PROMPT_GUARD_PATH);
  } catch { /* ignore */ }
}

/**
 * Check if UseAI hooks are installed in Claude Code settings.
 */
export function isClaudeCodeHooksInstalled(): boolean {
  const settings = readSettings();
  const hooks = settings['hooks'] as Record<string, unknown[]> | undefined;
  if (!hooks?.['Stop']) return false;
  return (hooks['Stop'] as Array<Record<string, unknown>>).some((g) => {
    const inner = g['hooks'] as Array<Record<string, string>> | undefined;
    return inner?.some((h) => h['command']?.includes('stop-guard'));
  });
}
