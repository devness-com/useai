#!/usr/bin/env bash
#
# split-repo.sh — Scaffold the useai-cloud private repo from private packages.
#
# This script:
#   1. Creates a useai-cloud/ directory alongside the public useai/ repo
#   2. Copies packages/api, packages/admin, packages/worker into it
#   3. Generates root package.json, pnpm-workspace.yaml, .gitignore
#   4. Prints next steps for linking back to the public packages
#
# Safe to run multiple times (idempotent).
#
# Usage:
#   bash scripts/split-repo.sh
#   bash scripts/split-repo.sh --output /path/to/useai-cloud

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default output: sibling directory to the public repo
OUTPUT="${1:-$(dirname "$PUBLIC_ROOT")/useai-cloud}"

echo ""
echo "  useai repo split"
echo "  ─────────────────────────────────────────"
echo "  Public repo:  $PUBLIC_ROOT"
echo "  Private repo: $OUTPUT"
echo ""

# ── Create directory structure ────────────────────────────────────────────────

mkdir -p "$OUTPUT/packages"

# ── Copy private packages ────────────────────────────────────────────────────

for pkg in api admin worker; do
  src="$PUBLIC_ROOT/packages/$pkg"
  dst="$OUTPUT/packages/$pkg"

  if [ ! -d "$src" ]; then
    echo "  [skip] packages/$pkg — source not found"
    continue
  fi

  # Remove old copy if it exists, then copy fresh
  if [ -d "$dst" ]; then
    echo "  [sync] packages/$pkg — removing old copy..."
    rm -rf "$dst"
  fi

  echo "  [copy] packages/$pkg"
  cp -R "$src" "$dst"
done

# ── Generate root package.json ───────────────────────────────────────────────

cat > "$OUTPUT/package.json" << 'PKGJSON'
{
  "name": "useai-cloud",
  "version": "0.2.0",
  "private": true,
  "description": "useai.dev — Private cloud packages (API, admin, worker)",
  "author": "nabeelkausari",
  "license": "UNLICENSED",
  "type": "module",
  "scripts": {
    "dev": "turbo dev",
    "dev:api": "turbo dev --filter=@useai/api",
    "dev:admin": "turbo dev --filter=@useai/admin",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "clean": "turbo clean && rm -rf node_modules",
    "db:generate": "pnpm --filter @useai/api run db:generate",
    "db:migrate": "pnpm --filter @useai/api run db:migrate",
    "db:studio": "pnpm --filter @useai/api run db:studio"
  },
  "devDependencies": {
    "prettier": "^3.2.5",
    "turbo": "^2.3.0",
    "typescript": "^5.7.3"
  },
  "packageManager": "pnpm@9.15.4",
  "engines": {
    "node": ">=18"
  }
}
PKGJSON

echo "  [write] package.json"

# ── Generate pnpm-workspace.yaml ─────────────────────────────────────────────

cat > "$OUTPUT/pnpm-workspace.yaml" << 'WORKSPACE'
packages:
  - packages/api
  - packages/admin
  - packages/worker
WORKSPACE

echo "  [write] pnpm-workspace.yaml"

# ── Generate turbo.json ──────────────────────────────────────────────────────

cat > "$OUTPUT/turbo.json" << 'TURBOJSON'
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "clean": {
      "cache": false
    }
  }
}
TURBOJSON

echo "  [write] turbo.json"

# ── Generate .gitignore ──────────────────────────────────────────────────────

cat > "$OUTPUT/.gitignore" << 'GITIGNORE'
node_modules/
dist/
.next/
*.tgz
.DS_Store
.env
.env.local
.turbo/
*.log
*.tsbuildinfo

# Drizzle migrations
**/drizzle/
GITIGNORE

echo "  [write] .gitignore"

# ── Generate .env.example ────────────────────────────────────────────────────

cat > "$OUTPUT/.env.example" << 'ENVEXAMPLE'
# useai-cloud environment variables
DATABASE_URL=postgresql://user:pass@localhost:5432/useai
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
ENVEXAMPLE

echo "  [write] .env.example"

# ── Copy README template ─────────────────────────────────────────────────────

TEMPLATE_README="$SCRIPT_DIR/cloud-repo-template/README.md"
if [ -f "$TEMPLATE_README" ]; then
  cp "$TEMPLATE_README" "$OUTPUT/README.md"
  echo "  [write] README.md (from template)"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "  Done! Private repo scaffolded at:"
echo "    $OUTPUT"
echo ""
echo "  Next steps:"
echo "  ─────────────────────────────────────────"
echo "  1. cd $OUTPUT"
echo "  2. git init && git add -A && git commit -m 'Initial private repo scaffold'"
echo "  3. Link public @useai/shared package (choose one):"
echo ""
echo "     Option A — npm link (for local development):"
echo "       cd $PUBLIC_ROOT/packages/shared && pnpm link --global"
echo "       cd $OUTPUT && pnpm link --global @useai/shared"
echo ""
echo "     Option B — git submodule (for CI/CD):"
echo "       cd $OUTPUT"
echo "       git submodule add <public-repo-url> useai-public"
echo "       # Then update workspace:* refs in package.json files to point to:"
echo "       #   \"@useai/shared\": \"file:../useai-public/packages/shared\""
echo ""
echo "     Option C — publish @useai/shared to npm:"
echo "       # If @useai/shared is published, just replace workspace:* with the version"
echo ""
