import { join } from "node:path";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { Session } from "@devness/useai-types";
import { SEALED_DIR } from "./paths.js";
import { ensureDir, appendLine } from "./fs.js";

function dateFilePath(date: string): string {
  return join(SEALED_DIR, `${date}.jsonl`);
}

function getLast(days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function appendSession(session: Session): Promise<void> {
  await ensureDir(SEALED_DIR);
  const date = session.endedAt.slice(0, 10);
  await appendLine(dateFilePath(date), JSON.stringify(session));
}

/**
 * Read sessions for a specific UTC date range.
 * start/end are ISO strings — extracts date portion and reads matching files.
 */
export async function readSessionsForDateRange(
  startIso: string,
  endIso: string,
): Promise<Session[]> {
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);

  // List all date files in sealed dir and filter to range
  if (!existsSync(SEALED_DIR)) return [];
  const allFiles = await readdir(SEALED_DIR);
  const dates = allFiles
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .map((f) => f.replace(".jsonl", ""))
    .filter((d) => d >= startDate && d <= endDate);

  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const raw = await readFile(dateFilePath(date), "utf-8");
        return raw
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Session);
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

export async function readSessionsForRange(days: number): Promise<Session[]> {
  const dates = getLast(Math.min(days, 32));
  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const raw = await readFile(dateFilePath(date), "utf-8");
        return raw
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Session);
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

export async function writeSessionsForDate(
  date: string,
  sessions: Session[],
): Promise<void> {
  await ensureDir(SEALED_DIR);
  const lines = sessions.map((s) => JSON.stringify(s));
  await writeFile(
    dateFilePath(date),
    lines.join("\n") + (lines.length ? "\n" : ""),
    "utf-8",
  );
}

interface SealedChainData {
  session: Record<string, unknown>;
  milestones: Record<string, unknown>[];
}

/**
 * Parse a single sealed UUID.jsonl chain file.
 * Extracts the session seal and milestones.
 */
export function parseSealedChain(file: string, raw: string): SealedChainData | null {
  const lines = raw.trim().split("\n").filter(Boolean);

  let sessionId: string | undefined;
  let startTimestamp: string | undefined;
  let client: string | undefined;
  let taskType: string | undefined;
  let seal: Record<string, unknown> | undefined;
  let sealRecordSignature: string | undefined;
  const milestones: Record<string, unknown>[] = [];

  for (const line of lines) {
    try {
      const record = JSON.parse(line) as {
        type: string;
        session_id?: string;
        timestamp?: string;
        data: Record<string, unknown>;
        hash?: string;
        signature?: string;
      };

      //There are 4 lines in every uuid.jsonl file:
      //1. session_start
      //2. session_end
      //3. milestone
      //4. session_seal

      //we consider only milestone and session_seal

      if (record.type === "session_seal") {
        const rawSeal = record.data["seal"];
        seal =
          typeof rawSeal === "string"
            ? (JSON.parse(rawSeal) as Record<string, unknown>)
            : (rawSeal as Record<string, unknown> | undefined);
        sealRecordSignature = record.signature;
      } else if (record.type === "milestone") {
        milestones.push(record.data);
      }
    } catch {
      // skip malformed lines
    }
  }

  if (!seal) return null;

  const chainHash = (seal["chain_end_hash"] as string) ?? "";
  const durationSeconds = (seal["duration_seconds"] as number) ?? 0;
  const languages = (seal["languages"] as string[]) ?? [];
  const sealClient = (seal["client"] as string) ?? client ?? "unknown";
  const id = sessionId ?? file.replace(".jsonl", "");

  const endedAt = (seal["ended_at"] as string) ?? "";
  const startedAt = (seal["started_at"] as string) ?? startTimestamp ?? "";

  // Build Session-compatible object (v3 camelCase shape)
  const session: Record<string, unknown> = {
    promptId: id,
    connectionId: (seal["conversation_id"] as string) ?? "",
    client: sealClient,
    taskType: (seal["task_type"] as string) ?? taskType ?? "other",
    title: (seal["title"] as string) ?? "",
    privateTitle: (seal["private_title"] as string) ?? undefined,
    project: (seal["project"] as string) ?? undefined,
    model: (seal["model"] as string) ?? undefined,
    prompt: (seal["prompt"] as string) ?? undefined,
    startedAt,
    endedAt,
    durationMs: durationSeconds * 1000,
    activeSegments:
      (seal["active_segments"] as [string, string][]) ?? undefined,
    languages,
    filesTouchedCount: (seal["files_touched"] as number) ?? 0,
    evaluation: seal["evaluation"] ?? undefined,
    prevHash: (seal["chain_start_hash"] as string) ?? "",
    hash: chainHash,
    signature: (seal["seal_signature"] as string) ?? sealRecordSignature ?? "",
    milestones: [],
    score: seal["score"] ?? undefined,
  };

  const enrichedMilestones = milestones.map((m) => ({
    ...m,
    sessionId: id,
    chainHash,
    client: sealClient,
    languages,
    durationMinutes: Math.round(durationSeconds / 60),
    createdAt: endedAt,
  }));

  return { session, milestones: enrichedMilestones };
}

/**
 * Read v1 sessions from sealed UUID.jsonl chain files.
 * Milestones are embedded in each session as `milestones` array
 * so the cloud /api/sync can extract them.
 */
export async function readV1Sessions(): Promise<Session[]> {
  if (!existsSync(SEALED_DIR)) return [];
  try {
    const files = await readdir(SEALED_DIR);
    const jsonlFiles = files.filter(
      (f) => f.endsWith(".jsonl") && !/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f),
    );
    const sessions: Session[] = [];

    for (const file of jsonlFiles) {
      const raw = await readFile(join(SEALED_DIR, file), "utf-8");
      const parsed = parseSealedChain(file, raw);
      if (parsed) {
        // Embed milestones in session
        parsed.session["milestones"] = parsed.milestones;
        sessions.push(parsed.session as unknown as Session);
      }
    }

    return sessions;
  } catch {
    return [];
  }
}

export async function deleteSession(promptId: string): Promise<void> {
  const dates = getLast(32);
  for (const date of dates) {
    const path = dateFilePath(date);
    try {
      const raw = await readFile(path, "utf-8");
      const lines = raw.trim().split("\n").filter(Boolean);
      const filtered = lines.filter((line) => {
        const s = JSON.parse(line) as Session;
        return s.promptId !== promptId;
      });
      if (filtered.length !== lines.length) {
        await writeFile(
          path,
          filtered.join("\n") + (filtered.length ? "\n" : ""),
          "utf-8",
        );
        return;
      }
    } catch {
      // file doesn't exist, skip
    }
  }
}
