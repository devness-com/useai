/**
 * MCP Session ID → UseAI Session ID mapping file.
 *
 * Persists the relationship between MCP transport session IDs and UseAI
 * session IDs so that after a daemon restart, stale `useai_end` calls
 * can be recovered and the session properly sealed with milestones/evaluation.
 *
 * NOTE: The file path is computed via a getter function, not a module-level
 * const, because tsup's `splitting: false` mode hoists function declarations
 * out of the __esm initializer while keeping variable assignments inside it.
 * A module-level `const` would be `undefined` when functions are called before
 * the module initializer runs (e.g. during `sealOrphanedSessions` at startup).
 */
import { join } from 'node:path';
import { DATA_DIR, readJson, writeJson } from '@useai/shared';

type McpMap = Record<string, string>; // mcpSessionId → useaiSessionId

function mcpMapPath(): string {
  return join(DATA_DIR, 'mcp-map.json');
}

export function readMcpMap(): McpMap {
  return readJson<McpMap>(mcpMapPath(), {});
}

export function writeMcpMapping(mcpSessionId: string | null, useaiSessionId: string): void {
  if (!mcpSessionId) return;
  const map = readMcpMap();
  map[mcpSessionId] = useaiSessionId;
  writeJson(mcpMapPath(), map);
}

export function removeMcpMapping(mcpSessionId: string | null): void {
  if (!mcpSessionId) return;
  const map = readMcpMap();
  if (mcpSessionId in map) {
    delete map[mcpSessionId];
    writeJson(mcpMapPath(), map);
  }
}

/** Remove all MCP map entries pointing to the given UseAI session ID. */
export function removeMcpMappingByUseaiId(useaiSessionId: string): void {
  const map = readMcpMap();
  let changed = false;
  for (const [mcpId, sessionId] of Object.entries(map)) {
    if (sessionId === useaiSessionId) {
      delete map[mcpId];
      changed = true;
    }
  }
  if (changed) writeJson(mcpMapPath(), map);
}
