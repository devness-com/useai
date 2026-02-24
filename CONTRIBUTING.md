# Contributing to UseAI

Thanks for your interest in contributing to UseAI! Whether it's a bug report, feature request, documentation improvement, or code contribution, we appreciate your help.

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 9 or later (`corepack enable` will set this up)
- **Git**

## Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/useai.git
cd useai

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the MCP server in dev mode
pnpm dev:mcp

# Run the CLI in dev mode
pnpm dev:cli

# Run the dashboard in dev mode
pnpm dev:dashboard
```

## Project Structure

UseAI is a monorepo managed with Turborepo. The following packages are open source:

| Package | Description |
|---------|-------------|
| `packages/shared` | Core types, constants, and the Ed25519 cryptographic chain |
| `packages/mcp` | MCP server + local HTTP daemon -- the main product, published as `@devness/useai` |
| `packages/cli` | CLI tool for stats, sync, and config, published as `@devness/useai-cli` |
| `packages/ui` | Shared React component library (Tailwind v4) |
| `packages/dashboard` | Local analytics dashboard embedded in the daemon |
| `packages/web` | Public website (Next.js SSR) |

> **Note:** `packages/api`, `packages/admin`, and `packages/worker` are cloud infrastructure packages and are not included in the open source repository.

## Development Workflow

1. **Pick a package to work on.** Most contributions will touch `packages/mcp`, `packages/cli`, or `packages/shared`.

2. **Run in dev mode.** Each package supports `pnpm dev` via Turborepo:
   ```bash
   pnpm dev:mcp        # MCP server + daemon
   pnpm dev:cli        # CLI
   pnpm dev:dashboard  # Local dashboard
   ```

3. **Run tests:**
   ```bash
   pnpm test           # Run all tests (Vitest)
   ```

4. **Type check:**
   ```bash
   pnpm typecheck      # TypeScript strict mode across all packages
   ```

5. **Lint and format:**
   ```bash
   pnpm lint
   pnpm format
   ```

## Code Style

- **TypeScript** with strict mode enabled
- **React 19** for UI components
- **Tailwind CSS v4** for styling
- **Vitest** for testing
- Run `pnpm format` before committing to ensure consistent formatting (Prettier)

## Submitting a Pull Request

1. **Fork** the repository and create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes.** Keep commits focused and descriptive.

3. **Test your changes:**
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

4. **Push** your branch and open a Pull Request against `main`.

5. In your PR description, include:
   - What the change does and why
   - How to test it
   - Screenshots if it touches UI

6. A maintainer will review your PR. We aim to respond within a few days.

## Reporting Issues

When filing an issue, please include:

- A clear, descriptive title
- Steps to reproduce the problem
- Expected vs. actual behavior
- Your environment (OS, Node.js version, AI tool being used)
- Relevant logs or error messages

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to the maintainers.

## Questions?

If you have questions or want to discuss a larger change before working on it, open a [Discussion](https://github.com/devness-com/useai/discussions) or file an issue. We're happy to help you get started.
