<!-- TODO: Add project logo/banner -->

# UseAI

<!-- badges -->
[![npm version](https://img.shields.io/npm/v/@devness/useai.svg)](https://www.npmjs.com/package/@devness/useai)
[![license](https://img.shields.io/npm/l/@devness/useai.svg)](https://github.com/devness/useai/blob/main/LICENSE)

**Track your AI coding sessions with privacy-first analytics.**

UseAI is a local-first [MCP server](https://modelcontextprotocol.io/) that records how you use AI coding tools -- session duration, languages, task types, and streaks -- without ever seeing your code. Think of it as Wakatime for AI coding.

<!-- TODO: Add screenshot/demo GIF -->

## Features

- **Session tracking** -- automatically records when you start and stop using AI tools
- **Streak tracking** -- daily coding streaks with global leaderboard
- **Evaluation metrics** -- self-assessed prompt quality, task outcomes, and independence scores
- **Local dashboard** -- built-in web UI served from the daemon (`useai serve`)
- **Privacy-first** -- everything stays in `~/.useai/` on your machine, zero network calls from the MCP server
- **Ed25519 signed chain** -- every session record is cryptographically signed for tamper evidence
- **Multi-tool support** -- works with Claude Code, Cursor, Windsurf, VS Code, GitHub Copilot, and more

## Quick Start

```bash
npx @devness/useai setup
```

This installs the MCP server and configures it for your AI tools automatically.

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

> No API key needed. The MCP server runs 100% locally.

## How It Works

UseAI runs as an MCP (Model Context Protocol) server. When your AI tool starts a conversation, it calls `useai_start`. During the session, periodic `useai_heartbeat` calls keep the timer alive. When the conversation ends, `useai_end` seals the session with a cryptographic signature.

All data is written to `~/.useai/` as JSONL files. The MCP server makes zero network calls.

| MCP Tool | What it does |
|----------|--------------|
| `useai_start` | Begin tracking a session |
| `useai_heartbeat` | Keep-alive during long sessions |
| `useai_end` | End session, record milestones and evaluation |

## What Gets Tracked

- Which AI tool you're using (Cursor, Claude Code, etc.)
- Session duration and task type (coding, debugging, testing, etc.)
- Programming languages used
- File count (number only, never file names)
- Generic milestone descriptions (privacy-filtered by design)
- Self-evaluation metrics (prompt quality, task outcome, independence)

**Never tracked:** your code, prompts, responses, file names, paths, or project names.

## CLI

```bash
useai stats         # View local stats: streaks, hours, tools, languages
useai status        # See everything stored on your machine
useai sync          # Sync aggregate stats to useai.dev
useai serve         # Start local analytics dashboard
useai config        # Manage settings
```

Install globally:

```bash
npm install -g @devness/useai-cli
```

## Architecture

UseAI is a monorepo with the following open source packages:

```
packages/
  shared/       Core types, constants, Ed25519 crypto chain
  mcp/          MCP server + HTTP daemon (published as @devness/useai)
  cli/          CLI tool (published as @devness/useai-cli)
  ui/           Shared React component library
  dashboard/    Local analytics web UI
  web/          Public website (useai.dev)
```

**Tech stack:** TypeScript, pnpm workspaces, Turborepo, Vitest, React 19, Tailwind v4.

## Privacy

UseAI is designed with privacy as architecture, not just policy:

- **Local-first** -- MCP server writes to disk, never to the network
- **Open source** -- audit exactly what gets recorded
- **Cryptographic chain** -- Ed25519 signed hash chain for tamper evidence
- **Opt-in sync** -- stats only leave your machine when you choose
- **You own your data** -- export or delete at any time

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## Links

- Website: [useai.dev](https://useai.dev)
- npm: [@devness/useai](https://www.npmjs.com/package/@devness/useai)

## License

[MIT](LICENSE)
