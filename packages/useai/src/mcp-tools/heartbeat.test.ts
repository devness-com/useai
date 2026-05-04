import { beforeEach, describe, expect, it } from "vitest";
import { registerHeartbeatTool } from "./heartbeat.js";
import { createPromptContext } from "../core/prompt-context.js";
import {
  _resetActiveSessionsForTests,
  getActiveSessionCount,
  hasActiveSession,
  listActiveSessions,
  registerActiveSession,
} from "../daemon/core/active-sessions.js";

interface CapturedTool {
  name: string;
  schema: unknown;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function makeFakeServer(): {
  server: { registerTool: (n: string, s: unknown, h: unknown) => void };
  captured: CapturedTool | null;
} {
  let captured: CapturedTool | null = null;
  const server = {
    registerTool(name: string, schema: unknown, handler: unknown) {
      captured = {
        name,
        schema,
        handler: handler as CapturedTool["handler"],
      };
    },
  };
  return {
    server,
    get captured() {
      return captured;
    },
  } as unknown as {
    server: { registerTool: (n: string, s: unknown, h: unknown) => void };
    captured: CapturedTool | null;
  };
}

describe("useai_heartbeat", () => {
  beforeEach(() => {
    _resetActiveSessionsForTests();
  });

  it("touches lastActivityAt when the session is still in the store", async () => {
    const ctx = createPromptContext();
    ctx.startedAt = new Date(Date.now() - 60_000);
    ctx.client = "claude-code";
    ctx.connectionId = "conn_a";

    registerActiveSession({
      promptId: ctx.promptId,
      connectionId: ctx.connectionId,
      client: ctx.client,
      project: null,
      title: null,
      startedAt: ctx.startedAt.getTime(),
      parentPromptId: null,
      sessionDepth: 0,
    });

    const before = listActiveSessions()[0]!.lastActivityAt;
    // Force a small wait so lastActivityAt has somewhere to advance to.
    await new Promise((r) => setTimeout(r, 5));

    const fake = makeFakeServer();
    registerHeartbeatTool(fake.server as never, ctx);
    await fake.captured!.handler({ prompt_id: ctx.promptId });

    expect(getActiveSessionCount()).toBe(1);
    const after = listActiveSessions()[0]!.lastActivityAt;
    expect(after).toBeGreaterThan(before);
  });

  it("re-registers a session that was evicted by the sweeper", async () => {
    const ctx = createPromptContext();
    ctx.startedAt = new Date(Date.now() - 60_000);
    ctx.client = "claude-code";
    ctx.connectionId = "conn_a";
    ctx.project = "useai";
    ctx.title = "Resume me";

    // Simulate prior eviction: PromptContext alive, store empty.
    expect(hasActiveSession(ctx.promptId)).toBe(false);

    const fake = makeFakeServer();
    registerHeartbeatTool(fake.server as never, ctx);
    await fake.captured!.handler({ prompt_id: ctx.promptId });

    expect(hasActiveSession(ctx.promptId)).toBe(true);
    const record = listActiveSessions()[0]!;
    expect(record.promptId).toBe(ctx.promptId);
    expect(record.connectionId).toBe("conn_a");
    expect(record.project).toBe("useai");
    expect(record.title).toBe("Resume me");
    expect(record.startedAt).toBe(ctx.startedAt.getTime());
    expect(record.parentPromptId).toBeNull();
    expect(record.sessionDepth).toBe(0);
  });

  it("returns 'no active session' when the PromptContext was never started", async () => {
    const ctx = createPromptContext();
    // Intentionally do not set startedAt
    const fake = makeFakeServer();
    registerHeartbeatTool(fake.server as never, ctx);
    const result = (await fake.captured!.handler({
      prompt_id: ctx.promptId,
    })) as { content: Array<{ text: string }> };
    expect(result.content[0]!.text).toMatch(/No active session/);
    // And nothing got re-registered.
    expect(getActiveSessionCount()).toBe(0);
  });
});
