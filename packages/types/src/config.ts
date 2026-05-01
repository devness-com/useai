import { z } from "zod";

const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string().nullable().optional(),
});

export const UseaiConfigSchema = z.object({
  version: z.number().default(3),

  auth: z
    .object({
      token: z.string().optional(),
      user: AuthUserSchema.optional(),
    })
    .default({}),

  evaluation: z
    .object({
      framework: z.string().default("calibrated"),
    })
    .default({}),

  capture: z
    .object({
      prompt: z.boolean().default(false),
      // e.g. [{ type: "image", description: "Screenshot of dashboard nav tabs" }]
      promptImages: z.boolean().default(false),
    })
    .default({}),

  sync: z
    .object({
      autoSync: z.boolean().default(false),
      intervalMinutes: z.number().default(30),

      // Sync anonymous aggregates (total hours, session counts, streaks, language breakdown)
      leaderboardStats: z.boolean().default(true),
      // Controls whether evaluation reason/ideal text is synced (scores are always synced)
      evaluationReasons: z.enum(["none", "belowPerfect", "all"]).default("none"),
    })
    .default({}),

  lastSyncAt: z.string().optional(),

  // The persisted port the daemon is bound to. Only present once the daemon
  // has actually bound a port — absent until then so the resolver knows there
  // is no preferred port yet and starts probing from 19200. See P2.1 of the
  // auto-update plan: this lets the daemon survive port collisions instead of
  // failing to start when 19200 is taken by another app.
  daemon: z
    .object({
      port: z.number().int().positive().optional(),
    })
    .default({}),
});

export type UseaiConfig = z.infer<typeof UseaiConfigSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
