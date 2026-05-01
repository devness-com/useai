# UseAI — Distribution & Auto-Update Plan

**Status:** in progress
**Owner:** @nabeel
**Last updated:** 2026-05-01

The goal is to make the product promise — *install once and forget it, every AI session captured forever* — actually true. Today the user installs via `npx @devness/useai` and is implicitly responsible for staying current. That contradicts the pitch. This plan flips it: the daemon updates itself on a daily cadence with rollback safety, and the homepage signals a real install rather than a one-shot trial.

## Decisions

### D1. Hero install command

Switch the homepage CTA from `npx @devness/useai` to `npm install -g @devness/useai`. Keep `npx @devness/useai` as a smaller "or run once" secondary line for trial-mode users.

**Why.** The merged `@devness/useai` package already exposes a single `useai` bin with the full CLI surface (`useai daemon status`, `useai update`, `useai login`, `useai sync`, …). Global install gives users real shell commands and is the same mental model Claude Code uses.

### D2. Install target for the auto-updater

For v1, the daemon shells out to `npm install -g @devness/useai@latest` (same path the existing manual `useai update` already uses). At runtime the auto-updater detects whether the global node_modules path is writable. If not (sudo install case), it logs a clear error to `~/.useai/daemon.log`, disables itself, and surfaces a one-time "auto-update disabled — please reinstall via nvm/fnm" message. We do **not** ship a curl installer in v1.

**Why.** A curl installer is the right eventual answer (Bun/Deno/Claude Code all do it), but it requires hosted install scripts, signed binaries per platform, and a CDN — infrastructure we don't have today. Shipping it half-built is worse than not shipping it. The runtime-writability fallback covers the failure mode without committing to that build-out.

### D3. Cross-version data compatibility

The on-disk session format (JSONL files in `~/.useai/data/`) and the Ed25519 chain MUST remain backwards-compatible across every published version. A compatibility test suite that loads fixtures from the last N versions runs in CI on every release. This is the floor that makes auto-update safe.

## Phases

### Phase 1 — Documentation and homepage (ship today)

- **P1.1** Fix stale `CLAUDE.md` files. Both `useai-oss/CLAUDE.md` and the parent `useai/CLAUDE.md` describe the obsolete two-package world (`packages/mcp` / `packages/cli`). Replace with the actual `packages/useai/src/{cli,daemon,mcp-tools,core}` layout.
- **P1.2** Update README install instructions to lead with `npm install -g`.
- **P1.3** Update `useai.dev` hero in `useai-cloud/packages/web` (separate repo — diff drafted in this session, applied separately).

### Phase 2 — Daemon auto-update (the actual feature)

- **P2.1** Port fallback. Replace the hardcoded `DAEMON_PORT=19200` with a try-19200-then-next-10 approach. Persist the chosen port to `~/.useai/config.json` under `daemon.port`. Update CLI URL helpers to read from config. This is unrelated to auto-update mechanically but it's the other thing that breaks "forget it" — a port collision from another app installed later.
- **P2.2** Auto-updater module (`packages/useai/src/daemon/core/auto-updater.ts`):
  - Schedule a check 5 min after daemon boot, then every 24h.
  - Reuse `checkForUpdate()` from `update.service.ts`.
  - Persist last-check timestamp to `~/.useai/data/update-state.json`.
- **P2.3** Idle gate. Skip the install when any session is active. Retry every 30 min until idle.
- **P2.4** Writability check. Detect global node_modules writability before invoking `npm install -g`. Disable auto-update with a clear log if not writable.
- **P2.5** Graceful self-restart. After install, daemon exits with code 0; launchd/systemd respawns on the new binary. If autostart isn't enabled, log a warning and skip auto-install (manual `useai update` is the fallback).
- **P2.6** Rollback safeguard.
  - Cache the previous version's `dist/` at `~/.useai/versions/<previous>/` before installing.
  - Set a "post-update probation" flag on disk.
  - On boot, if the daemon crashed ≥3 times within 5 min of an update, restore the cached previous version and disable auto-update until manual re-enable.
- **P2.7** Logging. Every check/install/restart/rollback event lands in `~/.useai/daemon.log` with version + timestamp + outcome.

### Phase 3 — Production safeguards (required before claiming "install and forget" publicly)

- **P3.1** Channel support. Add `update.channel: "stable" | "beta"` to `~/.useai/config.json`. Daemon checks `npm view @devness/useai dist-tags.<channel>` instead of `version`. Default everyone to `stable`.
- **P3.2** Cloud kill switch. New `GET /api/v1/update-policy` endpoint on `useai-cloud` that returns `{ paused: boolean, reason?: string, minVersion?: string }`. Daemon honors before applying any update.
- **P3.3** Staged rollout via dist-tags. Publish to `next` first; promote `next → latest` after N daemons on `next` report successful sealed sessions over a soak window.
- **P3.4** Cross-version compatibility test in `packages/useai/test/compat/` that loads the last 3 published versions' JSONL fixtures and verifies the current chain reader can validate them. Runs on every release.

### Phase 4 — Communication

- **P4.1** Marketing copy update. Once Phase 2 ships, mention "auto-updates daily." Until Phase 3 ships, soften the language — say "self-updating" rather than "set and forget forever."
- **P4.2** Add `useai update --pin <version>` flag for users who explicitly want to freeze.
- **P4.3** Add `useai update --channel <stable|beta>` flag once P3.1 lands.

## Risks

- **One bad release breaks 100% of users at once.** Phase 3 (channels + kill switch + staged rollout) is non-negotiable before the homepage promises anything stronger than "self-updating."
- **Sudo install path.** Real users on shared machines hit this. v1 disables auto-update gracefully; long-term answer is the curl installer.
- **MCP client behavior.** Claude Desktop / Cursor / etc. spawn the MCP server in their own way. If their spawn semantics change, our auto-update doesn't help. Monitor.
- **Hardcoded port.** Will hit users eventually. Phase 2.1 fixes it.

## Sequencing

Phase 1 ships immediately — pure docs + homepage, no risk.
Phase 2 ships only after P2.5 (graceful restart) and P2.6 (rollback) both land. A bug in Phase 2 with no rollback would brick every user's daemon at once.
Phase 3 ships before any "install and forget forever" marketing language goes live.
