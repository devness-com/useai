import type { Command } from "commander";
import { intro, outro, spinner } from "@clack/prompts";
import { getDaemonUrl } from "@devness/useai-storage/config";

export function registerSync(parent: Command) {
  parent
    .command("sync")
    .description("Sync sessions to useai.dev")
    .action(async () => {
      intro("useai sync");

      const s = spinner();
      s.start("Syncing sessions...");

      try {
        const daemonUrl = await getDaemonUrl();
        const res = await fetch(`${daemonUrl}/api/local/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(60000),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          s.stop("Sync failed");
          outro(body.error ?? `HTTP ${res.status}`);
          process.exit(1);
        }

        const json = await res.json() as { ok: boolean; data?: { synced: number; skipped: number; errors: number } };
        const result = json.data ?? { synced: 0, skipped: 0, errors: 0 };
        s.stop("Sync complete");
        outro(`Synced ${result.synced} prompts (skipped: ${result.skipped}, errors: ${result.errors})`);
      } catch (err) {
        s.stop("Sync failed");
        outro(err instanceof Error ? err.message : "Failed to connect to daemon. Is it running?");
        process.exit(1);
      }
    });
}
