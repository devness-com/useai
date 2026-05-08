import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";

const START_MARKER = "<!-- useai:start -->";
const END_MARKER = "<!-- useai:end -->";

// Cursor rule files (.mdc) need YAML frontmatter to be auto-attached on every
// turn. Without `alwaysApply: true`, Cursor treats the rule as agent-decided
// and may skip it — meaning useai_start would not fire reliably.
const CURSOR_RULE_FRONTMATTER =
  "---\ndescription: useai session tracking rules\nalwaysApply: true\n---\n\n";

// VS Code Copilot custom-instruction files (*.instructions.md) use an
// `applyTo` glob in YAML frontmatter to decide when to attach. With no
// frontmatter the file is not auto-attached at all; `applyTo: '**'` makes the
// rule active for every chat regardless of what file is open. The `**` value
// is quoted because YAML treats it as a special token unquoted.
const VSCODE_INSTRUCTIONS_FRONTMATTER =
  "---\napplyTo: '**'\ndescription: useai session tracking rules\n---\n\n";

export const INSTRUCTIONS_TEXT = [
  "## UseAI Session Tracking",
  "",
  "### Rule 1 — useai_start (beginning of response)",
  "**BEFORE EVERY RESPONSE — answer this question first:**",
  '> "Does this turn contain any text written by the real human user?"',
  "> - YES → call `useai_start` as the VERY FIRST thing, before any tool call or text output.",
  "> - NO (only task-notifications, system reminders, plan approvals, hook feedback) → skip `useai_start`.",
  "",
  'This check must happen on EVERY turn, including short follow-up questions, one-liners, and any message that arrives after a task-notification or after a previous session was sealed. There is no "continuation" state — every real user message is a new session.',
  "",
  "**Common failure pattern to avoid:** task-notification turns interrupt the flow → next real user message arrives → `useai_start` gets skipped because it feels like a continuation. It is NOT a continuation. Call `useai_start`.",
  "",
  "  1. **Always call it** when the turn contains actual user-authored text, regardless of whether a previous session just ended.",
  "  2. **Never call it** on turns that contain only system reminders, hook feedback, plan approval clicks, or other automated/system-generated content.",
  "  3. **Interrupted/resumed prompt**: If `useai_start` was called but `useai_end` was never reached (prompt interrupted mid-response), call `useai_heartbeat` instead of `useai_start` to resume — do NOT open a new nested session. If the follow-up message is clearly a new unrelated task, call `useai_end` to close the previous session first, then call `useai_start` for the new one.",
  "  4. **Tool call blocked or rejected**: If the user denies/blocks a tool call and you continue the response, call `useai_heartbeat` immediately before proceeding — the rejection does not end the session, so the keep-alive must be sent manually.",
  "  5. Generate a short `title` (generic, no project names) and a detailed `private_title` from the user's prompt.",
  "  6. **task_type values**: coding, debugging, testing, planning, reviewing, documenting, learning, deployment, devops, research, migration, design, data, security, configuration, code_review, investigation, infrastructure, analysis, ops, setup, refactoring, other",
  "",
  "### Rule 2 — useai_heartbeat (mid-response keep-alive)",
  "  1. Call `useai_heartbeat` at the start of every response where you are **not** calling `useai_start` or `useai_end`.",
  "  2. **Exception**: if `useai_end` was already called and no new `useai_start` has been called since (no active session), skip `useai_heartbeat` entirely — this includes task-notification turns that arrive after a session is sealed.",
  '  3. **While actively working**: also call `useai_heartbeat` after every **10 tool calls** (Read/Grep/Bash/etc.) OR every **4 minutes** — whichever comes first. After every tool call batch, explicitly state your current count (e.g. "Tool count: 7/10") before proceeding — this prevents losing count during dense file-read loops. Reset count to 0 after each heartbeat. Gaps longer than 5 minutes are counted as idle time.',
  "",
  "### Rule 3 — useai_end (end of response)",
  "Call `useai_end` at the end of every response where `useai_start` was called. **Write all response text and summaries BEFORE calling `useai_end` — never write any text after the `useai_end` call. It must be the absolute last action in the response.** **Reserve your last 5 tool calls exclusively for this — once you reach that budget, stop all other work and call `useai_end` immediately.** Provide:",
  "  1. `languages` used, `files_touched_count`",
  "  2. `milestones`: array of objects each with `title` (generic — no project/file names), `category`, and optional `private_title` (detailed).",
  '     Example: `[{"title": "Implemented auth flow", "private_title": "Added OAuth2 to UserService in acme-api", "category": "feature"}]`',
  '     **Milestone quality**: only log milestones for actual deliverables — code shipped, bugs fixed, decisions made, or findings that change the plan. Do NOT log: investigations that confirm existing behavior (e.g. "verified X works correctly"), bug discoveries without a fix (identifying a bug is investigation, not a deliverable), or code reviews with no resulting changes. If a session was pure research/review with no actionable outcome, use an empty milestones array.',
  "  3. `evaluation` object: prompt_quality (1-5), context_provided (1-5), task_outcome, iteration_count, independence_level (1-5), scope_quality (1-5), tools_leveraged count. `iteration_count` tracks how many times the user has prompted for the same task — start at 1, and increment only when the user follows up or repeats a prompt on the same task. Reset to 1 when the user starts a new unrelated task. Include a `*_reason` for every scored field.",
  "  4. **calibrated framework**: provide `*_ideal` fields for every metric that is not 5/5 — this is mandatory, not optional. Only omit `*_ideal` when the score is exactly 5.",
  "- **Subagent tracking**: When spawning subagents, the agent prompt MUST include all of the following instructions explicitly:",
  "  1. Use `ToolSearch` to load the useai tools, then call `useai_start` **as the very first tool call** — before any Glob, Read, Grep, Bash, or other tool — **without** a `prompt_id` (each subagent gets its own independent session).",
  "  2. Note the `prompt_id` returned by `useai_start` and use that exact `prompt_id` for all subsequent `useai_heartbeat` and `useai_end` calls.",
  '  3. **Heartbeat rule (BOTH conditions apply — whichever triggers first)**: call `useai_heartbeat` after every **10 tool calls** (Read/Grep/Bash/etc.) OR every **4 minutes** — whichever comes first. After every tool call batch, explicitly state your current count (e.g. "Tool count: 7/10") before proceeding — this prevents losing count during dense file-read loops. Reset count to 0 after each heartbeat.',
  "  4. **Tool call blocked or rejected**: If a tool call is denied and the subagent continues, call `useai_heartbeat` immediately before proceeding.",
  "  5. **Interrupted/resumed**: If the subagent is interrupted mid-response and resumes on the same task, call `useai_heartbeat` at the top of the resumed response instead of `useai_start`. If the new task is unrelated, call `useai_end` to close the previous session first, then `useai_start` for the new one.",
  "  6. Do NOT pass the parent session's `prompt_id` to subagents — each subagent must have its own independent session to avoid tracking collisions.",
  "  7. **Reserve tool calls for useai_end**: Always reserve the last 5 tool calls exclusively for `useai_end`. Once you reach that budget, stop all other work and call `useai_end` immediately — never let context exhaustion prevent the session from being sealed.",
  "  8. **useai_end must be the last action**: Write all output and summaries BEFORE calling `useai_end`. Never write any text after the `useai_end` call — it must be the absolute last thing in the response.",
  "  9. **useai_end payload**: provide `languages`, `files_touched_count`, `milestones` (array with `title`, `category`, optional `private_title`), and `evaluation` (prompt_quality, context_provided, task_outcome, iteration_count, independence_level, scope_quality, tools_leveraged — `iteration_count` tracks how many times the user has prompted for the same task: start at 1, increment only on follow-ups for the same task, reset to 1 for new tasks. Include `*_reason` for every scored field).",
  "  10. **calibrated framework**: provide `*_ideal` fields for every metric that is not 5/5 — this is mandatory, not optional. Only omit `*_ideal` when the score is exactly 5.",
  "  11. **Milestone quality**: only log milestones for actual deliverables — code shipped, bugs fixed, decisions made, or findings that change the plan. Do NOT log: investigations that confirm existing behavior, bug discoveries without a fix, or code reviews with no resulting changes. If the session was pure research/review with no actionable outcome, use an empty milestones array.",
  "  - **Long-running commands**: If a command will run longer than 4 minutes (builds, test suites, deployments, sleeps), break it into ≤4-minute chunks and call `useai_heartbeat` between each chunk. Gaps over 5 minutes without a heartbeat are counted as idle time.",
].join("\n");

/**
 * Inject instructions into a file using marker blocks (append method)
 * or create a new file (create method).
 */
export function injectInstructions(
  filePath: string,
  method: "append" | "create",
): void {
  mkdirSync(dirname(filePath), { recursive: true });

  if (method === "create") {
    // Per-tool frontmatter: Cursor's .mdc and VS Code's *.instructions.md
    // both need YAML frontmatter to be applied on every turn. All other
    // create-method targets (Cline's useai.md, Roo's useai.md) are written
    // as plain markdown — those tools auto-load anything in their rules dir.
    let body: string;
    if (filePath.endsWith(".mdc")) {
      body = CURSOR_RULE_FRONTMATTER + INSTRUCTIONS_TEXT + "\n";
    } else if (filePath.endsWith(".instructions.md")) {
      body = VSCODE_INSTRUCTIONS_FRONTMATTER + INSTRUCTIONS_TEXT + "\n";
    } else {
      body = INSTRUCTIONS_TEXT + "\n";
    }
    writeFileSync(filePath, body, "utf-8");
    return;
  }

  // append: insert/update marker block in existing file
  const block = `${START_MARKER}\n${INSTRUCTIONS_TEXT}\n${END_MARKER}`;

  if (!existsSync(filePath)) {
    writeFileSync(filePath, block + "\n", "utf-8");
    return;
  }

  const existing = readFileSync(filePath, "utf-8");

  // Update existing block if present
  if (existing.includes(START_MARKER)) {
    const markerRegex = new RegExp(
      `${escapeRegex(START_MARKER)}[\\s\\S]*?${escapeRegex(END_MARKER)}`,
    );
    writeFileSync(filePath, existing.replace(markerRegex, block), "utf-8");
    return;
  }

  // Append new block
  const separator =
    existing && !existing.endsWith("\n") ? "\n\n" : existing ? "\n" : "";
  writeFileSync(filePath, existing + separator + block + "\n", "utf-8");
}

/**
 * Remove injected instructions from a file.
 */
export function removeInstructions(
  filePath: string,
  method: "append" | "create",
): void {
  if (!existsSync(filePath)) return;

  if (method === "create") {
    unlinkSync(filePath);
    return;
  }

  const existing = readFileSync(filePath, "utf-8");
  const markerRegex = new RegExp(
    `\\n?${escapeRegex(START_MARKER)}[\\s\\S]*?${escapeRegex(END_MARKER)}\\n?`,
  );
  const cleaned = existing.replace(markerRegex, "").trim();

  if (!cleaned) {
    unlinkSync(filePath);
  } else {
    writeFileSync(filePath, cleaned + "\n", "utf-8");
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
