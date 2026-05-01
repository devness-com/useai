# CLAUDE.md — useai v3

## Project

This is useai v3 — a modular monorepo for tracking AI coding sessions via MCP.

## Structure

```
packages/
  cloud/            → Auth, sync, leaderboard API client
  crypto/           → Ed25519 chain, keystore, verification
  dashboard/        → React 19 + Vite SPA (analytics, embedded in daemon)
  storage/          → All filesystem I/O (sessions, config, paths)
  tool-installer/   → Install/remove MCP config for 20+ AI tools
  types/            → Pure types + zod schemas (zero deps)
  useai/            → THE main published package (@devness/useai)
    src/
      cli/          → CLI commands (setup, daemon, login, sync, update, ...)
      core/         → Domain logic
      daemon/       → Hono HTTP server + routes
      mcp-tools/    → MCP tool handlers (start/heartbeat/end)
```

The previously separate `mcp-server`, `daemon`, and `cli` packages have been merged
into a single `@devness/useai` package at `packages/useai/`. It exposes one `bin`
(`useai → ./dist/cli.js`) with subcommands: `setup`, `uninstall`, `mcp`, `serve`,
`stats`, `status`, `export`, `config`, `login`, `logout`, `sync`, `update`, plus
a `daemon` group (`start`, `stop`, `restart`, `status`, `logs`, `autostart`).

## Dependency order

types → crypto → storage → cloud → tool-installer → useai
types → dashboard (standalone SPA, talks to daemon via HTTP)

## Tech stack

- TypeScript 5.7 (strict), ESM only
- pnpm workspaces + Turborepo
- Hono (daemon HTTP server)
- React 19 + Vite 6 + Tailwind v3 (dashboard)
- Zustand v5 (state management)
- Zod (validation)
- MCP SDK (@modelcontextprotocol/sdk)
- Ed25519 + SHA-256 (tamper-evident chain)
- @clack/prompts (CLI interactive UI)

## Commands

- `pnpm build` — build all packages
- `pnpm dev` — dev mode (all packages)
- `pnpm test` — run tests
- Dashboard dev: `cd packages/dashboard && pnpm dev` (port 5173, proxies to daemon on 19200)
- Daemon dev: `cd packages/daemon && pnpm dev`

## Rules

### Git commits

- Do NOT add "Co-Authored-By" lines to commit messages. Ever.
- Write detailed commit messages in simple, plain English. Explain what changed and why in a way anyone can understand. Avoid jargon.
- Use a short title line, then a blank line, then bullet points explaining the changes.
- Always push to origin after committing.

### TypeScript

- Never modify tsconfig settings (strict, exactOptionalPropertyTypes, etc.) just to fix a type error — fix the code instead.

### Modularity

- Each file has one clear responsibility. If a file mixes concerns (e.g. data store + HTTP route + business logic), split it.
- Prefer small, focused files over large files that do multiple things.

### Code style

- ESM imports only (use .js extensions in import paths)
- Each package has one responsibility — if you can't describe it in one sentence, it's too big
- No barrel re-exports between packages — import from the specific subpath (e.g. `@devness/useai-storage/paths` not `@devness/useai-storage`)
- Prefer pure functions over classes where possible
- No unnecessary abstractions — three similar lines > premature helper

### Data paths

- All user data lives in `~/.useai/`
- Sessions: `~/.useai/data/YYYY-MM-DD.jsonl` (one file per day)
- Config: `~/.useai/config.json`
- Keystore: `~/.useai/keystore.json`
- PID file: `~/.useai/daemon.pid`
- Logs: `~/.useai/daemon.log`
- Daemon port: 19200

# Adding AI tool instructions

- Add it to instructions.ts file, not directly to the tool file.
