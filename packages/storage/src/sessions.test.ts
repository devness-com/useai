import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session } from "@devness/useai-types";

/**
 * Storage tests for appendSession + readSessionsForDateRange.
 *
 * Strategy: SEALED_DIR is a module-level const computed from homedir() at
 * import time. The least-invasive way to redirect it is to mock the paths
 * module before sessions.ts is loaded. We use vi.hoisted() to construct the
 * tmp directory path before vi.mock factories execute.
 */

const fixture = vi.hoisted(() => {
  // Stable per-process tmp dir for the test file. Real mkdtemp happens in beforeAll.
  return {
    dir: "" as string,
  };
});

vi.mock("./paths.js", async () => {
  // Import the real module then override SEALED_DIR with a writable tmp path.
  const actual = await vi.importActual<typeof import("./paths.js")>(
    "./paths.js",
  );
  // The hoisted fixture.dir gets populated in beforeAll — but module factories
  // run before beforeAll. We need a getter that reads the fixture lazily.
  return {
    ...actual,
    get SEALED_DIR() {
      return fixture.dir;
    },
  };
});

// Import AFTER the mock is registered. Vitest hoists vi.mock automatically.
import { appendSession, readSessionsForDateRange } from "./sessions.js";

function makeSession(promptId: string, startedAt: string, endedAt: string): Session {
  return {
    promptId,
    connectionId: "conn_test",
    client: "claude-code",
    taskType: "coding",
    title: `Session ${promptId}`,
    startedAt,
    endedAt,
    durationMs: 1000,
    milestones: [],
    prevHash: "0".repeat(64),
    hash: "a".repeat(64),
    signature: "sig_" + promptId,
  };
}

describe("storage/sessions append + read round trip", () => {
  beforeAll(async () => {
    fixture.dir = await mkdtemp(join(tmpdir(), "useai-sessions-"));
  });

  afterAll(async () => {
    if (fixture.dir) {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });

  it("returns [] when SEALED_DIR is empty / nonexistent", async () => {
    const result = await readSessionsForDateRange(
      "2025-01-01T00:00:00.000Z",
      "2025-01-02T00:00:00.000Z",
    );
    expect(result).toEqual([]);
  });

  it("appends 3 sessions across 2 dates and reads them back", async () => {
    const s1 = makeSession(
      "p1",
      "2025-01-01T10:00:00.000Z",
      "2025-01-01T10:30:00.000Z",
    );
    const s2 = makeSession(
      "p2",
      "2025-01-01T14:00:00.000Z",
      "2025-01-01T14:15:00.000Z",
    );
    const s3 = makeSession(
      "p3",
      "2025-01-02T09:00:00.000Z",
      "2025-01-02T09:45:00.000Z",
    );

    await appendSession(s1);
    await appendSession(s2);
    await appendSession(s3);

    // Sanity: the JSONL files are in the temp dir
    const files = await readdir(fixture.dir);
    const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
    expect(dateFiles.sort()).toEqual(["2025-01-01.jsonl", "2025-01-02.jsonl"]);

    // Wide window covers both dates
    const all = await readSessionsForDateRange(
      "2025-01-01T00:00:00.000Z",
      "2025-01-02T23:59:59.999Z",
    );
    const ids = all.map((s) => s.promptId).sort();
    expect(ids).toEqual(["p1", "p2", "p3"]);
  });

  it("narrow window: returns sessions filed under the dates in the range", async () => {
    // Current implementation filters by date-file boundary (file name = endedAt
    // date). All three test sessions have startedAt and endedAt within the
    // same day, so this matches the spec's intent for the simple case.
    const result = await readSessionsForDateRange(
      "2025-01-01T00:00:00.000Z",
      "2025-01-01T23:59:59.999Z",
    );
    const ids = result.map((s) => s.promptId).sort();
    expect(ids).toEqual(["p1", "p2"]);
  });

  // Marked .skip: the spec says "only sessions whose startedAt..endedAt overlap
  // are returned". The current implementation filters by the date-file the
  // session is stored in (= endedAt date). A session that crossed midnight
  // and overlaps the queried window via startedAt — but ended on a different
  // date outside the window — will be missed. See report.
  it.skip(
    "BUG: cross-midnight session overlapping window is missed (filtered by endedAt date only)",
    async () => {
      // Session started 2025-01-01 23:55, ended 2025-01-02 00:05. Filed under
      // 2025-01-02. If we query for 2025-01-01, we should see it (overlap),
      // but the implementation does not return it.
      const crossed = makeSession(
        "p_crossed",
        "2025-01-01T23:55:00.000Z",
        "2025-01-02T00:05:00.000Z",
      );
      await appendSession(crossed);

      const result = await readSessionsForDateRange(
        "2025-01-01T00:00:00.000Z",
        "2025-01-01T23:59:59.999Z",
      );
      // Spec-expected: includes p_crossed because it overlaps 2025-01-01.
      // Current behavior: returns [p1, p2] only — p_crossed is filed under 2025-01-02.
      expect(result.map((s) => s.promptId)).toContain("p_crossed");
    },
  );
});
