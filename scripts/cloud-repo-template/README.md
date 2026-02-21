# useai-cloud

Private cloud packages for [useai.dev](https://useai.dev). This repo contains the API, admin dashboard, and background worker that are not open sourced.

## Packages

| Package | Description |
|---------|-------------|
| `@useai/api` | NestJS backend API (PostgreSQL, Drizzle, BullMQ) |
| `@useai/admin` | Admin dashboard (React) |
| `@useai/worker` | BullMQ render worker |

## Prerequisites

- Node.js >= 18
- pnpm 9.x
- PostgreSQL
- Redis

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database and Redis URLs

# 3. Run database migrations
pnpm run db:migrate

# 4. Start development
pnpm run dev
```

## Linking Public Packages

The private packages depend on `@useai/shared` from the public [useai](https://github.com/user/useai) repo. Choose one of these approaches:

### Option A: npm link (local development)

```bash
# In the public useai repo:
cd packages/shared && pnpm link --global

# In this repo:
pnpm link --global @useai/shared
```

### Option B: git submodule

```bash
git submodule add <public-repo-url> useai-public

# Update workspace:* references in package.json files:
# "@useai/shared": "file:../../useai-public/packages/shared"
```

### Option C: Published npm package

If `@useai/shared` is published to npm, replace `workspace:*` with the version number in each `package.json`.

## Development

```bash
pnpm run dev           # Start all packages
pnpm run dev:api       # API only
pnpm run dev:admin     # Admin dashboard only
pnpm run db:studio     # Drizzle Studio (database GUI)
pnpm run test          # Run tests
pnpm run typecheck     # Type check all
```
