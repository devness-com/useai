import { createServer } from "node:net";

/**
 * Default daemon port. Lives next to the resolver so a single source of truth
 * controls both the resolver's fallback behaviour and the constant exported
 * by `@devness/useai-storage/paths`.
 */
const DEFAULT_PORT = 19200;

/**
 * The fallback probe range when the preferred port and the default 19200 are
 * both taken. Ten ports is a deliberate small ceiling: if a user has 12 apps
 * fighting over this range we want to fail loudly rather than silently land
 * on some arbitrary port forever.
 */
const FALLBACK_START = 19201;
const FALLBACK_END = 19210;

/**
 * Where this lives — and why:
 *
 * The resolver depends on `node:net` (a runtime side-effect: it actually
 * binds a socket). The storage package is intentionally a pure I/O layer for
 * filesystem state — adding network probing there would muddy its
 * responsibility. The daemon is the only consumer that must bind a real port
 * (CLI, tool-installer, dashboard just *read* the persisted port from
 * config), so the resolver belongs here, next to `app.ts` which calls it.
 */
export async function resolveDaemonPort(
  preferredPort?: number,
): Promise<number> {
  // Build the ordered candidate list. The contract from P2.1:
  //   1. preferred port from config (if supplied)
  //   2. the default 19200
  //   3. probe 19201..19210 in order
  // Duplicates are removed so we don't waste a probe re-trying the same port.
  const candidates: number[] = [];
  if (preferredPort !== undefined) candidates.push(preferredPort);
  if (!candidates.includes(DEFAULT_PORT)) candidates.push(DEFAULT_PORT);
  for (let p = FALLBACK_START; p <= FALLBACK_END; p++) {
    if (!candidates.includes(p)) candidates.push(p);
  }

  for (const port of candidates) {
    if (await isPortFree(port)) return port;
  }

  throw new Error(
    `useai daemon: no free port available. Tried ${candidates.join(", ")}. ` +
      `Stop the conflicting process, free one of these ports, or set USEAI_PORT to override.`,
  );
}

/**
 * Try to bind a port and immediately release it. Returns true if the bind
 * succeeded. The race window between this probe and the daemon's real
 * `serve()` call is small but non-zero; `app.ts` handles that race by
 * listening for `EADDRINUSE` on the actual server and re-running the
 * resolver once.
 *
 * We bind on the same hostname the daemon will use (`127.0.0.1` by default)
 * so the probe accurately reflects what `serve()` will see — a port can be
 * free on `127.0.0.1` but taken on `0.0.0.0` (and vice versa) so probing the
 * wrong interface gives false positives.
 */
function isPortFree(port: number, hostname = "127.0.0.1"): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = createServer();

    server.once("error", () => {
      // EADDRINUSE / EACCES / etc. — treat any bind error as "not free" and
      // let the caller try the next candidate.
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    try {
      server.listen(port, hostname);
    } catch {
      resolve(false);
    }
  });
}

export const DAEMON_DEFAULT_PORT = DEFAULT_PORT;
