import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:net";
import { resolveDaemonPort } from "./port-resolver.js";

/**
 * The resolver works by trying to bind a candidate port. To simulate a
 * "taken" port we keep a real server listening on it for the duration of
 * the test, then close it in afterEach so the next test starts clean.
 */
const HOSTNAME = "127.0.0.1";
let blockers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    blockers.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
        }),
    ),
  );
  blockers = [];
});

function block(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.once("listening", () => {
      blockers.push(server);
      resolve();
    });
    server.listen(port, HOSTNAME);
  });
}

describe("resolveDaemonPort", () => {
  it("returns the preferred port when it is free", async () => {
    // Pick a high uncommon port that is unlikely to be in use on a CI box.
    const result = await resolveDaemonPort(45123);
    expect(result).toBe(45123);
  });

  it("falls back when the preferred port is taken", async () => {
    await block(45124);
    const result = await resolveDaemonPort(45124);
    // Preferred is taken, so the resolver moves on. Default 19200 might or
    // might not be free on this host; what matters is that it does NOT
    // return the blocked preferred port.
    expect(result).not.toBe(45124);
  });

  it("returns 19200 when no preferred port is given and 19200 is free", async () => {
    // Skip if the host already has 19200 bound — the test is meaningless
    // there and we don't want a flaky pass/fail based on the dev box.
    const taken = !(await isFree(19200));
    if (taken) return;

    const result = await resolveDaemonPort();
    expect(result).toBe(19200);
  });

  it("probes the fallback range when 19200 is taken", async () => {
    const port19200Free = await isFree(19200);
    if (!port19200Free) {
      // We can't reliably block 19200 in CI if something else owns it; skip.
      return;
    }

    await block(19200);
    const result = await resolveDaemonPort();
    expect(result).toBeGreaterThanOrEqual(19201);
    expect(result).toBeLessThanOrEqual(19210);
  });

  it("throws when 19200 and the entire fallback range are taken", async () => {
    // Block 19200..19210 inclusive. If any of those is already in use by
    // some other process on this host, our `block()` call will throw —
    // skip the test in that case rather than report a false failure.
    try {
      for (let p = 19200; p <= 19210; p++) await block(p);
    } catch {
      return;
    }

    await expect(resolveDaemonPort()).rejects.toThrow(/no free port/);
  });
});

function isFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, HOSTNAME);
  });
}
