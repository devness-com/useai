# UseAI

[![npm version](https://img.shields.io/npm/v/@devness/useai.svg)](https://www.npmjs.com/package/@devness/useai)
[![npm downloads](https://img.shields.io/npm/dm/@devness/useai.svg)](https://www.npmjs.com/package/@devness/useai)
[![license](https://img.shields.io/npm/l/@devness/useai.svg)](https://github.com/devness-com/useai/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/devness-com/useai)](https://github.com/devness-com/useai)

**Track your AI coding sessions with privacy-first analytics.**

UseAI is a local-first [MCP server](https://modelcontextprotocol.io/) that records how you use AI coding tools -- session duration, languages, task types, and streaks -- without ever seeing your code. Think of it as Wakatime for AI coding.

## Features

- **Session tracking** -- automatically records when you start and stop using AI tools
- **Streak tracking** -- daily coding streaks with global leaderboard
- **Evaluation metrics** -- sessions scored using the [SPACE framework](https://queue.acm.org/detail.cfm?id=3454124) for prompt quality, context, independence, and scope
- **Local dashboard** -- built-in web UI served from the daemon (`useai serve`)
- **Public profile & leaderboard** -- opt-in shareable profile at useai.dev with global AI proficiency rankings
- **Privacy-first** -- everything stays in `~/.useai/` on your machine, zero network calls from the MCP server
- **Ed25519 signed chain** -- every session record is cryptographically signed for tamper evidence
- **30+ AI tools supported** -- Claude Code, Cursor, Windsurf, VS Code, Codex, Gemini CLI, GitHub Copilot, Aider, Cline, Zed, Amazon Q, JetBrains/Junie, Goose, Roo Code, and [many more](https://useai.dev/explore)

## Quick Start

```bash
npx @devness/useai
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

### Daemon Mode

For tools that support HTTP-based MCP (StreamableHTTP), UseAI can run as a background daemon on `127.0.0.1:19200`. This allows multiple AI tool sessions to connect concurrently to the same tracking instance:

```bash
useai serve                   # Start daemon + local dashboard
```

The setup wizard auto-configures the right mode (stdio or daemon) for each tool.

## Evaluation Frameworks

UseAI uses configurable **evaluation frameworks** to score each AI coding session. The framework controls what rubric the AI model uses when self-assessing session quality, producing a 0-100 session score.

| Framework | Description |
|-----------|-------------|
| **SPACE** (default) | Based on the [SPACE developer productivity framework](https://queue.acm.org/detail.cfm?id=3454124) by GitHub/Microsoft Research. Weighted rubrics across Communication (prompt quality, context), Efficiency (independence), and Performance (scope). |
| **Basic** | Simple equal-weight average across all dimensions. No detailed rubric guidance. |

Session scores feed into the **AI Proficiency Score (APS)** -- a 0-1000 composite score across five dimensions: Output, Efficiency, Prompt Quality, Consistency, and Breadth.

Change your framework:

```bash
useai config --framework space    # recommended
useai config --framework raw      # basic/no rubric
```

The setup wizard (`npx @devness/useai`) also lets you pick a framework during installation.

## What Gets Tracked

- Which AI tool you're using (Cursor, Claude Code, etc.)
- Session duration and task type (coding, debugging, testing, etc.)
- Programming languages used
- File count (number only, never file names)
- Generic milestone descriptions (privacy-filtered by design)
- Self-evaluation metrics (prompt quality, task outcome, independence)

**Never tracked:** your code, prompts, AI responses, file names, file paths, or directory structure.

### What Gets Synced

When you run `useai sync`, full session records (not just aggregates) are sent to the server. This includes all fields above plus `private_title` and `project` name. See [PRIVACY.md](PRIVACY.md) for the exact payload and what's publicly visible vs. private.

## CLI

```bash
useai stats         # View local stats: streaks, hours, tools, languages
useai status        # See everything stored on your machine
useai sync          # Sync sessions to useai.dev
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
- **Opt-in sync** -- data only leaves your machine when you choose
- **You own your data** -- export or delete at any time

For a complete list of every field captured, what happens when you sync, and what's visible on your public profile, see [PRIVACY.md](PRIVACY.md). For details on the cryptographic chain, see [SECURITY.md](SECURITY.md).

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## Links

- Website: [useai.dev](https://useai.dev)
- GitHub: [devness-com/useai](https://github.com/devness-com/useai)
- npm: [@devness/useai](https://www.npmjs.com/package/@devness/useai)
- Explore supported tools: [useai.dev/explore](https://useai.dev/explore)

## License

[AGPL-3.0](LICENSE)
