# UseAI

[![npm version](https://img.shields.io/npm/v/@devness/useai.svg)](https://www.npmjs.com/package/@devness/useai)
[![npm downloads](https://img.shields.io/npm/dm/@devness/useai.svg)](https://www.npmjs.com/package/@devness/useai)
[![license](https://img.shields.io/npm/l/@devness/useai.svg)](https://github.com/devness-com/useai/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/devness-com/useai)](https://github.com/devness-com/useai)

**Track your AI coding sessions with local-first analytics.**

UseAI is a local-first [MCP server](https://modelcontextprotocol.io/) that records how you use AI coding tools -- session duration, languages, task types, and streaks -- without ever seeing your code. Think of it as Wakatime for AI coding.

## Features

- **Prompt tracking** -- automatically records when you start and stop using AI tools
- **Clock time vs AI time** -- deduped wall-clock time and total AI session time with multiplier
- **Parallel sessions** -- run multiple AI sessions across projects, see peak concurrency
- **Streak tracking** -- daily coding streaks with global leaderboard
- **AI proficiency** -- prompts evaluated on prompt quality, context, scope, and independence (1-5 scale)
- **Local dashboard** -- built-in web UI served from the daemon
- **Public profile & leaderboard** -- opt-in shareable profile at useai.dev with global AI proficiency rankings
- **Ed25519 signed chain** -- every prompt record is cryptographically sealed for tamper evidence
- **Seal verification** -- real-time cloud verification at session end, only verified sessions count for leaderboard
- **30+ AI tools supported** -- Claude Code, Cursor, Windsurf, VS Code, Codex, Gemini CLI, GitHub Copilot, Aider, Cline, Zed, Amazon Q, JetBrains/Junie, Goose, Roo Code, and [many more](https://useai.dev/explore)

## Quick Start

```bash
npm install -g @devness/useai
useai setup
```

This installs the MCP server globally and configures it for your AI tools automatically.

<sub>Or run once without installing: `npx @devness/useai`</sub>

### Manual Setup

<details>
<summary>Claude Code</summary>

```bash
claude mcp add useai -- npx -y @devness/useai
```
</details>

<details>
<summary>Cursor</summary>

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "useai": {
      "command": "npx",
      "args": ["-y", "@devness/useai"]
    }
  }
}
```
</details>

<details>
<summary>VS Code</summary>

Add to your VS Code MCP settings:

```json
{
  "mcp": {
    "servers": {
      "useai": {
        "command": "npx",
        "args": ["-y", "@devness/useai"]
      }
    }
  }
}
```
</details>

<details>
<summary>Windsurf</summary>

Add to your Windsurf MCP config:

```json
{
  "mcpServers": {
    "useai": {
      "command": "npx",
      "args": ["-y", "@devness/useai"]
    }
  }
}
```
</details>

> No API key needed. The MCP server runs locally on your machine.

## How It Works

UseAI runs as an MCP (Model Context Protocol) server. When your AI tool starts a conversation, it calls `useai_start`. During the session, periodic `useai_heartbeat` calls track active time intervals. When the conversation ends, `useai_end` seals the session with an Ed25519 signature and a seal verification call to the cloud.

All data is written to `~/.useai/` as date-based JSONL files (e.g. `2026-04-27.jsonl`).

| MCP Tool | What it does |
|----------|--------------|
| `useai_start` | Begin tracking a prompt |
| `useai_heartbeat` | Keep-alive during long prompts, tracks active time segments |
| `useai_end` | End prompt, record milestones, evaluation, and seal verification |

### Daemon Mode

For tools that support HTTP-based MCP (StreamableHTTP), UseAI can run as a background daemon on `127.0.0.1:19200`. This allows multiple AI tool sessions to connect concurrently to the same tracking instance:

```bash
useai serve                   # Start daemon + local dashboard
```

The setup wizard auto-configures the right mode (stdio or daemon) for each tool.

## What Gets Tracked

- Which AI tool you're using (Cursor, Claude Code, etc.)
- Prompt duration and task type (coding, debugging, testing, etc.)
- Active time segments (for accurate clock time calculation)
- Programming languages used
- Files touched count
- Milestone descriptions (title, privateTitle, category, complexity)
- Project name
- Evaluation metrics (prompt quality, context, scope, independence, task outcome)

**Never tracked:** your code, prompts, or AI responses.

### What Gets Synced

When you sync, session metadata, titles, project names, evaluation scores, and milestones are sent to the server. Private titles and project names are only visible to you as the owner -- public profiles show aggregate stats only.

### Seal Verification

At the end of each prompt, a verification request is sent to the cloud with the session ID and timestamp. The server generates a unique signature -- proving the session was sealed in real-time. Only verified sessions count towards the leaderboard. If the cloud is unreachable, the session seals normally without verification.

## AI Proficiency Score (APS)

The APS is a composite 0-1000 score that aggregates your performance across multiple sessions. It combines five components:

| Component | Weight | Description |
|-----------|--------|-------------|
| Output | 25% | Complexity-weighted milestones completed |
| Efficiency | 25% | Complexity weight per hour of AI session time |
| Prompt Quality | 20% | Average prompt quality, context, and scope scores |
| Consistency | 15% | Active days ratio, streak, and session frequency |
| Breadth | 15% | Unique languages, AI tools, and tool leverage |

## Architecture

UseAI is a modular monorepo:

```
packages/
  types/          Pure types + zod schemas (zero deps)
  crypto/         Ed25519 chain, keystore, verification
  storage/        All filesystem I/O (sessions, config, paths)
  scoring/        Evaluation frameworks
  cloud/          Auth, sync, leaderboard API client
  mcp-server/     3 MCP tools (start/heartbeat/end) -- published as @devness/useai
  daemon/         Hono HTTP server, REST API routes, autostart, sync scheduler
  dashboard/      React 19 + Zustand + Tailwind SPA
  tool-installer/ Install/remove MCP config for 20+ AI tools
  cli/            Full CLI (Commander.js)
```

**Tech stack:** TypeScript 5.7 (strict), ESM only, pnpm workspaces, Turborepo, Hono, React 19, Vite 6, Tailwind v3, Zustand v5, Zod, MCP SDK.

## Privacy

- **Local-first** -- data stored in `~/.useai/`, processing happens on your machine
- **No code transmitted** -- source code, prompts, and AI responses never leave your machine
- **Open source** -- audit exactly what gets recorded ([AGPL-3.0](LICENSE))
- **Cryptographic chain** -- Ed25519 signed hash chain for tamper evidence
- **Opt-in sync** -- data only leaves your machine when you choose to sync
- **You own your data** -- export or delete date-based JSONL files at any time
- **Seal verification** -- a lightweight API call at session end for leaderboard eligibility; if offline, session seals normally

## CLI

```bash
useai stats         # View local stats
useai sync          # Sync sessions to useai.dev
useai serve         # Start daemon + local dashboard
useai config        # Manage settings
```

## Links

- Website: [useai.dev](https://useai.dev)
- GitHub: [devness-com/useai](https://github.com/devness-com/useai)
- npm: [@devness/useai](https://www.npmjs.com/package/@devness/useai)
- Explore: [useai.dev/explore](https://useai.dev/explore)

## License

[AGPL-3.0](LICENSE)
