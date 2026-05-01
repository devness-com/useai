import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateV1IfNeeded } from "./migrate-v1.js";

interface FakeSessionFixture {
  uuid: string;
  endedAt: string; // ISO timestamp
  startedAt?: string;
  hash?: string;
  signature?: string;
  client?: string;
  /** When true, omit the session_seal record so the file is malformed. */
  malformed?: boolean;
}

/**
 * Build a fake v1 chain file. The real format has 4 records (session_start,
 * session_end, milestone, session_seal), but parseSealedChain only requires
 * session_seal, so that's all we need to round-trip.
 */
function buildChainContent(f: FakeSessionFixture): string {
  const records: object[] = [
    {
      type: "session_start",
      session_id: f.uuid,
      timestamp: f.startedAt ?? f.endedAt,
      data: { client: f.client ?? "claude-code" },
    },
    {
      type: "session_end",
      session_id: f.uuid,
      timestamp: f.endedAt,
      data: {},
    },
    {
      type: "milestone",
      session_id: f.uuid,
      timestamp: f.endedAt,
      data: {
        title: `milestone-${f.uuid}`,
        category: "feature",
      },
    },
  ];

  if (!f.malformed) {
    records.push({
      type: "session_seal",
      session_id: f.uuid,
      timestamp: f.endedAt,
      hash: f.hash ?? `hash-${f.uuid}`,
      signature: f.signature ?? `sig-${f.uuid}`,
      data: {
        seal: {
          chain_end_hash: f.hash ?? `hash-${f.uuid}`,
          chain_start_hash: `start-${f.uuid}`,
          seal_signature: f.signature ?? `sig-${f.uuid}`,
          ended_at: f.endedAt,
          started_at: f.startedAt ?? f.endedAt,
          duration_seconds: 60,
          languages: ["typescript"],
          client: f.client ?? "claude-code",
          task_type: "coding",
          title: `session-${f.uuid}`,
          conversation_id: `conv-${f.uuid}`,
        },
      },
    });
  }

  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

async function writeFixture(
  sealedDir: string,
  f: FakeSessionFixture,
): Promise<void> {
  const path = join(sealedDir, `${f.uuid}.jsonl`);
  await writeFile(path, buildChainContent(f), "utf-8");
}

describe("migrateV1IfNeeded", () => {
  let dataDir: string;
  let sealedDir: string;
  let archiveDir: string;

  beforeEach(async () => {
    const root = await mkdtemp(join(tmpdir(), "useai-migrate-test-"));
    dataDir = join(root, "data");
    sealedDir = join(dataDir, "sealed");
    archiveDir = join(dataDir, "sealed.v1-archive");
    await mkdir(sealedDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true }).catch(() => {});
  });

  it("losslessly migrates UUID files into date buckets and archives originals", async () => {
    const fixtures: FakeSessionFixture[] = [
      { uuid: "uuid-a", endedAt: "2025-01-10T12:00:00.000Z", hash: "h-a", signature: "s-a" },
      { uuid: "uuid-b", endedAt: "2025-01-10T18:00:00.000Z", hash: "h-b", signature: "s-b" },
      { uuid: "uuid-c", endedAt: "2025-01-11T08:00:00.000Z", hash: "h-c", signature: "s-c" },
      { uuid: "uuid-d", endedAt: "2025-01-12T14:00:00.000Z", hash: "h-d", signature: "s-d" },
      { uuid: "uuid-e", endedAt: "2025-01-12T16:30:00.000Z", hash: "h-e", signature: "s-e" },
    ];
    for (const f of fixtures) await writeFixture(sealedDir, f);

    const result = await migrateV1IfNeeded(dataDir);

    expect(result.skipped).toBe(false);
    expect(result.migrated).toBe(5);
    expect(result.warnings).toBe(0);

    // Three date buckets exist with the right content
    const sealedEntries = await readdir(sealedDir);
    const dateFiles = sealedEntries
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .sort();
    expect(dateFiles).toEqual([
      "2025-01-10.jsonl",
      "2025-01-11.jsonl",
      "2025-01-12.jsonl",
    ]);

    const day10 = (await readFile(join(sealedDir, "2025-01-10.jsonl"), "utf-8"))
      .trim()
      .split("\n");
    expect(day10.length).toBe(2);

    const day11 = (await readFile(join(sealedDir, "2025-01-11.jsonl"), "utf-8"))
      .trim()
      .split("\n");
    expect(day11.length).toBe(1);

    const day12 = (await readFile(join(sealedDir, "2025-01-12.jsonl"), "utf-8"))
      .trim()
      .split("\n");
    expect(day12.length).toBe(2);

    // All hashes/signatures preserved verbatim across all 5 sessions
    const allLines = [...day10, ...day11, ...day12];
    const sessions = allLines.map((l) => JSON.parse(l) as Record<string, unknown>);
    const hashes = sessions.map((s) => s["hash"]).sort();
    const sigs = sessions.map((s) => s["signature"]).sort();
    expect(hashes).toEqual(["h-a", "h-b", "h-c", "h-d", "h-e"]);
    expect(sigs).toEqual(["s-a", "s-b", "s-c", "s-d", "s-e"]);

    // Each session has its milestone embedded
    for (const s of sessions) {
      const ms = s["milestones"] as unknown[];
      expect(Array.isArray(ms)).toBe(true);
      expect(ms.length).toBe(1);
    }

    // Originals UUID files are gone from sealed/, present in archive
    const remainingUuids = sealedEntries.filter(
      (f) => f.endsWith(".jsonl") && !/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f),
    );
    expect(remainingUuids).toEqual([]);

    const archived = (await readdir(archiveDir)).sort();
    expect(archived).toEqual([
      "uuid-a.jsonl",
      "uuid-b.jsonl",
      "uuid-c.jsonl",
      "uuid-d.jsonl",
      "uuid-e.jsonl",
    ]);

    // Done marker written
    expect(existsSync(join(dataDir, ".migrated-v1"))).toBe(true);
    const marker = JSON.parse(
      await readFile(join(dataDir, ".migrated-v1"), "utf-8"),
    ) as { count: number; completedAt: string };
    expect(marker.count).toBe(5);
    expect(typeof marker.completedAt).toBe("string");
  });

  it("logs malformed files and leaves them in place", async () => {
    const good: FakeSessionFixture[] = [
      { uuid: "good-1", endedAt: "2025-02-01T10:00:00.000Z" },
      { uuid: "good-2", endedAt: "2025-02-01T11:00:00.000Z" },
      { uuid: "good-3", endedAt: "2025-02-02T09:00:00.000Z" },
      { uuid: "good-4", endedAt: "2025-02-03T09:00:00.000Z" },
    ];
    const bad: FakeSessionFixture = {
      uuid: "bad-1",
      endedAt: "2025-02-04T09:00:00.000Z",
      malformed: true,
    };

    for (const f of good) await writeFixture(sealedDir, f);
    await writeFixture(sealedDir, bad);

    const result = await migrateV1IfNeeded(dataDir);

    expect(result.migrated).toBe(4);
    expect(result.warnings).toBe(1);
    expect(result.skipped).toBe(false);

    // Good ones archived, bad one still in sealed/
    const archived = (await readdir(archiveDir)).sort();
    expect(archived).toEqual([
      "good-1.jsonl",
      "good-2.jsonl",
      "good-3.jsonl",
      "good-4.jsonl",
    ]);
    expect(archived).not.toContain("bad-1.jsonl");

    const sealedEntries = await readdir(sealedDir);
    expect(sealedEntries).toContain("bad-1.jsonl");

    // Warnings log has exactly one entry, and it names the bad file
    const warningsLog = await readFile(
      join(dataDir, ".migrate-v1-warnings.log"),
      "utf-8",
    );
    const warnLines = warningsLog.trim().split("\n").filter(Boolean);
    expect(warnLines.length).toBe(1);
    expect(warnLines[0]).toContain("bad-1.jsonl");
  });

  it("is idempotent — second invocation is a no-op and returns skipped:true", async () => {
    await writeFixture(sealedDir, {
      uuid: "only-1",
      endedAt: "2025-03-01T10:00:00.000Z",
    });

    const first = await migrateV1IfNeeded(dataDir);
    expect(first.skipped).toBe(false);
    expect(first.migrated).toBe(1);

    // Drop a fresh UUID file *after* the first run completed. The migrator
    // must not pick it up — once migration is sealed, it stays sealed.
    await writeFixture(sealedDir, {
      uuid: "only-2",
      endedAt: "2025-03-02T10:00:00.000Z",
    });

    const second = await migrateV1IfNeeded(dataDir);
    expect(second.skipped).toBe(true);
    expect(second.migrated).toBe(0);
    expect(second.warnings).toBe(0);

    // The new file is still sitting in sealed/ untouched
    const sealedEntries = await readdir(sealedDir);
    expect(sealedEntries).toContain("only-2.jsonl");
  });

  it("refuses to migrate when a live PID owns the lock", async () => {
    await writeFixture(sealedDir, {
      uuid: "live-1",
      endedAt: "2025-04-01T10:00:00.000Z",
    });

    const lockPath = join(dataDir, ".migrating");
    // PID 1 (init/launchd) is always alive on Unix systems and is never us.
    const lockInfo = { pid: 1, startedAt: new Date().toISOString() };
    await writeFile(lockPath, JSON.stringify(lockInfo), "utf-8");

    const result = await migrateV1IfNeeded(dataDir);

    expect(result.skipped).toBe(true);
    expect(result.migrated).toBe(0);

    // Marker is preserved
    expect(existsSync(lockPath)).toBe(true);
    const stillThere = JSON.parse(await readFile(lockPath, "utf-8")) as {
      pid: number;
    };
    expect(stillThere.pid).toBe(lockInfo.pid);

    // Source file untouched
    const sealedEntries = await readdir(sealedDir);
    expect(sealedEntries).toContain("live-1.jsonl");
    expect(existsSync(join(dataDir, ".migrated-v1"))).toBe(false);
  });

  it("removes stale lock when owner PID is dead and proceeds", async () => {
    await writeFixture(sealedDir, {
      uuid: "stale-1",
      endedAt: "2025-05-01T10:00:00.000Z",
    });

    const lockPath = join(dataDir, ".migrating");
    // PID 99999 — extremely unlikely to be alive in CI/local.
    await writeFile(
      lockPath,
      JSON.stringify({ pid: 99999, startedAt: "2020-01-01T00:00:00.000Z" }),
      "utf-8",
    );

    const result = await migrateV1IfNeeded(dataDir);

    expect(result.skipped).toBe(false);
    expect(result.migrated).toBe(1);

    // Lock is released after the run
    expect(existsSync(lockPath)).toBe(false);

    const archived = await readdir(archiveDir);
    expect(archived).toContain("stale-1.jsonl");
  });

  it("ignores leftover .tmp files when scanning sources", async () => {
    await writeFixture(sealedDir, {
      uuid: "real-1",
      endedAt: "2025-06-01T10:00:00.000Z",
    });

    // Drop a leftover .tmp orphan from a previous interrupted run. It happens
    // to look like a valid date-bucket fragment, but the scanner should skip
    // any file ending in .jsonl.tmp.
    const orphan = join(sealedDir, "2025-06-01.jsonl.tmp");
    await writeFile(orphan, "this content must not appear in the date file\n", "utf-8");

    const result = await migrateV1IfNeeded(dataDir);

    expect(result.skipped).toBe(false);
    expect(result.migrated).toBe(1);

    // Date file contains exactly one line — the migrated session — and none of
    // the orphan content.
    const dayContent = await readFile(
      join(sealedDir, "2025-06-01.jsonl"),
      "utf-8",
    );
    expect(dayContent).not.toContain("this content must not appear");
    const lines = dayContent.trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(1);

    // Note: this specific orphan name (`2025-06-01.jsonl.tmp`) collides with
    // atomicWrite's own scratch path, so it gets overwritten and renamed away
    // in the course of producing the durable target. That's the correct
    // recovery behaviour after a crash. The key invariant verified above is
    // that the orphan's *contents* never leak into the final date file.
    const stats = await stat(join(sealedDir, "2025-06-01.jsonl"));
    expect(stats.size).toBeGreaterThan(0);
  });
});
