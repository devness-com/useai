import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ChainLock,
  ChainLockTimeoutError,
  createPromptContext,
  createChildContext,
  removeChildSession,
  globalSessionRegistry,
} from "./prompt-context.js";
import { computeHash, signHash } from "@devness/useai-crypto";
import { generateKeyPairSync } from "node:crypto";

/**
 * Concurrency tests for ChainLock + globalSessionRegistry.
 *
 * These guard the irreversible-corruption surface: hash chain advancement
 * under concurrent useai_end calls. We don't run the real MCP tool — we
 * simulate the lock-protected critical section directly.
 */

describe("ChainLock", () => {
  it("serializes two concurrent acquirers — second blocks until first releases", async () => {
    const lock = new ChainLock();
    const order: string[] = [];

    await lock.acquire();
    order.push("first-acquired");

    let secondAcquiredFlag = false;
    const secondAcquirePromise = lock.acquire().then(() => {
      secondAcquiredFlag = true;
      order.push("second-acquired");
    });

    // Yield the event loop. The second acquire must NOT have resolved yet.
    await new Promise((r) => setImmediate(r));
    expect(secondAcquiredFlag).toBe(false);

    order.push("releasing-first");
    lock.release();

    await secondAcquirePromise;
    expect(secondAcquiredFlag).toBe(true);

    expect(order).toEqual([
      "first-acquired",
      "releasing-first",
      "second-acquired",
    ]);

    lock.release();
  });

  it("times out after the specified ms and throws ChainLockTimeoutError", async () => {
    vi.useFakeTimers();
    try {
      const lock = new ChainLock();
      await lock.acquire(); // first holder

      const timeoutMs = 1_000;
      const blocked = lock.acquire(timeoutMs);

      // Attach a noop catch immediately to prevent unhandledRejection
      // when fake-timers fire the timeout before we await it.
      const captured = blocked.catch((e) => e);

      await vi.advanceTimersByTimeAsync(timeoutMs + 10);

      const err = await captured;
      expect(err).toBeInstanceOf(ChainLockTimeoutError);
      expect((err as Error).message).toMatch(/1000ms/);

      lock.release();
    } finally {
      vi.useRealTimers();
    }
  });

  it("FIFO ordering: queued acquirers are released in the order they queued", async () => {
    const lock = new ChainLock();
    const order: number[] = [];

    await lock.acquire();

    const p1 = lock.acquire().then(() => order.push(1));
    const p2 = lock.acquire().then(() => order.push(2));
    const p3 = lock.acquire().then(() => order.push(3));

    lock.release(); // hands to 1
    await p1;
    lock.release(); // hands to 2
    await p2;
    lock.release(); // hands to 3
    await p3;
    lock.release();

    expect(order).toEqual([1, 2, 3]);
  });
});

describe("globalSessionRegistry + createChildContext + removeChildSession", () => {
  beforeEach(() => {
    // Clear shared state — globalSessionRegistry is a module-level Map.
    globalSessionRegistry.clear();
  });

  afterEach(() => {
    globalSessionRegistry.clear();
  });

  it("five concurrent children all get unique IDs and are findable via the registry", () => {
    const root = createPromptContext();
    root.startedAt = new Date();
    root.client = "claude-code";

    const children = Array.from({ length: 5 }, () => {
      const child = createChildContext(root, {});
      root.concurrentChildren.set(child.promptId, child);
      globalSessionRegistry.set(child.promptId, child);
      return child;
    });

    // All IDs unique
    const ids = new Set(children.map((c) => c.promptId));
    expect(ids.size).toBe(5);

    // All findable in the global registry
    for (const child of children) {
      expect(globalSessionRegistry.get(child.promptId)).toBe(child);
    }

    // All findable in root.concurrentChildren
    for (const child of children) {
      expect(root.concurrentChildren.get(child.promptId)).toBe(child);
    }

    // removeChildSession evicts from the parent map and accumulates childPausedMs
    const target = children[0]!;
    const before = root.childPausedMs;
    removeChildSession(root, target.promptId, 1234);
    expect(root.concurrentChildren.has(target.promptId)).toBe(false);
    expect(root.childPausedMs).toBe(before + 1234);
    // Note: removeChildSession does NOT clear the global registry — that's done
    // separately in end.ts. This is observed behavior; document it here.
    expect(globalSessionRegistry.get(target.promptId)).toBe(target);
  });

  it("createChildContext: child shares parent's chainLock (same chain head)", () => {
    const root = createPromptContext();
    root.startedAt = new Date();

    const child = createChildContext(root, {});
    expect(child.chainLock).toBe(root.chainLock);
    expect(child.connectionId).toBe(root.connectionId);
    expect(child.sessionDepth).toBe(root.sessionDepth + 1);
  });
});

describe("hash chain integrity under serialized concurrent end flows", () => {
  it("five concurrent seal operations advance prevHash without corruption", async () => {
    // Set up a real key pair and simulate the critical section of useai_end:
    //   acquire → read prevHash → compute hash → store as new prevHash → release.
    const { publicKey: _publicKey, privateKey } = generateKeyPairSync(
      "ed25519",
      {
        publicKeyEncoding: { type: "spki", format: "der" },
        privateKeyEncoding: { type: "pkcs8", format: "der" },
      },
    );
    void _publicKey;

    const ctx = createPromptContext();
    ctx.startedAt = new Date();

    const initialHash = ctx.prevHash;
    expect(initialHash).toBe("0".repeat(64));

    // Each "session" body is unique so the hash chain has visible progression.
    const bodies = Array.from({ length: 5 }, (_, i) => `session-body-${i}`);

    // Capture the (dataBody, prevHashSeen, hashWritten) for each iteration so
    // we can later prove no two iterations saw the same prevHash and the
    // resulting chain is well-formed.
    const observations: Array<{
      body: string;
      prevSeen: string;
      hashWritten: string;
    }> = [];

    async function endFlow(body: string) {
      await ctx.chainLock.acquire();
      try {
        const prevSeen = ctx.prevHash;
        const hash = computeHash(body, prevSeen);
        // signHash exercised for realism — we don't assert on the signature
        // here since chain.test.ts already covers signature verification.
        signHash(hash, privateKey as unknown as Buffer);
        ctx.prevHash = hash;
        observations.push({ body, prevSeen, hashWritten: hash });
      } finally {
        ctx.chainLock.release();
      }
    }

    // Kick off 5 concurrent end flows — only one runs at a time inside the lock.
    await Promise.all(bodies.map((b) => endFlow(b)));

    expect(observations).toHaveLength(5);

    // All prevSeen values must be unique (no two ends saw the same head).
    const prevSeenSet = new Set(observations.map((o) => o.prevSeen));
    expect(prevSeenSet.size).toBe(5);

    // The chain must be a single linked sequence: each prevSeen except the
    // first must equal the hashWritten of some earlier observation.
    const writtenSet = new Set(observations.map((o) => o.hashWritten));
    const firsts = observations.filter((o) => o.prevSeen === initialHash);
    expect(firsts).toHaveLength(1); // exactly one "starter" iteration

    for (const obs of observations) {
      if (obs.prevSeen === initialHash) continue;
      expect(writtenSet.has(obs.prevSeen)).toBe(true);
    }

    // The final ctx.prevHash must equal the hashWritten of the last release.
    const lastWritten =
      observations[observations.length - 1]!.hashWritten;
    expect(ctx.prevHash).toBe(lastWritten);

    // Sanity: ctx.prevHash matches re-computing the chain end from the
    // body+prev sequence.
    let walk = initialHash;
    // Reconstruct the sequence by following links from initialHash.
    const byPrev = new Map(observations.map((o) => [o.prevSeen, o]));
    for (let i = 0; i < observations.length; i++) {
      const next = byPrev.get(walk);
      expect(next).toBeDefined();
      walk = next!.hashWritten;
    }
    expect(walk).toBe(ctx.prevHash);
  });
});
