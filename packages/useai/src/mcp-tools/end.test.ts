import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import type { Session } from "@devness/useai-types";

/**
 * Seal payload shape contract for useai_end.
 *
 * The seal-build logic is inline inside registerEndTool's handler — there is
 * no extracted pure helper to test in isolation (this entanglement is noted
 * in the report). Instead we mock @devness/useai-storage to capture the
 * Session object actually written by appendSession, then drive the handler
 * via a fake McpServer that captures the registered tool callback.
 *
 * What this guards:
 * - All required Session fields present
 * - Optional fields (privateTitle, project, model, prompt, etc.) are absent
 *   when the corresponding PromptContext field is null/empty — NOT present
 *   with `undefined` values
 * - Snake_case is preserved on `evaluation` (cloud expects prompt_quality,
 *   not promptQuality) — this is a high-risk regression because the rest of
 *   the codebase uses camelCase
 */

// Generate a keypair for the fake keystore and capture appended sessions.
const fixture = vi.hoisted(() => {
  return {
    privateKeyDer: null as Buffer | null,
    appended: [] as Session[],
  };
});

vi.mock("@devness/useai-storage", () => {
  return {
    appendSession: vi.fn(async (s: Session) => {
      fixture.appended.push(s);
    }),
    getOrCreateKeystore: vi.fn(async () => ({
      keystore: {} as unknown,
      privateKey: fixture.privateKeyDer,
    })),
    getConfig: vi.fn(async () => ({
      auth: { token: null },
    })),
  };
});

// Block the cloud verifySeal fetch — return null so no sealVerification field
// is added. (We need this so we can assert the field is *absent*.)
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn(async () => {
    throw new Error("fetch blocked in test");
  }) as unknown as typeof fetch;
});

import { registerEndTool } from "./end.js";
import { createPromptContext } from "../core/prompt-context.js";

interface CapturedTool {
  name: string;
  schema: unknown;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function makeFakeServer(): {
  server: { registerTool: (n: string, s: unknown, h: any) => void };
  captured: CapturedTool | null;
} {
  let captured: CapturedTool | null = null;
  const server = {
    registerTool(name: string, schema: unknown, handler: any) {
      captured = { name, schema, handler };
    },
  };
  return {
    server,
    get captured() {
      return captured;
    },
  } as any;
}

describe("useai_end seal payload shape contract", () => {
  beforeEach(() => {
    fixture.appended = [];
    const kp = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" },
    });
    fixture.privateKeyDer = kp.privateKey as unknown as Buffer;
  });

  it("required fields present + optional fields ABSENT when unset", async () => {
    const ctx = createPromptContext();
    ctx.startedAt = new Date(Date.now() - 5_000);
    ctx.client = "claude-code";
    ctx.taskType = "coding";
    ctx.title = "Test session title";
    // Intentionally leave privateTitle, project, model, prompt as null

    const fake = makeFakeServer();
    registerEndTool(fake.server as any, ctx);
    expect(fake.captured).not.toBeNull();

    const result = (await fake.captured!.handler({
      prompt_id: ctx.promptId,
      task_type: "coding",
    })) as { content: Array<{ text: string }> };

    // Tool returned text content (success path)
    expect(result.content[0]!.text).toMatch(/sealed/);

    // The session object passed to appendSession is what gets stored
    expect(fixture.appended).toHaveLength(1);
    const sealed = fixture.appended[0]!;

    // ---- Required fields ----
    expect(sealed.promptId).toBe(ctx.promptId);
    expect(sealed.client).toBe("claude-code");
    expect(sealed.taskType).toBe("coding");
    expect(sealed.title).toBe("Test session title");
    expect(typeof sealed.startedAt).toBe("string");
    expect(typeof sealed.endedAt).toBe("string");
    expect(typeof sealed.durationMs).toBe("number");
    expect(typeof sealed.hash).toBe("string");
    expect(sealed.hash).toHaveLength(64);
    expect(typeof sealed.signature).toBe("string");
    expect(typeof sealed.prevHash).toBe("string");
    expect(sealed.prevHash).toHaveLength(64);
    expect(Array.isArray(sealed.milestones)).toBe(true);

    // connectionId is empty string in this test (never set), but it MUST be a string
    expect(typeof sealed.connectionId).toBe("string");

    // ---- Optional fields absent (the key shouldn't exist when source was nullish) ----
    expect("privateTitle" in sealed).toBe(false);
    expect("project" in sealed).toBe(false);
    expect("model" in sealed).toBe(false);
    expect("prompt" in sealed).toBe(false);
    expect("promptImages" in sealed).toBe(false);
    expect("promptImageCount" in sealed).toBe(false);
    expect("filesTouchedCount" in sealed).toBe(false);
    expect("evaluation" in sealed).toBe(false);
    expect("sealVerification" in sealed).toBe(false);

    // No accidental `undefined` value entries (JSON.stringify drops them, but
    // they shouldn't be there in the first place).
    for (const [k, v] of Object.entries(sealed)) {
      expect(
        v,
        `field "${k}" should not be undefined on sealed payload`,
      ).not.toBe(undefined);
    }
  });

  it("evaluation field preserves snake_case (cloud contract)", async () => {
    const ctx = createPromptContext();
    ctx.startedAt = new Date(Date.now() - 5_000);
    ctx.client = "claude-code";
    ctx.taskType = "coding";
    ctx.title = "snake-case eval";

    const fake = makeFakeServer();
    registerEndTool(fake.server as any, ctx);

    const evaluation = {
      prompt_quality: 4,
      prompt_quality_reason: "good",
      context_provided: 3,
      context_provided_reason: "ok",
      task_outcome: "completed",
      iteration_count: 1,
      independence_level: 5,
      scope_quality: 4,
      tools_leveraged: 12,
    };

    await fake.captured!.handler({
      prompt_id: ctx.promptId,
      evaluation,
    });

    expect(fixture.appended).toHaveLength(1);
    const sealed = fixture.appended[0]!;
    expect(sealed.evaluation).toBeDefined();
    const ev = sealed.evaluation as unknown as Record<string, unknown>;

    // Cloud expects snake_case. If anyone "helpfully" camelCases this, this fails.
    expect(ev["prompt_quality"]).toBe(4);
    expect(ev["context_provided"]).toBe(3);
    expect(ev["task_outcome"]).toBe("completed");
    expect(ev["iteration_count"]).toBe(1);
    expect(ev["independence_level"]).toBe(5);
    expect(ev["scope_quality"]).toBe(4);
    expect(ev["tools_leveraged"]).toBe(12);

    // And the camelCase forms must NOT appear (regression guard)
    expect("promptQuality" in ev).toBe(false);
    expect("contextProvided" in ev).toBe(false);
    expect("taskOutcome" in ev).toBe(false);
  });

  it("optional fields are present when their PromptContext source is set", async () => {
    const ctx = createPromptContext();
    ctx.startedAt = new Date(Date.now() - 5_000);
    ctx.client = "claude-code";
    ctx.taskType = "coding";
    ctx.title = "with-optionals";
    ctx.privateTitle = "Detailed private title";
    ctx.project = "useai-oss";
    ctx.model = "claude-opus-4-7";
    ctx.prompt = "the user prompt";

    const fake = makeFakeServer();
    registerEndTool(fake.server as any, ctx);

    await fake.captured!.handler({
      prompt_id: ctx.promptId,
      files_touched_count: 7,
    });

    expect(fixture.appended).toHaveLength(1);
    const sealed = fixture.appended[0]!;
    expect(sealed.privateTitle).toBe("Detailed private title");
    expect(sealed.project).toBe("useai-oss");
    expect(sealed.model).toBe("claude-opus-4-7");
    expect(sealed.prompt).toBe("the user prompt");
    expect(sealed.filesTouchedCount).toBe(7);
  });
});

// Restore real fetch on suite teardown.
afterAll(() => {
  globalThis.fetch = originalFetch;
});
