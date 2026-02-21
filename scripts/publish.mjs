#!/usr/bin/env node

/**
 * publish.mjs — Bump version, build, and publish @devness/useai + @devness/useai-cli.
 *
 * Usage:
 *   node scripts/publish.mjs patch       # 0.5.11 → 0.5.12
 *   node scripts/publish.mjs minor       # 0.5.11 → 0.6.0
 *   node scripts/publish.mjs major       # 0.5.11 → 1.0.0
 *   node scripts/publish.mjs 0.6.0       # explicit version
 *   node scripts/publish.mjs patch --dry  # show what would happen without publishing
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Paths ────────────────────────────────────────────────────────────────────

const VERSION_TS   = join(ROOT, 'packages/shared/src/constants/version.ts');
const MCP_PKG_JSON = join(ROOT, 'packages/mcp/package.json');
const CLI_PKG_JSON = join(ROOT, 'packages/cli/package.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function bumpVersion(current, bump) {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (bump) {
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'major': return `${major + 1}.0.0`;
    default:
      // Treat as explicit version
      if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
      console.error(`Invalid bump: "${bump}". Use patch, minor, major, or an explicit semver.`);
      process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const bump = process.argv[2];
const dry = process.argv.includes('--dry');

if (!bump) {
  console.error('Usage: node scripts/publish.mjs <patch|minor|major|x.y.z> [--dry]');
  process.exit(1);
}

const mcpPkg = readJson(MCP_PKG_JSON);
const cliPkg = readJson(CLI_PKG_JSON);
const currentVersion = mcpPkg.version;
const nextVersion = bumpVersion(currentVersion, bump);

console.log(`\n  Version: ${currentVersion} → ${nextVersion}${dry ? ' (dry run)' : ''}\n`);

// 1. Update version in all locations
console.log('  Updating versions...');

writeFileSync(VERSION_TS, `export const VERSION = '${nextVersion}';\n`);
console.log(`    ✓ packages/shared/src/constants/version.ts`);

mcpPkg.version = nextVersion;
writeJson(MCP_PKG_JSON, mcpPkg);
console.log(`    ✓ packages/mcp/package.json`);

cliPkg.version = nextVersion;
writeJson(CLI_PKG_JSON, cliPkg);
console.log(`    ✓ packages/cli/package.json`);

// 2. Build shared (must happen before bundling mcp/cli since they depend on it)
console.log('\n  Building shared...');
run('pnpm --filter @useai/shared run build');

// 3. Build dashboard (outputs HTML → mcp/src/dashboard/html.ts, must happen before bundling mcp)
console.log('\n  Building dashboard...');
run('pnpm --filter @useai/dashboard run build');

// 4. Bundle mcp + cli
console.log('\n  Bundling mcp...');
run('pnpm --filter @devness/useai run bundle');

console.log('\n  Bundling cli...');
run('pnpm --filter @devness/useai-cli run bundle');

if (dry) {
  console.log('\n  Dry run complete — skipping publish.\n');
  process.exit(0);
}

// 5. Publish
console.log('\n  Publishing @devness/useai...');
run('pnpm --filter @devness/useai publish --access public --no-git-checks');

console.log('\n  Publishing @devness/useai-cli...');
run('pnpm --filter @devness/useai-cli publish --access public --no-git-checks');

// 6. Done
console.log(`\n  ✓ Published v${nextVersion}`);
console.log(`    @devness/useai@${nextVersion}`);
console.log(`    @devness/useai-cli@${nextVersion}\n`);
