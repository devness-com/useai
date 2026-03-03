import pc from 'picocolors';
import { homedir } from 'node:os';

export function header(text: string): string {
  return pc.bold(pc.cyan(`\n  ${text}\n  ${'─'.repeat(text.length)}`));
}

export function table(rows: [string, string][]): string {
  const maxLabel = Math.max(...rows.map(([label]) => label.length));
  return rows
    .map(([label, value]) => `  ${pc.dim(label.padEnd(maxLabel))}  ${value}`)
    .join('\n');
}

export function success(text: string): string {
  return pc.green(`  ${text}`);
}

export function error(text: string): string {
  return pc.red(`  ${text}`);
}

export function info(text: string): string {
  return pc.dim(`  ${text}`);
}

export function shortenPath(p: string): string {
  const home = homedir();
  return home && p.startsWith(home) ? '~' + p.slice(home.length) : p;
}
