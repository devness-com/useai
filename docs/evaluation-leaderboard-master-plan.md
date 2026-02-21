# UseAI Evaluation & Global Leaderboard — Master Plan

> From time tracker → proficiency coach → **global AI proficiency platform**

---

## 1. Market Analysis — What Exists Today

### Comparable Platforms

| Platform | What it measures | Leaderboard | Individual-facing | AI-specific |
|----------|-----------------|-------------|-------------------|-------------|
| **WakaTime** | Coding time by language/project/editor | Yes — hours coded per 7 days | Yes | No |
| **GitHub Copilot Metrics** | Acceptance rate, DAU, LoC suggested/accepted | No (enterprise dashboard) | No (org-level) | Yes, but acceptance-only |
| **Faros AI** | DORA, SPACE, DevEx, AI adoption | No | No (team/org) | Partially |
| **TechBlitz** | Challenge scores, badges | Yes — challenge-based | Yes | No |
| **CodinGame** | Puzzle/game scores | Yes — game-based | Yes | No |
| **DX (getdx.com)** | Developer experience surveys + metrics | No | No (team-level) | Partially |

### The Gap UseAI Fills

**Nobody measures how well a developer uses AI tools in real work.** Every platform either:
- Measures the AI tool's quality (model benchmarks, acceptance rates) — not the human
- Measures raw coding time (WakaTime) — doesn't distinguish AI-assisted from manual
- Targets enterprises (Faros, Copilot Metrics) — not individual developers
- Uses synthetic challenges (TechBlitz, CodinGame) — not real-world work

**UseAI's unique position:** The only platform that evaluates the **developer's AI proficiency** — how effectively they leverage AI tools to ship real work, measured from actual sessions, not synthetic tests.

---

## 2. Core Insight — Evaluate at Session End

### The Paradigm

Just like the AI already extracts milestones at `useai_end` time, it can extract **evaluation metrics**. The AI has full session context — it observed the entire interaction and can assess:

- How well the user communicated their intent
- How efficiently the task was completed
- Whether the outcome was successful
- How much guidance the user needed vs. how self-directed they were

### Why NOT Store Prompts

| Approach | Pros | Cons |
|----------|------|------|
| Store raw prompts | Full replay, can re-analyze later | Heavy storage, privacy risk, 80% of value is extractable without raw text |
| **Store evaluation scores** | Lightweight, privacy-safe, syncable, immediately actionable | Can't re-analyze from scratch |

The title already captures the essence. The evaluation scores capture the quality signal. Together they give ~95% of the insight value at ~5% of the storage cost.

---

## 3. Evaluation Metrics — What the AI Extracts at `useai_end`

### 3A. Session Evaluation (new `evaluation` field)

These are scored by the AI at session end, just like milestones. All numeric — safe to sync.

| Metric | Type | Scale | What it measures |
|--------|------|-------|-----------------|
| `prompt_quality` | int | 1-5 | Clarity, specificity, and completeness of the initial request |
| `context_provided` | int | 1-5 | Did the user provide files, errors, constraints, acceptance criteria? |
| `task_outcome` | enum | `completed` / `partial` / `abandoned` / `blocked` | Was the primary goal achieved? |
| `iteration_count` | int | 1-N | How many user↔AI turns were needed to reach outcome |
| `independence_level` | int | 1-5 | How self-directed was the user? (5 = gave clear spec, let AI work; 1 = needed constant guidance) |
| `scope_quality` | int | 1-5 | Was the task well-scoped? (5 = precise and achievable; 1 = vague or impossibly broad) |
| `tools_leveraged` | int | 0-N | Count of distinct AI capabilities used (code gen, debugging, refactoring, testing, docs, etc.) |

### 3B. Derived Session Metrics (computed from existing data)

| Metric | Formula | What it reveals |
|--------|---------|----------------|
| `output_density` | `files_touched / (duration_minutes)` | Work output rate |
| `milestone_velocity` | `milestone_count / (duration_hours)` | Achievement rate |
| `focus_score` | `heartbeat_count / floor(duration_seconds / 900)` | Active engagement vs idle |
| `complexity_weight` | `sum(complexity_points)` where simple=1, medium=2, complex=4 | Weighted difficulty of work |
| `efficiency_score` | `complexity_weight / duration_hours` | Difficulty-adjusted output rate |

### 3C. Why These Specific Metrics

Each metric maps to a real AI proficiency skill:

| Skill | Metric(s) | Why it matters |
|-------|-----------|---------------|
| **Clear communication** | `prompt_quality`, `context_provided` | The #1 differentiator between effective and ineffective AI users |
| **Task decomposition** | `scope_quality`, `iteration_count` | Breaking big problems into AI-solvable pieces |
| **Tool mastery** | `tools_leveraged`, client diversity | Using the right AI tool for the right task |
| **Output quality** | `task_outcome`, `complexity_weight` | Actually shipping, not just chatting |
| **Efficiency** | `efficiency_score`, `milestone_velocity` | Getting more done per hour of AI time |
| **Consistency** | Streak, daily hours, session frequency | Building AI-assisted development as a habit |

---

## 4. Implementation — `useai_end` Changes

### 4A. New `evaluation` Parameter

```typescript
server.tool('useai_end', '...', {
  // ...existing params (task_type, languages, files_touched_count, milestones)...

  evaluation: z.object({
    prompt_quality: z.number().min(1).max(5)
      .describe('How clear, specific, and complete was the initial prompt? 1=vague/ambiguous, 5=crystal clear with acceptance criteria'),
    context_provided: z.number().min(1).max(5)
      .describe('Did the user provide relevant context (files, errors, constraints)? 1=no context, 5=comprehensive context'),
    task_outcome: z.enum(['completed', 'partial', 'abandoned', 'blocked'])
      .describe('Was the primary task achieved?'),
    iteration_count: z.number().min(1)
      .describe('Number of user↔AI turns in this session'),
    independence_level: z.number().min(1).max(5)
      .describe('How self-directed was the user? 1=needed constant guidance, 5=gave clear spec and let AI execute'),
    scope_quality: z.number().min(1).max(5)
      .describe('Was the task well-scoped? 1=vague or impossibly broad, 5=precise and achievable'),
    tools_leveraged: z.number().min(0)
      .describe('Count of distinct AI capabilities used (code gen, debugging, refactoring, testing, docs, etc.)'),
  }).optional()
    .describe('AI-assessed evaluation of this session. Score honestly based on the actual interaction.'),
});
```

### 4B. Where Evaluation Data Lives

```
useai_end called
    |
    v
Chain record: session_end
  - evaluation: { prompt_quality: 4, context_provided: 5, ... }  (full detail, local)
    |
    v
SessionSeal → sessions.json
  - evaluation: { prompt_quality: 4, context_provided: 5, ... }  (synced — all numeric, no privacy risk)
    |
    v
Sync → api.useai.dev
  - All evaluation scores synced (they're just numbers 1-5)
```

### 4C. Updated `SessionSeal` Type

```typescript
export interface SessionEvaluation {
  prompt_quality: number;       // 1-5
  context_provided: number;     // 1-5
  task_outcome: 'completed' | 'partial' | 'abandoned' | 'blocked';
  iteration_count: number;
  independence_level: number;   // 1-5
  scope_quality: number;        // 1-5
  tools_leveraged: number;
}

export interface SessionSeal {
  // ...existing fields...
  title?: string;
  private_title?: string;
  prompt_word_count?: number;
  evaluation?: SessionEvaluation;   // NEW
}
```

### 4D. Tool Instructions Update

```
## UseAI Session Tracking
- At the START of every response, call `useai_start` with the appropriate task_type.
  Generate a short session `title` (generic, no project names) and `private_title`
  (detailed, can include specifics) from the user's prompt.
- For LONG sessions (15+ min), call `useai_heartbeat` periodically.
- At the END of every response, call `useai_end` with:
  - languages used, files_touched_count
  - milestones (generic descriptions only)
  - evaluation: honestly assess prompt_quality (1-5), context_provided (1-5),
    task_outcome, iteration_count, independence_level (1-5), scope_quality (1-5),
    and tools_leveraged count
```

---

## 5. Prompt Storage Decision — Drop It

### What changes from earlier design

| Earlier (Option C) | Now |
|---------------------|-----|
| Store raw prompt in chain file | **Don't capture prompt at all** |
| `prompt` param in `useai_start` | Remove `prompt` param |
| `prompt_word_count` derived from prompt | AI estimates `iteration_count` at end instead |
| Local-only prompt analytics (future) | Evaluation scores replace this entirely |

### What to keep from `useai_start`

```typescript
useai_start({
  task_type,       // keep
  title,           // keep — public session title
  private_title,   // keep — detailed session title
  // prompt         // REMOVE — no longer captured
})
```

`prompt_word_count` stays in `SessionSeal` for now (it's already shipped) but becomes optional/deprecated. The AI can still estimate it from context if desired, but it's not a primary metric anymore.

---

## 6. Global Leaderboard — UseAI.dev

### 6A. Leaderboard Philosophy

WakaTime's leaderboard ranks by **hours coded** — a pure volume metric. A developer who leaves their editor open all day ranks higher than one who ships a feature in 30 minutes.

**UseAI's leaderboard ranks by AI proficiency** — a composite of volume, quality, efficiency, and consistency. The developer who ships complex features with clear prompts in fewer iterations ranks higher.

### 6B. The AI Proficiency Score (APS)

A single composite score (0-1000) computed from aggregated metrics over a rolling window (7 days default, 30 days for trends).

#### Score Components

| Component | Weight | Source | What it rewards |
|-----------|--------|--------|-----------------|
| **Output** | 25% | `complexity_weight` total | Shipping real work (weighted by difficulty) |
| **Efficiency** | 25% | `efficiency_score` avg | High output relative to time spent |
| **Prompt Quality** | 20% | `prompt_quality` + `context_provided` + `scope_quality` avg | Clear, well-structured communication with AI |
| **Consistency** | 15% | Active days, streak, session frequency | Regular AI-assisted development habit |
| **Breadth** | 15% | Languages, clients, `tools_leveraged` | Versatility across tools and domains |

#### Score Formula (simplified)

```
APS = (
  Output_normalized × 0.25 +
  Efficiency_normalized × 0.25 +
  PromptQuality_normalized × 0.20 +
  Consistency_normalized × 0.15 +
  Breadth_normalized × 0.15
) × 1000
```

Each component is normalized to 0-1 using percentile ranking against all active users. This means:
- APS 500 = median AI user
- APS 800 = top 20%
- APS 950 = top 5%
- APS 1000 = #1 globally

### 6C. Leaderboard Views

| View | Ranking by | Filter options |
|------|-----------|----------------|
| **Global** | APS (composite) | Time window (7d/30d/all-time) |
| **By Output** | Total complexity-weighted milestones | Language, time window |
| **By Efficiency** | Average efficiency score | Min sessions threshold |
| **By Prompt Quality** | Average prompt scores | Min sessions threshold |
| **By Language** | APS, filtered to users of that language | Per language |
| **By Tool** | APS, filtered to users of that AI client | Per AI tool |
| **Country** | APS | By country (opt-in) |

### 6D. Anti-Gaming Protections

| Risk | Mitigation |
|------|-----------|
| Inflating milestones | Chain signing — tamper-evident. Server-side validation: flag impossible rates (>20 complex milestones/hour) |
| Self-rating inflation | Cross-validate: high `prompt_quality` but high `iteration_count` = inconsistent. Weight `task_outcome` heavily |
| Session farming (many short sessions) | Minimum session duration (2+ minutes) for leaderboard. Weight by complexity, not count |
| Idle sessions (heartbeat farming) | `focus_score` is derived, not self-reported. Heartbeats require actual tool calls |
| Multiple accounts | Require email verification. Flag statistical anomalies |

### 6E. Profile Page (UseAI.dev/u/{username})

```
┌──────────────────────────────────────────┐
│  @username                    APS: 847   │
│  "Full-stack developer"     Top 12%      │
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ 142 hrs │ │ 89 feat │ │ 23 cplx │   │
│  │ active  │ │ shipped │ │ solved  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                          │
│  Radar: Output / Efficiency / Prompts /  │
│         Consistency / Breadth            │
│                                          │
│  Top Languages: TS, Python, Rust         │
│  AI Tools: Claude Code, Cursor           │
│  Streak: 14 days                         │
│  Member since: Jan 2026                  │
│                                          │
│  Recent Milestones:                      │
│  ✦ Implemented user authentication       │
│  ✦ Fixed race condition in worker        │
│  ✦ Added integration test suite          │
└──────────────────────────────────────────┘
```

The radar chart is particularly powerful — it shows someone's strengths at a glance. A developer might have:
- High Output + High Efficiency + Low Breadth = **Specialist**
- Medium Output + High Prompt Quality + High Breadth = **Versatile communicator**
- High Output + Low Prompt Quality + High Iterations = **Brute-force coder** (area for improvement)

---

## 7. Dashboard Integration

### 7A. Local Dashboard (daemon)

The local dashboard gains:

| Component | Data | Purpose |
|-----------|------|---------|
| **Evaluation Summary** | Last N sessions' evaluation scores | "Your prompt quality averages 3.8/5 — improved from 3.2 last week" |
| **Efficiency Trend** | Rolling efficiency_score | "You're completing complex tasks 15% faster this month" |
| **Skill Radar** | 5-axis radar from APS components | Visual strengths/weaknesses |
| **Improvement Tips** | Based on lowest-scoring evaluation areas | "Try providing more file context — your `context_provided` score averages 2.8" |
| **Leaderboard Position** | APS rank (requires sync) | "You're #847 globally, top 12%" |

### 7B. Web Dashboard (UseAI.dev)

The public web dashboard shows:
- Profile page with APS and radar
- Global and filtered leaderboards
- Public milestones (generic titles only)
- Trend charts (weekly/monthly APS, component trends)
- Achievement badges (first complex solve, 100th session, 7-day streak, etc.)

---

## 8. Achievement Badges

Badges add gamification beyond the numeric score. Unlocked on the server based on synced data.

### Milestone Badges
| Badge | Criteria |
|-------|----------|
| First Blood | Complete first session |
| Feature Factory | Ship 10 features |
| Bug Hunter | Fix 25 bugs |
| Complexity Crusher | Solve 10 complex problems |
| Century | 100 sessions total |

### Streak Badges
| Badge | Criteria |
|-------|----------|
| Consistent | 7-day streak |
| Dedicated | 30-day streak |
| Relentless | 100-day streak |

### Proficiency Badges
| Badge | Criteria |
|-------|----------|
| Clear Communicator | Average prompt_quality ≥ 4.0 over 20+ sessions |
| Efficient Operator | Average efficiency_score in top 20% over 20+ sessions |
| Polyglot | Use 5+ languages in a 30-day window |
| Tool Master | Use 3+ AI clients in a 30-day window |
| One-Shot Wonder | 10+ sessions with task_outcome=completed and iteration_count ≤ 3 |

### Special Badges
| Badge | Criteria |
|-------|----------|
| Deep Worker | 5+ sessions with focus_score ≥ 0.9 |
| Night Owl | 20+ sessions started between 10 PM - 4 AM |
| Early Bird | 20+ sessions started between 5 AM - 8 AM |
| Marathon | Single session lasting 2+ hours with task_outcome=completed |

---

## 9. Implementation Phases

### Phase A — Evaluation Capture (MCP changes)
**Scope:** Add `evaluation` to `useai_end`, update types, remove `prompt` from `useai_start`

1. Add `SessionEvaluation` type to `packages/shared/src/types/chain.ts`
2. Add `evaluation` optional field to `SessionSeal`
3. Update `useai_end` in `register-tools.ts` — accept `evaluation` param, write to chain + seal
4. Remove `prompt` param from `useai_start` (keep title/private_title)
5. Update tool instructions to guide AI on evaluation scoring
6. Update tests
7. Build + publish

### Phase B — Local Dashboard Evaluation UI
**Scope:** Show evaluation data in the local dashboard

1. Add evaluation summary component (averages, trend arrows)
2. Add skill radar chart (5-axis)
3. Add improvement tips based on lowest scores
4. Add efficiency trend line
5. Wire into App.tsx

### Phase C — Server-Side Aggregation
**Scope:** API computes APS and leaderboard rankings

1. Update sync schema to accept `evaluation` field
2. Build APS computation engine (percentile normalization)
3. Build leaderboard query endpoints
4. Build badge computation (check criteria on sync)
5. Build profile API endpoint

### Phase D — Web Leaderboard (UseAI.dev)
**Scope:** Public-facing leaderboard and profiles

1. Build leaderboard page with filters
2. Build profile page with radar chart
3. Build badge display
4. Build trend charts
5. SEO optimization for developer profiles

### Phase E — Intelligence & Tips
**Scope:** Personalized improvement recommendations

1. Analyze evaluation patterns to generate tips
2. Build comparison ("Your prompt quality is above average but efficiency is below — try scoping tasks more tightly")
3. Weekly email digest with APS change, badges earned, tips
4. Goal setting ("Reach APS 800 this month")

---

## 10. Data Flow Summary

```
Developer starts session
    │
    ▼
useai_start(task_type, title, private_title)
    │  → Chain: session_start record
    │  → SessionState: stores title, task_type
    │
    ▼
[Developer works with AI... heartbeats every 15m]
    │
    ▼
useai_end(languages, files, milestones, evaluation)
    │
    ├──► Chain: session_end record (full evaluation detail)
    ├──► Chain: milestone records
    ├──► Chain: session_seal record (signed)
    │
    ├──► sessions.json: SessionSeal + evaluation scores
    ├──► milestones.json: milestone entries
    │
    ▼
Sync → api.useai.dev
    │  SessionSeal + evaluation (all numeric, safe)
    │  Milestones (public titles only on leaderboard)
    │
    ▼
Server computes:
    ├──► APS (percentile-based composite score)
    ├──► Leaderboard rankings (global + filtered)
    ├──► Badge checks (unlock on criteria match)
    ├──► Trend data (rolling 7d/30d)
    │
    ▼
UseAI.dev displays:
    ├──► /leaderboard — Global rankings
    ├──► /u/{username} — Profile + radar + badges
    └──► /u/{username}/trends — Historical APS
```

---

## 11. Why This Wins

### For developers (individual value)
- **Self-improvement:** Concrete metrics on prompt quality, efficiency, and growth
- **Portfolio signal:** "I'm an APS 850 developer" is a new credential
- **Tool optimization:** Data-driven choice of which AI tool to use for what
- **Habit building:** Streaks, badges, and visible progress drive daily engagement

### For the market (competitive moat)
- **No competitor measures human AI proficiency** — WakaTime = hours, Copilot = acceptance rate, neither measures the human
- **Network effects:** Leaderboard is only valuable with users → more users = more valuable
- **Data advantage:** Evaluation data across ALL AI tools (not locked to one vendor)
- **Viral potential:** APS badges in GitHub READMEs, "Top 5% AI Developer" in LinkedIn bios

### For employers (future monetization)
- **Hiring signal:** APS as a proxy for AI-augmented productivity
- **Team analytics:** "Our team's average APS is 720 — industry average is 500"
- **Training ROI:** Measure impact of AI training programs via APS improvement

---

## 12. Open Questions

1. **Evaluation calibration:** Different AI tools have different conversation styles. Should evaluation be normalized per-client?
2. **Minimum activity threshold:** How many sessions before appearing on leaderboard? (Proposed: 10 sessions in 30 days)
3. **Privacy tiers:** Should users control which evaluation dimensions are public?
4. **Team leaderboards:** Support for org-level aggregation? (Future — not MVP)
5. **Historical backfill:** Can we retroactively score old sessions that lack evaluation data? (Likely no — accept data starts from the version that captures it)

---

*Created: 2026-02-16*
*Status: Proposal — pending review*
