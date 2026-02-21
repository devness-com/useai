# UseAI Dashboard v2 — Design Document

> From time tracker to AI proficiency coach.

## Problem Statement

The current dashboard answers **"when and how long did I use AI?"** — essentially a time logger. Developers won't return daily for a time log. They'll return for **insights** about their AI usage effectiveness and growth over time.

## Vision

Reframe UseAI from **activity tracking** to **AI proficiency coaching**. Help developers understand not just how much AI they use, but how *well* they use it — and how they're improving.

**Current story:** "You used AI for 1.4 hours across 21 sessions"
**Target story:** "You shipped 2 features and fixed 1 bug today. Your prompting efficiency improved 23% this month. Claude Code is your most productive tool."

---

## Part 1: Current State

### What's displayed

| Component | Data shown |
|---|---|
| **StatsBar** (4 cards) | Total hours, session count, streak, files touched |
| **TimeScrubber** | Timeline with session blocks + milestone dots |
| **SummaryChips** | Top 4 clients, top 4 languages |
| **FilterChips** | Filter by client, language, project, milestone category |
| **SessionList** → **SessionCard** | Session title (fallback logic), duration, start time, primary language, expandable milestones |
| **ActivityStrip** | 7-day bar chart or 24-hour hourly bars |
| **SyncFooter** | Auth status, last sync time |

### What's tracked but NOT displayed

| Data | Where it exists | Status |
|---|---|---|
| `task_type` (coding/debugging/testing/planning/...) | `SessionSeal.task_type` | Only in tooltips for untitled sessions |
| `complexity` (simple/medium/complex) | `Milestone.complexity` | Only in timeline tooltip, not in cards |
| `heartbeat_count` | `SessionSeal.heartbeat_count` | Not shown at all |
| `project` per milestone | `Milestone.project` | Not shown per milestone |
| Milestone `languages` | `Milestone.languages` | Not shown separately from session |
| `published` / `published_at` | `Milestone.published` | No publication status UI |
| Chain integrity hashes | `SessionSeal.chain_*_hash` | Not shown |
| `username` | `LocalConfig.username` | Only email shown |
| `auto_sync` | `LocalConfig.auto_sync` | No toggle UI |

---

## Part 2: `useai_start` Enhancement

### Current tool signature

```typescript
useai_start(task_type?: string)
```

Only captures what *kind* of work. No session title, no prompt data.

### Proposed tool signature

```typescript
useai_start(
  task_type?: 'coding' | 'debugging' | 'testing' | 'planning' | 'reviewing' | 'documenting' | 'learning' | 'other',
  title?: string,          // Public session title (generic, no project names)
  private_title?: string,  // Detailed session title (can include specifics)
  prompt?: string,         // Raw user prompt text
)
```

### New fields explained

| Field | Example | Stored where | Synced to server? |
|---|---|---|---|
| `title` | "Fixed authentication bug" | `SessionSeal` + chain record | Yes (public, generic) |
| `private_title` | "Fixed JWT refresh in login.ts" | `SessionSeal` + chain record | Yes (private, user-only on web) |
| `prompt` | "The login is broken when..." | Chain record ONLY | **No** — never leaves local machine |

### Derived fields (computed in handler, not passed by AI)

| Field | Derivation | Stored where | Synced? |
|---|---|---|---|
| `prompt_length` | `prompt.length` | Chain record only | No |
| `prompt_word_count` | `prompt.split(/\s+/).length` | Chain record only | No |

### Implementation: `SessionSeal` type change

```typescript
// packages/shared/src/types/chain.ts
export interface SessionSeal {
  session_id: string;
  client: string;
  task_type: string;
  languages: string[];
  files_touched: number;
  project?: string;
  title?: string;           // NEW
  private_title?: string;   // NEW
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  heartbeat_count: number;
  record_count: number;
  chain_start_hash: string;
  chain_end_hash: string;
  seal_signature: string;
}
```

### Implementation: `SessionState` changes

```typescript
// packages/mcp/src/session-state.ts — new fields
sessionTitle: string | null;
sessionPrivateTitle: string | null;

// In reset():
this.sessionTitle = null;
this.sessionPrivateTitle = null;

// New setters:
setTitle(title: string | null): void { this.sessionTitle = title; }
setPrivateTitle(title: string | null): void { this.sessionPrivateTitle = title; }
```

### Implementation: `useai_start` handler changes

```typescript
// In register-tools.ts — useai_start handler
async ({ task_type, title, private_title, prompt }) => {
  session.reset();
  resolveClient(server, session);
  session.setTaskType(task_type ?? 'coding');
  session.setTitle(title ?? null);
  session.setPrivateTitle(private_title ?? null);

  const chainData: Record<string, unknown> = {
    client: session.clientName,
    task_type: session.sessionTaskType,
    project: session.project,
    version: VERSION,
  };

  // Title goes in chain AND will go in SessionSeal later
  if (title) chainData.title = title;
  if (private_title) chainData.private_title = private_title;

  // Prompt + derived metrics go in chain ONLY (never in SessionSeal/index)
  if (prompt) {
    chainData.prompt = prompt;
    chainData.prompt_length = prompt.length;
    chainData.prompt_word_count = prompt.split(/\s+/).filter(Boolean).length;
  }

  session.appendToChain('session_start', chainData);

  return { content: [{ type: 'text', text: `useai session started — ...` }] };
};
```

### Implementation: `useai_end` handler changes

Add `title` and `private_title` to the `SessionSeal` object that gets written to `sessions.json`:

```typescript
const seal: SessionSeal = {
  // ...existing fields...
  title: session.sessionTitle ?? undefined,
  private_title: session.sessionPrivateTitle ?? undefined,
};
```

### Tool description update

```
'Start tracking an AI coding session. Call this at the beginning of every response.
Generate a session title from the user\'s prompt: a generic public "title" (no project/file names)
and an optional detailed "private_title" (can include specifics).
Also pass the user\'s raw prompt text in the "prompt" field.'
```

---

## Part 3: Prompt Data — Privacy Architecture (Option C)

### Design decision

Prompts are stored **locally only**. Derived numeric metrics may sync to the server. Raw prompt text **never** leaves the user's machine.

### Data flow

```
User types prompt
    |
    v
AI calls useai_start(title, private_title, prompt)
    |
    v
Chain record (local ~/.useai/data/active/{id}.jsonl)
  - title              → also stored in SessionSeal (synced)
  - private_title      → also stored in SessionSeal (synced, private)
  - prompt             → chain ONLY (never synced)
  - prompt_length      → chain ONLY (never synced)
  - prompt_word_count  → chain ONLY (never synced)
    |
    v
useai_end → SessionSeal written to sessions.json
  - title, private_title included (for dashboard display)
  - prompt NOT included (stays in chain file)
    |
    v
Sync to api.useai.dev
  - SessionSeal: title, private_title, all existing fields
  - prompt: NEVER sent
```

### Why no encryption for local prompts

- Prompts live in `~/.useai/data/sealed/{id}.jsonl` — same machine the user typed them on
- If an attacker has access to `~/.useai/`, they already have terminal history, shell history, and AI tool logs
- Encryption adds complexity (key management, decryption on read) with no real security gain for local-only data
- Chain signing already provides integrity verification

### Where analytics run

| Insight | Computed where | Data needed |
|---|---|---|
| Efficiency score (milestones/session) | Server | Session count + milestone count (already synced) |
| One-shot success rate | Server | Sessions with milestone on first try |
| Time-to-solve by complexity | Server | Duration + complexity (already synced) |
| Tool effectiveness comparison | Server | Milestones per client (already synced) |
| Prompt length trend | Server | `prompt_word_count` — **add to SessionSeal** |
| Prompt content analysis | **Local only** | Raw prompt text from chain files |
| Prompt pattern recognition | **Local only** | Raw prompt text from chain files |

**Revised decision:** Add `prompt_word_count` to `SessionSeal` (it's a single number, no privacy concern). This enables server-side trend analysis of prompt conciseness without exposing content.

Updated `SessionSeal`:
```typescript
export interface SessionSeal {
  // ...existing fields...
  title?: string;
  private_title?: string;
  prompt_word_count?: number;  // Numeric only — safe to sync
}
```

---

## Part 4: Dashboard Improvements

### Priority 1 — Achievement-focused stats (replace current StatsBar)

**Current:** Total Time | Sessions | Streak | Files

**Proposed 6 cards (pick best 4-5):**

| Stat | Source | Why it matters |
|---|---|---|
| Features Shipped | Count milestones where `category=feature` | Value delivered |
| Bugs Fixed | Count milestones where `category=bugfix` | Value delivered |
| Complex Problems Solved | Count milestones where `complexity=complex` | Growth signal |
| Active Coding Hours | Sum of `duration_seconds` | Keep — familiar metric |
| Streak | Consecutive active days | Keep — motivational |
| Files Touched | Sum of `files_touched` | Make secondary or remove |

### Priority 2 — Task type breakdown

A donut or horizontal bar chart showing time distribution:
- Coding (building new things)
- Debugging (fixing issues)
- Testing (writing/fixing tests)
- Planning (architecture, design)
- Reviewing (code review)
- Documenting

**Data source:** `SessionSeal.task_type` — already tracked, already aggregated in `handleLocalStats` (`byTaskType`), just not displayed.

**Developer insight:** "Am I spending too much time debugging? Am I underinvesting in tests?"

### Priority 3 — Daily recap card

A natural-language summary at the top of the dashboard:

> **Today**: 3 sessions, 1.4 hrs — shipped 2 features (1 complex), fixed 1 bug.
> Most active: 7-9 PM. Primary: TypeScript with Claude Code.

Computed from the same data already loaded. Glanceable value that makes someone open the dashboard daily.

### Priority 4 — Complexity distribution

Visual showing the mix of simple/medium/complex milestones:

```
Simple  ████████░░  62%
Medium  ████░░░░░░  28%
Complex █░░░░░░░░░  10%
```

With week-over-week comparison. Developers want to see they're tackling harder problems over time.

**Data source:** `Milestone.complexity` — tracked, barely displayed (tooltip only).

### Priority 5 — Milestones as first-class content

Currently milestones are buried inside expandable session cards. Elevate them:

- **Recent Achievements section**: Last 5-10 milestones with category badge, complexity indicator, project name, timestamp
- **Weekly milestone summary**: "This week: 3 features, 2 bugfixes, 1 refactor"
- Keep them in session cards too, but give them their own spotlight

### Priority 6 — Weekly/monthly time scales

Current scales: 15m, 30m, 1h, 12h, 24h — all short-term.

Add:
- **7D** (7-day window): daily aggregation, shows weekly rhythm
- **30D** (30-day window): daily aggregation, shows monthly trends

These enable trend lines for:
- Hours per day
- Milestones per day/week
- Complexity trend
- Prompt conciseness trend (when prompt data is available)

### Priority 7 — Project-level breakdown

Pie chart or bar showing time per project. Valuable for:
- Freelancers tracking time across clients
- Developers balancing multiple repos
- Understanding which projects get most AI assistance

**Data source:** `SessionSeal.project` — already tracked, filtered in `FilterChips` but not visualized.

### Priority 8 — AI client comparison

Show across Claude Code, Gemini, Cursor, Copilot, etc.:
- Time distribution
- Milestones achieved per client
- Average session length

**Developer insight:** "Which AI am I most productive with?"

**Data source:** `SessionSeal.client` — already tracked, shown in `SummaryChips` but not analytically.

### Priority 9 — Engagement score (from heartbeats)

`heartbeat_count` is a proxy for active engagement. A 2-hour session with 8 heartbeats was actively coding; 1 heartbeat means lots of idle time.

- **Focus Score**: `heartbeat_count / expected_heartbeats` (where expected = duration / 900 for 15-min intervals)
- Highlight "deep work" sessions vs fragmented ones

**Data source:** `SessionSeal.heartbeat_count` — tracked, never displayed.

---

## Part 5: Future — AI Proficiency Intelligence

With prompt data captured over time, these metrics become possible:

### Prompts-per-milestone ratio
Count `useai_start` calls per milestone achieved. Lower = more efficient prompting. Track week-over-week.

### One-shot success rate
Percentage of sessions that achieve a milestone without additional sessions on the same topic. Trending up = better prompting.

### Prompt conciseness trend
Average `prompt_word_count` over time. Are developers learning to be precise?

### Time-to-solve by complexity
Average duration: Simple tasks (X min) → Medium (Y min) → Complex (Z min). With comparison to previous periods.

### Tool effectiveness
"With Claude Code, you average 1.8 sessions per feature. With Copilot, 3.2." Data-driven tool selection.

### Prompting pattern recognition (local-only)
Analyze successful one-shot prompts vs multi-turn struggles. Surface patterns:
> "Your most efficient sessions start with specific file references and clear acceptance criteria."

This requires reading chain files locally — never sent to server.

---

## Part 6: Implementation Plan

### Phase 1 — `useai_start` enhancement
1. Update `SessionSeal` type in `packages/shared/src/types/chain.ts` — add `title`, `private_title`, `prompt_word_count`
2. Update `SessionState` in `packages/mcp/src/session-state.ts` — add title fields + setters
3. Update `useai_start` tool in `packages/mcp/src/register-tools.ts` — add new params, store prompt in chain, titles in state
4. Update `useai_end` handler — include title/private_title/prompt_word_count in SessionSeal
5. Update tool description to instruct AI to generate titles and pass prompts
6. Update `packages/mcp/src/tools.ts` (tool instructions) if title guidance is needed there
7. Update tests

### Phase 2 — Dashboard stat cards
1. Update `StatsBar` — replace/add achievement-focused cards (features shipped, bugs fixed, complex solved)
2. Add task type breakdown component (donut/bar chart)
3. Add daily recap card at top of dashboard
4. Surface complexity in session cards (not just tooltips)

### Phase 3 — Dashboard analytics
1. Add weekly/monthly time scales to TimeScrubber
2. Add project breakdown visualization
3. Add AI client comparison view
4. Add milestones section (not just embedded in cards)
5. Add engagement/focus score from heartbeats

### Phase 4 — Prompt intelligence (future)
1. Add local API endpoint to read chain files for prompt data
2. Build efficiency metrics (prompts-per-milestone, one-shot rate)
3. Build trend visualizations (conciseness, time-to-solve)
4. Build prompt pattern analysis (local computation only)

### Phase 5 — Server-side sync updates
1. Update `POST /api/sync` to accept new `SessionSeal` fields (`title`, `private_title`, `prompt_word_count`)
2. Update web profile to show session titles
3. Build server-side efficiency metrics from synced numeric data
4. Add prompt conciseness trend to web dashboard

---

## Files to modify

### Phase 1 (core)
- `packages/shared/src/types/chain.ts` — SessionSeal type
- `packages/mcp/src/session-state.ts` — new fields, setters, reset()
- `packages/mcp/src/register-tools.ts` — useai_start params + handler, useai_end seal creation
- `packages/mcp/src/tools.ts` — tool description/instructions update
- `packages/mcp/src/register-tools.test.ts` — test updates
- `packages/mcp/src/session-state.test.ts` — test updates

### Phase 2 (dashboard)
- `packages/dashboard/src/components/StatsBar.tsx`
- `packages/dashboard/src/components/SessionCard.tsx` — use `seal.title` / `seal.private_title`
- `packages/dashboard/src/App.tsx` — new components, data flow
- New: task type chart component
- New: daily recap component

### Phase 3+ (later)
- `packages/dashboard/src/components/TimeTravel/TimeScrubber.tsx` — weekly/monthly scales
- `packages/mcp/src/dashboard/local-api.ts` — new analytics endpoints
- `packages/api/` — server-side sync schema updates
