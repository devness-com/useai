import { describe, it, expect } from 'vitest';
import pc from 'picocolors';
import { header, table, success, error, info, shortenPath } from './display';

describe('display utilities', () => {
  describe('header', () => {
    it('produces bold cyan formatted string with underline matching text length', () => {
      const result = header('My Section');
      const expected = pc.bold(pc.cyan(`\n  My Section\n  ${'─'.repeat('My Section'.length)}`));
      expect(result).toBe(expected);
    });

    it('scales the underline to match longer text', () => {
      const text = 'Application Configuration Settings';
      const result = header(text);
      expect(result).toContain('─'.repeat(text.length));
    });

    it('handles a single character', () => {
      const result = header('X');
      const expected = pc.bold(pc.cyan('\n  X\n  ─'));
      expect(result).toBe(expected);
    });

    it('handles empty string with zero-length underline', () => {
      const result = header('');
      const expected = pc.bold(pc.cyan('\n  \n  '));
      expect(result).toBe(expected);
    });

    it('preserves spaces in the text', () => {
      const text = 'Hello World';
      const result = header(text);
      const expected = pc.bold(pc.cyan(`\n  Hello World\n  ${'─'.repeat(11)}`));
      expect(result).toBe(expected);
    });
  });

  describe('table', () => {
    it('aligns label-value rows with padding based on longest label', () => {
      const rows: [string, string][] = [
        ['Name', 'Alice'],
        ['Email', 'alice@example.com'],
      ];
      const result = table(rows);
      const expected = [
        `  ${pc.dim('Name ')}  Alice`,
        `  ${pc.dim('Email')}  alice@example.com`,
      ].join('\n');
      expect(result).toBe(expected);
    });

    it('pads shorter labels to match the longest label', () => {
      const rows: [string, string][] = [
        ['ID', '42'],
        ['Username', 'johndoe'],
        ['Status', 'active'],
      ];
      const result = table(rows);
      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe(`  ${pc.dim('ID      ')}  42`);
      expect(lines[1]).toBe(`  ${pc.dim('Username')}  johndoe`);
      expect(lines[2]).toBe(`  ${pc.dim('Status  ')}  active`);
    });

    it('handles a single row', () => {
      const rows: [string, string][] = [['Version', '1.0.0']];
      const result = table(rows);
      expect(result).toBe(`  ${pc.dim('Version')}  1.0.0`);
    });

    it('handles rows where all labels are the same length', () => {
      const rows: [string, string][] = [
        ['abc', 'value1'],
        ['def', 'value2'],
      ];
      const result = table(rows);
      const expected = [
        `  ${pc.dim('abc')}  value1`,
        `  ${pc.dim('def')}  value2`,
      ].join('\n');
      expect(result).toBe(expected);
    });

    it('preserves value formatting including special characters', () => {
      const rows: [string, string][] = [
        ['Path', '/usr/local/bin'],
        ['Port', '3000'],
      ];
      const result = table(rows);
      expect(result).toContain('/usr/local/bin');
      expect(result).toContain('3000');
    });
  });

  describe('success', () => {
    it('returns green colored text with leading padding', () => {
      const result = success('Operation completed');
      const expected = pc.green('  Operation completed');
      expect(result).toBe(expected);
    });

    it('handles empty string', () => {
      const result = success('');
      const expected = pc.green('  ');
      expect(result).toBe(expected);
    });

    it('preserves message content within the green styling', () => {
      const message = 'Deployed to production successfully';
      const result = success(message);
      expect(result).toBe(pc.green(`  ${message}`));
    });
  });

  describe('error', () => {
    it('returns red colored text with leading padding', () => {
      const result = error('Connection failed');
      const expected = pc.red('  Connection failed');
      expect(result).toBe(expected);
    });

    it('handles empty string', () => {
      const result = error('');
      const expected = pc.red('  ');
      expect(result).toBe(expected);
    });

    it('preserves error message content within the red styling', () => {
      const message = 'Failed to connect to database at localhost:5432';
      const result = error(message);
      expect(result).toBe(pc.red(`  ${message}`));
    });
  });

  describe('info', () => {
    it('returns dim colored text with leading padding', () => {
      const result = info('Loading configuration...');
      const expected = pc.dim('  Loading configuration...');
      expect(result).toBe(expected);
    });

    it('handles empty string', () => {
      const result = info('');
      const expected = pc.dim('  ');
      expect(result).toBe(expected);
    });

    it('preserves informational message content within dim styling', () => {
      const message = 'Using default settings from ~/.config/app.json';
      const result = info(message);
      expect(result).toBe(pc.dim(`  ${message}`));
    });
  });

  describe('shortenPath', () => {
    it('replaces home directory with ~', () => {
      const home = process.env['HOME'] ?? '';
      if (home) {
        expect(shortenPath(`${home}/Documents/file.txt`)).toBe('~/Documents/file.txt');
      }
    });

    it('returns path unchanged when not under home', () => {
      expect(shortenPath('/tmp/something')).toBe('/tmp/something');
    });

    it('handles exact home directory path', () => {
      const home = process.env['HOME'] ?? '';
      if (home) {
        expect(shortenPath(home)).toBe('~'); // Exact match shortens to ~
      }
    });
  });

  describe('consistent formatting across functions', () => {
    it('all output functions indent with two spaces', () => {
      const text = 'test message';
      const stripAnsi = (str: string) =>
        str.replace(/\x1B\[[0-9;]*m/g, '');

      expect(stripAnsi(success(text))).toBe(`  ${text}`);
      expect(stripAnsi(error(text))).toBe(`  ${text}`);
      expect(stripAnsi(info(text))).toBe(`  ${text}`);
    });

    it('each function wraps with the correct picocolors function', () => {
      const text = 'same message';
      const successResult = success(text);
      const errorResult = error(text);
      const infoResult = info(text);

      // Verify each function uses the correct picocolors wrapper
      expect(successResult).toBe(pc.green(`  ${text}`));
      expect(errorResult).toBe(pc.red(`  ${text}`));
      expect(infoResult).toBe(pc.dim(`  ${text}`));
    });
  });
});
