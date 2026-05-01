import type { Command } from "commander";
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getTimeWindow } from "../services/stats.service.js";
import { success, fail, header } from "../utils/display.js";
import { getDaemonUrl } from "@devness/useai-storage/config";
import type { Session } from "@devness/useai-types";

async function fetchAllSessions(
  start: string,
  end: string,
): Promise<Session[]> {
  const daemonUrl = await getDaemonUrl();
  const all: Session[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const params = new URLSearchParams({
      start,
      end,
      offset: String(offset),
      limit: String(limit),
    });
    const res = await fetch(`${daemonUrl}/api/local/prompts?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Daemon returned ${res.status}`);
    const json = (await res.json()) as {
      conversations: Array<{ prompts: Array<{ prompt: Session }> }>;
      hasMore: boolean;
    };
    for (const conv of json.conversations) {
      for (const pg of conv.prompts) {
        all.push(pg.prompt);
      }
    }
    if (!json.hasMore) break;
    offset += limit;
  }

  return all;
}

export function registerExport(program: Command): void {
  program
    .command("export")
    .description("Export prompts to a file")
    .option(
      "-s, --scale <scale>",
      "Time scale: day, week, month, year, or rolling like 7d, 30d",
      "month",
    )
    .option("-f, --format <fmt>", "Output format: json or csv", "json")
    .option("-o, --out <file>", "Output file path")
    .action(async (opts: { scale: string; format: string; out?: string }) => {
      const { start, end, label: windowLabel } = getTimeWindow(opts.scale);
      const format = opts.format === "csv" ? "csv" : "json";
      const defaultName = `useai-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      const exportDir = join(homedir(), "Desktop", "useai-exports");
      const outFile = opts.out ?? join(exportDir, defaultName);
      if (!opts.out) mkdirSync(exportDir, { recursive: true });

      header(`Export (${windowLabel})`);

      let sessions: Session[];
      try {
        sessions = await fetchAllSessions(start, end);
      } catch (err) {
        fail(`Failed to fetch sessions: ${(err as Error).message}`);
        process.exit(1);
      }

      try {
        const rows = sessions.map(toExportRow);
        const content =
          format === "csv" ? toCsv(sessions) : JSON.stringify(rows, null, 2);
        writeFileSync(outFile, content, "utf-8");
        success(`Exported ${sessions.length} sessions → ${outFile}`);
      } catch (err) {
        fail(`Export failed: ${err}`);
      }
      console.log();
    });
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h${m}m`;
  return `${m}m${s}s`;
}

function toExportRow(s: Session) {
  const ev = s.evaluation;
  return {
    promptId: s.promptId,
    prompt: s.prompt ?? "",
    tool: s.client,
    model: s.model ?? "",
    taskType: s.taskType,
    languages: s.languages ?? [],
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    duration: formatDuration(s.durationMs),
    promptQuality: ev?.prompt_quality ?? null,
    contextProvided: ev?.context_provided ?? null,
    scopeQuality: ev?.scope_quality ?? null,
    independenceLevel: ev?.independence_level ?? null,
    taskOutcome: ev?.task_outcome ?? null,
    iterationCount: ev?.iteration_count ?? null,
    toolsLeveraged: ev?.tools_leveraged ?? null,
    filesTouchedCount: s.filesTouchedCount ?? null,
  };
}

function toCsv(sessions: Session[]): string {
  if (sessions.length === 0) return "";
  const first = toExportRow(sessions[0]!);
  const cols = Object.keys(first) as (keyof ReturnType<typeof toExportRow>)[];
  const header = cols.join(",");
  const rows = sessions.map((s) => {
    const row = toExportRow(s);
    return cols
      .map((c) => {
        const v = row[c];
        if (Array.isArray(v)) return v.join("|");
        if (typeof v === "string") return `"${v.replace(/"/g, '""')}"`;
        return v ?? "";
      })
      .join(",");
  });
  return [header, ...rows].join("\n");
}
