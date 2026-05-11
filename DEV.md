# Dev Setup

## First-time setup

- `cd` into the project root (e.g. `cd ~/Desktop/projects/useai`)
- `pnpm install`

## Debugging the daemon

Open the project in VS Code and run **Debug Daemon** (Run and Debug panel,
or press F5). No terminal commands needed — the launch config does everything.

What happens when you hit Debug Daemon:

1. **`build:all`** — runs `pnpm build` at the workspace root (turbo → `tsc`
   on every package). If any package has a TypeScript error, the build
   fails and the daemon does not start. Errors show up in the Problems panel.
2. **`dev:watch`** — starts `pnpm dev` in the background (turbo →
   `tsc --watch` on every package). Keeps `dist/` fresh as you edit.
3. **Daemon launches** — `node --watch ./dist/cli/index.js daemon-run`
   from `packages/useai`. Edits to any package's source → tsc emits new
   `dist/` → `node --watch` restarts the daemon → VS Code reattaches the
   debugger automatically (`restart: true`).

The daemon binds to port **19200** by default. If 19200 is occupied, it
falls back to the next available port — check `~/.useai/daemon.log` or
`~/.useai/config.json` for the actual port.

## Dashboard

After the daemon is running, open the dashboard:

- `http://127.0.0.1:19200/` (or whichever port the daemon picked)

Breakpoints work on the original TypeScript sources via source maps.

## Why `dist/cli/index.js` and not `dist/cli.js`?

`packages/useai` produces two outputs:

- `dist/cli.js` — `tsup` **bundle** (single inlined file, used by the
  published npm package's `bin`).
- `dist/cli/index.js` — `tsc` output (preserves source structure).

The debugger uses the tsc output because `pnpm dev` (`tsc --watch`)
keeps it fresh on every save. The bundle is only rebuilt by `tsup` /
`pnpm bundle` — running the bundled file in dev would serve stale code.

## Removing useai from all installed tools

```
node packages/useai/dist/cli/index.js mcp remove --yes
```

(or simply `useai mcp remove --yes` if you have it installed globally.)
