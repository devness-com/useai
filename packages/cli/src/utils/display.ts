import chalk from 'chalk';

export function header(text: string): string {
  return chalk.bold.cyan(`\n  ${text}\n  ${'─'.repeat(text.length)}`);
}

export function table(rows: [string, string][]): string {
  const maxLabel = Math.max(...rows.map(([label]) => label.length));
  return rows
    .map(([label, value]) => `  ${chalk.dim(label.padEnd(maxLabel))}  ${value}`)
    .join('\n');
}

export function success(text: string): string {
  return chalk.green(`  ${text}`);
}

export function error(text: string): string {
  return chalk.red(`  ${text}`);
}

export function info(text: string): string {
  return chalk.dim(`  ${text}`);
}
