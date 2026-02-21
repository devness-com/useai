# useai.dev — Platform Evaluation & Strategy

## Problem Statement

Developers are adopting AI tools at unprecedented rates (85% use them regularly), yet:

- **Discovery is fragmented.** 16,000+ AI tools exist. No single source tells a developer what's relevant to their stack.
- **Trust is falling.** Despite rising adoption, developer confidence in AI tool recommendations is declining. LLMs give inconsistent suggestions.
- **The learning curve is real.** Developers slow down 19% when first adopting AI tools. Most use only basic features of powerful tools.
- **No proof of proficiency.** There is no credential or verifiable signal that a developer is skilled with AI-assisted development.

useai.dev aims to solve all four.

---

## Three Approaches Evaluated

Over the course of strategy development, three distinct approaches emerged. Each was evaluated independently, then combined into the final platform design.

---

## Approach 1: AI Tool Recommendation Engine

### Concept

A platform that scrapes the web daily (Twitter/X, Reddit, ProductHunt, YouTube, Hacker News, GitHub, etc.), processes content through an AI classification pipeline, and provides personalized tool recommendations to developers based on their tech stack, experience level, and goals.

### Strengths

| Strength | Detail |
|----------|--------|
| Addresses a real gap | No platform provides personalized AI tool recommendations based on tech stack |
| Differentiated from directories | Goes beyond listing tools to actually guiding developers |
| Strong B2B angle | Tool companies would pay for placement and analytics |

### Weaknesses

| Weakness | Detail |
|----------|--------|
| Trust problem | "Who decided this is better?" — subjective recommendations erode trust quickly |
| Maintenance burden | AI tools change weekly. Keeping recommendations accurate requires constant manual validation |
| No inherent virality | Nobody shares a recommendation page on social media |
| Cold start is hard | Need high-quality recommendations before users come, but need user data to make good recommendations |

### Verdict

**Killed.** The MCP telemetry data (Approach 3) reveals which tools exist and how popular they are — faster and more accurately than any web scraper. If tool metadata (pricing, features) is needed later, it can be added manually for the top 50 tools or sourced from tool companies directly.

---

## Approach 2: Community Workflow Platform

### Concept

Instead of telling developers what to use, let developers show each other what they use. The platform provides a workflow builder where developers map their AI-assisted development process and generate beautiful shareable visuals.

### Strengths

| Strength | Detail |
|----------|--------|
| Trust is built-in | Real developers sharing real workflows |
| Self-maintaining content | Users create and update their own workflows |
| Inherent virality | "Here's my AI stack" posts get high engagement |

### Weaknesses

| Weakness | Detail |
|----------|--------|
| Cold start problem | Need workflows before the platform is useful |
| Self-reported bias | Developers may list aspirational tools, not actual tools |
| Static after creation | Once a workflow is made, little reason to return and update it |

### Verdict

**Absorbed into Approach 3.** When the MCP tracks what tools a developer uses and for how long, the "workflow" is generated automatically from real data — no manual builder needed. The best parts (beautiful visuals, social sharing, Remotion videos) are absorbed into Approach 3's profile and sharing system.

---

## Approach 3: Local-First MCP Telemetry & Developer Portfolio

### Concept

A lightweight MCP (Model Context Protocol) server that installs in any AI coding tool (Cursor, Claude Code, Windsurf, VS Code, Copilot, Gemini CLI, Codex, etc.) and tracks development activity in a **100% local-first, zero-network-call** architecture.

The MCP server makes **ZERO network calls during coding**. Everything is stored on the developer's machine. Stats are auto-synced daily by a background daemon (opt-out via config). Milestones only leave the machine when the developer explicitly publishes from the CLI.

This creates a verified developer portfolio on useai.dev — part activity tracker, part build journal, part professional credential.

---

### Local-First Architecture

The core design principle: **the MCP server never touches the network. Stats sync automatically in the background. Milestones publish only when the developer says so.**

```
DURING CODING (100% local, 0 network calls):
  MCP records → local files → signed hash chain → sealed sessions
  Every heartbeat, session, milestone → written to ~/.useai/

BACKGROUND SYNC (automatic, daily):
  CLI daemon aggregates daily stats from sealed sessions
  Syncs to api.useai.dev automatically
  No notification, no review gate, no consent prompt
  Developer opted in when they installed the MCP
  Opt-out anytime: `useai config --no-sync`

MANUAL PUBLISH (user-initiated only):
  CLI: useai publish
  ├─ User selects specific milestones to share
  ├─ Previews the output
  └─ Publishes to useai.dev profile
```

**Server load comparison:**

```
Real-time heartbeat design (rejected):
  1K devs  × 1 req/min  =    1,000 req/min  =     17 req/sec
 10K devs  × 1 req/min  =   10,000 req/min  =    167 req/sec
100K devs  × 1 req/min  =  100,000 req/min  =  1,667 req/sec

Local-first + daily batch sync (current design):
  1K devs  × 2 req/day  =    2,000 req/day  =   0.02 req/sec
 10K devs  × 2 req/day  =   20,000 req/day  =   0.23 req/sec
100K devs  × 2 req/day  =  200,000 req/day  =   2.31 req/sec
```

**700x reduction at scale.** At 100K users, the server handles 2.3 req/sec — a single $5/month VPS manages this easily. The load is low because it's a daily batch operation, not real-time streaming.

**Additional benefits:**
- MCP responses are instant (no network latency during coding)
- Works offline (airplane, VPN, flaky WiFi)
- Zero data loss (server outage doesn't lose sessions)
- Privacy by architecture, not by policy

---

### Two-Category Data Model

All data starts local. Stats sync automatically. Milestones publish only when the developer says so.

#### Category 1: Stats (auto-sync)

Session metrics — the lightweight stats that power the leaderboard and profile.

| Metric | Why It's Safe | Why It's Valuable |
|--------|--------------|-------------------|
| Which AI tool (Cursor, Claude Code, etc.) | Generic metadata | Shows tool adoption and market share |
| Session duration | Time only, no content | Shows engagement depth |
| Task type (coding, testing, planning, etc.) | Self-reported category | Shows workflow breadth |
| Languages used | Already public in GitHub profiles | Shows tech stack distribution |
| Number of files touched (count only) | Just a number, no names | Shows session complexity |
| Timestamps | When, not what | Powers streaks, heatmaps |

**Sync flow:** Background daemon syncs daily. No notification, no review gate. Opt-out via `useai config --no-sync`.

1. MCP records sessions all day (locally)
2. Background daemon aggregates daily stats from sealed sessions
3. Auto-syncs to api.useai.dev (no user action required)
4. Developer can also force an immediate sync: `useai sync`

#### Category 2: Milestones (manual publish only)

Milestones are captured automatically as part of ending a session via `useai_end`, not via a separate tool call. The AI summarizes what was accomplished during the session and records it as part of the session seal. Milestones with optional attachments (screenshots/videos) represent what was built. **Never auto-published.**

| Field | Example | Privacy Level |
|-------|---------|---------------|
| Title | "Implemented user authentication" | Generic description — no proprietary details |
| Category | feature / bugfix / refactor / test | Safe category |
| Complexity | simple / medium / complex | Subjective assessment |
| Duration | 12 minutes | From MCP session tracking — verified by chain |
| Languages | ["typescript"] | Already public info |
| Client | "claude-code" | Which tool was used |
| Attachments | screenshot.png, demo.mp4 | Developer's local machine only until published |

**Privacy rules for milestone descriptions:**

Milestones must be described in generic terms. The AI is instructed to never include:
- Project or repository names
- File names or file paths
- API endpoints or database names
- Company or client names
- Any detail that could identify the specific project

Good: "Implemented user authentication", "Fixed race condition in background worker", "Built responsive dashboard layout"
Bad: "Fixed bug in /api/stripe/webhooks", "Added auth to acme-corp project", "Updated UserService.ts in src/services/"

The developer uses `useai publish` to select specific milestones to share. They can review and edit descriptions before publishing. Published milestones get a verification tier based on chain integrity. Attachments are only uploaded when the user explicitly includes them via `useai publish --attach`.

The product showcase transforms the profile from stats to proof:

Without showcase:
> "87 hours of AI-paired coding on Claude Code"

With showcase:
> "Built an e-commerce marketplace in 4h 32min using Claude Code" + demo video

---

### Authenticity & Integrity

**The problem:** If everything is local JSON, a developer could edit session hours, fake milestones, or inflate streaks. The leaderboard becomes meaningless.

**The solution:** Ed25519-signed hash chain — makes tampering cryptographically detectable without any server calls during coding.

#### Hash Chain

Every event the MCP server records is appended to a **per-session chain file** at `~/.useai/data/active/{session_id}.jsonl`. Each record contains:

- **SHA-256 hash** of (record data + previous record's hash) — creates the chain
- **Ed25519 signature** of the hash — proves the MCP server wrote it

```
Record 1 (session start)
  data: {client: "cursor", task_type: "coding"}
  hash: SHA256(data + "GENESIS")  →  "a3f8c1..."
  sig:  Ed25519(hash, private_key) →  "8b4e2f..."

Record 2 (heartbeat)
  data: {heartbeat: 1, cumulative_seconds: 60}
  hash: SHA256(data + "a3f8c1...")  →  "7b2e4d..."
  sig:  Ed25519(hash, private_key) →  "c91a3d..."

Record 3 (session end)
  hash: SHA256(data + "7b2e4d...")  →  "f19a03..."
  sig:  Ed25519(hash, private_key) →  "d45b7e..."

Record 4 (session seal)
  data: {seal: {duration: 105, heartbeats: 105, chain_start: "a3f8c1", chain_end: "f19a03"}}
  hash: SHA256(data + "f19a03...")  →  "d4c6b8..."
  sig:  Ed25519(hash, private_key) →  "a27c9f..."
```

If someone edits Record 2, Record 3's hash no longer validates. The chain is broken.

#### Ed25519 Keystore

On first MCP run, an Ed25519 keypair is generated:

- **Private key** → encrypted with AES-256-GCM, stored in `~/.useai/keystore.json`
- **Encryption key** → derived from machine-specific data (hostname + username + PBKDF2 with 100K iterations)
- **Public key** → stored in plaintext, registered with server during `useai login` (one-time, explicit action)

To tamper with the chain, someone would need to:
1. Find the keystore file
2. Understand the key derivation scheme (read source code)
3. Decrypt the private key
4. Rebuild the entire chain with correct signatures

That's not "open a JSON file and change a number." That's reverse-engineering. 99% of users won't bother.

#### Session Seals

When a session ends, the MCP creates a **sealed summary** — a signed record capturing the session truth:

```json
{
  "session_id": "sess_a1b2c3",
  "client": "cursor",
  "duration_seconds": 6300,
  "heartbeat_count": 105,
  "chain_start_hash": "a3f8c1...",
  "chain_end_hash": "f19a03...",
  "record_count": 107,
  "seal_signature": "Ed25519(...)"
}
```

The seal is computed from the chain. Editing individual records after sealing is detectable.

#### Verification Tiers (Assigned at Sync Time)

When the developer syncs, the server verifies:

```
🟢 VERIFIED
   Ed25519 signatures valid on all seals.
   Chain intact. Timestamps plausible. Patterns normal.
   Profile shows: "8.5h verified AI-paired coding"

🟡 UNVERIFIED
   Data synced but signatures missing or invalid.
   Could be from older version, manual entry, or tampering.
   Profile shows: "8.5h self-reported"
```

No "flagged" or punitive state. Just: "this data is cryptographically signed" or "it isn't."

#### Statistical Guardrails (Server-Side, Supplementary)

| Rule | Threshold | Action |
|------|-----------|--------|
| Max daily hours | > 18h | Flag for review |
| Session without breaks | > 6h continuous | Soft warning |
| Sudden spike | 10x previous average | Flag |
| Impossible overlap | 2 sessions, same time | Reject |
| Future timestamps | Ahead of server time | Reject |

These are backstops, not primary detection. The chain does the heavy lifting.

#### Performance Cost: Chain vs Plain JSON

The hash chain adds cryptographic operations to every record. Here's the actual overhead:

**Per-record cost (every heartbeat, session start/end, milestone):**

| | Plain JSON | Signed Hash Chain | Difference |
|---|---|---|---|
| Compute | `JSON.stringify` only | + 1 SHA-256 (~5μs) + 1 Ed25519 sign (~100μs) | +0.1ms |
| Storage per record | ~150 bytes | ~400 bytes (adds prev_hash, hash, signature) | ~2.5x |
| File write | append line to JSONL | identical — still append line | none |

The crypto adds ~0.1ms per record. The file I/O (disk write) takes ~1ms. **The disk is the bottleneck, not the crypto.** The signing overhead is invisible in practice.

**One-time cost (first MCP run ever):**

| Operation | Time |
|---|---|
| Generate Ed25519 keypair | ~1ms |
| PBKDF2 key derivation (100K iterations) | ~100-200ms |
| Encrypt + write keystore | ~1ms |

After first run, subsequent MCP startups decrypt the existing key (~100-200ms for PBKDF2). This happens once per session launch and is not noticeable.

**Storage at scale (local disk):**

| Usage | Plain JSON | With Chain |
|---|---|---|
| 100 sessions (~15K records) | ~2 MB | ~5 MB |
| 1,000 sessions (~150K records) | ~20 MB | ~50 MB |

Negligible for local storage. Even heavy users won't exceed 50 MB.

**Why the chain is worth it:**

Without the chain, any AI tool can edit `~/.useai/sessions.json` directly — inflating hours, faking streaks, adding milestones. One prompt to Claude Code or Cursor and the JSON is rewritten. With the chain, tampering requires reverse-engineering the keystore encryption, key derivation scheme, and rebuilding the entire chain with valid signatures. That's not "edit a JSON file" — that's deliberate effort.

**Trade-offs:**

| Pros | Cons |
|------|------|
| AI can't trivially fake data | PBKDF2 adds ~150ms to MCP startup |
| ~0.1ms overhead per record (invisible) | ~80 lines of chain logic to maintain |
| Storage 2-3x but still trivial (MBs) | Keystore corruption makes old chains unverifiable |
| Server verification is one-time gate | Determined attacker with source code access can still tamper |

**Server-side role:** The server verifies chain signatures once at sync time, stamps data as "Verified" or "Unverified", and stores the stats. No ongoing chain processing after that. The chain earns its keep locally; on the server it's a one-time verification gate.

---

### What Is NEVER Captured

| Data | Why It's Excluded |
|------|-------------------|
| Prompts or AI responses | Core private data — would destroy trust |
| Code or file contents | Intellectual property, often proprietary |
| File names or paths | Can reveal project structure, company info |
| Repository or project names | Confidential business information |
| Error messages | Can contain sensitive data |
| API keys or credentials | Obviously |
| Anything typed by the user | Zero content capture, period |

**Note:** Milestone descriptions are also privacy-filtered by the same rules. The AI is instructed to produce only generic descriptions (e.g., "Implemented user authentication") and to never include project names, file names, library names, API endpoints, or any project-specific details. See Category 2 above for full privacy rules.

---

### MCP Technical Design

The MCP server exposes **3 tools, all 100% local.** Zero network calls.

| Tool | What It Does | Where Data Goes |
|------|-------------|-----------------|
| `useai_start` | Start session, write to chain | Local only |
| `useai_heartbeat` | Periodic ping, write to chain | Local only |
| `useai_end` | End session, record milestones, create seal, write to chain | Local only |

**Removed from MCP (moved to CLI or folded in):**
- `useai_milestone` → folded into `useai_end` (milestones captured at session end)
- `useai_attach` → `useai publish --attach` (CLI, during publish workflow)
- `useai_stats` → `useai stats` (CLI — read local stats: streak, hours, tools)
- `useai_local_data` → `useai status` (CLI — transparency dashboard)
- `useai_publish` → `useai publish` (requires network)
- `useai_share` → `useai share` (requires network)
- `useai_stats` server mode → `useai stats --server` (requires network)

**Local storage:**
```
~/.useai/
├── keystore.json          # Encrypted Ed25519 private key + public key
├── config.json            # Settings (milestone_tracking: bool, auto_sync: bool)
├── data/
│   ├── active/            # Per-session chain files (running sessions)
│   │   └── {session_id}.jsonl
│   ├── sealed/            # Per-session chain files (completed sessions)
│   │   └── {session_id}.jsonl
│   └── milestones.json    # Milestones with publish status + attachment refs
```

**Per-session isolation:** Each MCP instance writes to its own chain file (`active/{session_id}.jsonl`). Multiple parallel sessions on the same machine never conflict — each process owns its own chain. Chain tip is kept in memory (only this process writes to this chain). On session end, the chain file is atomically moved from `active/` to `sealed/`.

**Chain file format (JSONL — one record per line):**
- Append: O(1) — just write a new line
- Read all: sequential line-by-line (only during sync/verification)
- No need to parse entire file to add a record

---

### CLI Commands

The CLI is the sync engine, transparency dashboard, and user's primary interface for network operations.

```bash
# Authentication
useai login              # Authenticate with useai.dev, register public key (one-time)
useai logout             # Clear credentials

# Local operations (moved from MCP)
useai stats              # Local stats: streak, hours, tools, languages (was useai_stats MCP tool)
useai status             # Transparency dashboard: full data report + settings (was useai_local_data MCP tool)

# Local operations
useai milestones         # List local milestones
useai milestones -v      # With details + attachments
useai config             # View/edit settings (milestone_tracking, auto_sync)
useai config --no-sync   # Disable automatic background sync
useai export             # Dump all local data as JSON
useai purge              # Delete all local data

# Sync (automatic — runs daily in background)
useai sync               # Force an immediate sync (normally happens automatically daily)
useai sync --force       # Alias for immediate sync

# Publish (network — explicit, user-initiated)
useai publish            # Interactive: select milestones to publish
useai publish --all      # Publish all unpublished milestones
useai publish --attach   # Attach screenshots/videos during publish workflow

# Profile (network — explicit)
useai share              # Generate "This is how I UseAI" share link
useai stats --server     # Fetch server stats (rank, leaderboard position)

# Local web UI
useai serve              # Start local web UI on localhost:3456
```

---

### Applications Architecture

Five applications, each with a clear boundary:

#### 1. MCP Server (already built)
The invisible data collector. Runs inside AI coding tools. 3 tools, all local. Zero UI. Zero network. Writes to `~/.useai/`.

#### 2. CLI Tool (`useai`)
Developer's terminal interface. Reads `~/.useai/` directly. Owns the sync engine and transparency dashboard. Background daemon auto-syncs stats daily. Network calls for `sync`, `publish`, `share`, `login`. Also hosts `useai stats` and `useai status` (moved from MCP).

#### 3. Local Web UI (`useai serve`)
Single-page app served on `localhost:3456`. Reads from `~/.useai/`. For visual milestone review, publish workflow, post/card builder, privacy dashboard. Talks to `api.useai.dev` only during explicit publish.

#### 4. Public Web App (useai.dev)
Public-facing product:
- Landing page (what is useai, install instructions)
- `useai.dev/@username` (developer profile: heatmap, stats, milestones, tool breakdown)
- `useai.dev/leaderboard` (global rankings)
- `useai.dev/explore` (trending tools, popular stacks)
- Dashboard (auth'd: settings, profile editor, API token management)

#### 5. Backend API (api.useai.dev)
Handles batched daily summaries instead of real-time streams:
- `POST /api/sync` — receives daily aggregate (one call/day/user)
- `POST /api/publish` — receives user-curated milestones
- `POST /api/render/card` — generates share card image
- `POST /api/render/video` — queues Remotion video render
- `GET /api/profile/:user` — public profile data
- `GET /api/leaderboard` — rankings
- `POST /api/auth/login` — authentication
- `POST /api/keys/register` — register Ed25519 public key (one-time)

No ingest pipeline. No heartbeat handler. No real-time processing. The server is essentially a **static profile host** that gets updated 1-2x daily.

```
Developer's Machine                              useai.dev
┌───────────────────────────────┐    ┌─────────────────────────────┐
│  MCP Server (ZERO network)    │    │                             │
│  ├─ Records to local files    │    │  Backend API                │
│  ├─ Ed25519 signs every record│    │  (handles daily syncs)      │
│  └─ Creates session seals     │    │                             │
│                               │    │  Public Web App             │
│  ~/.useai/                    │    │  ├─ Profiles                │
│  ├─ keystore.json             │    │  ├─ Leaderboard             │
│  ├─ config.json               │    │  ├─ Explore                 │
│  ├─ data/active/              │    │  └─ Dashboard               │
│  ├─ data/sealed/              │    │                             │
│  └─ data/milestones.json      │    │                             │
│                               │    │                             │
│  CLI (useai)                  │    │                             │
│  ├─ auto-sync (background) ───┼───→│  Verify chain signatures    │
│  ├─ useai publish ────────────┼───→│  Store milestones           │
│  ├─ useai share ──────────────┼───→│  Generate share cards       │
│  └─ useai serve               │    │                             │
│     └─ Local Web UI           │    │                             │
│        (localhost:3456)       │    │                             │
└───────────────────────────────┘    └─────────────────────────────┘
```

---

### The Sync Cycle

```
                    ┌──────────────────────────────────────┐
                    │      Developer's Machine              │
                    │                                        │
  9:00 AM ─────────│  MCP records session start             │
  9:01 AM ─────────│  Heartbeat → local chain               │
  9:02 AM ─────────│  Heartbeat → local chain               │
    ...             │  (no network calls all day)            │
  5:30 PM ─────────│  Session end → milestones + seal       │
                    │  (milestones captured at session end)  │
                    │                                        │
  6:00 PM ─────────│  Background daemon aggregates:         │
  (automatic)       │  "8.5h coded, 3 tools, 4 langs"       │
                    │                                        │
                    │  Auto-syncs to api.useai.dev ──────────┼───→ Profile updated
                    │  (no notification, no review)          │
                    └──────────────────────────────────────┘
```

---

### The Transparency Dashboard

The `useai status` CLI command (formerly the `useai_local_data` MCP tool) shows:

```
UseAI Data — Full Transparency Report
══════════════════════════════════════

STORED LOCALLY (~/.useai/):
  Sessions recorded: 234
  Total tracked time: 87h 14m
  Chain records: 12,847 (Ed25519 signed)
  Milestones (unpublished): 35
  Milestones (published): 12
  Attachments: 4
  Local storage size: 342 KB

NETWORK CALLS MADE BY MCP SERVER: ZERO
  Stats are auto-synced daily by the background daemon.
  Milestones only leave this machine when YOU run:
  • `useai publish` — publishes selected milestones
  Disable auto-sync: `useai config --no-sync`

SETTINGS:
  Milestone tracking: ON
  Auto-sync: ON

NEVER CAPTURED (not stored anywhere):
  Code, prompts, file names, repo names, credentials
```

---

### The Developer Profile (useai.dev/@username)

Two sections: **Activity Stats** (from auto-synced stats) and **Build Portfolio** (from manually published milestones).

**Activity Stats:**
```
Activity heatmap (GitHub contribution graph style)
├── Monthly AI-paired hours
├── Tool distribution (Claude Code 62%, Cursor 24%, etc.)
├── Task breakdown (Coding 58%, Testing 18%, Planning 14%)
├── Streak (consecutive days using AI tools)
└── Verification status (🟢 Verified / 🟡 Unverified)
```

**Build Portfolio (published milestones + showcases):**
```
Recent Builds
├── E-commerce Marketplace — 4h 32min using Claude Code 🟢 Verified
│   ├── Product listing page — 35 min
│   ├── Shopping cart — 28 min
│   ├── Auth system — 12 min
│   └── [Product demo video]
│
├── Complex race condition fix — 1h 47min using Cursor 🟢 Verified
│   └── Category: Bugfix · Complexity: Complex
│
└── REST API with auth — 2h 10min using Claude Code 🟢 Verified
    └── [Screenshot attached]
```

The "Verified" badge means the time was tracked by the MCP server with an intact Ed25519-signed hash chain.

---

### "This is how I UseAI" — Brand System

The product name works as both a brand and a natural language phrase.

| Context | Message |
|---------|---------|
| Profile share | "This is how I UseAI" |
| Homepage | "How do you UseAI?" |
| Leaderboard | "See how developers UseAI" |
| Hiring | "Show employers how you UseAI" |
| Year-in-review | "How I UseAI'd in 2026" |

---

### The Global Leaderboard

Updates 1-2x daily (from synced data), not real-time.

| Dimension | What It Measures |
|-----------|-----------------|
| AI Hours | Total AI-paired time (🟢 verified preferred) |
| Streak | Consecutive active days |
| Tool Diversity | Unique tools used across sessions |
| Workflow Coverage | % of dev stages using AI |
| Builds Shipped | Published milestones with verified times |

**Leaderboard views:** Global, by language, by tool, by company (opt-in), by region.

---

### The Hiring/Portfolio Angle

Today, there is no verifiable credential for AI-assisted development proficiency.

**What a hiring manager sees on a useai.dev profile:**
- 🟢 Verified 500+ hours of AI-paired development
- Built 15 products with AI — demos and verified build times
- Uses 6 different tools across the full lifecycle
- Active for 8 consecutive months
- Resolved complex bugs in under 2 hours with AI assistance
- Chain integrity: all sessions cryptographically verified

---

### Wakatime Comparison

| Dimension | Wakatime | useai.dev |
|-----------|----------|-----------|
| What it tracks | Coding time, language, project, editor | AI-paired coding time, tool, task type + milestones + showcases |
| Distribution | Editor plugins (per-editor) | MCP server (works in ALL AI tools at once) |
| Network model | All data sent to server in real-time | Local-first, automatic daily batch sync (opt-out via config) |
| Authenticity | None — trusts the client | Ed25519 signed hash chain with verification tiers |
| Portfolio | No — time tracking only | Yes — verified builds with product demos |
| Local-first | No — all data to server | Yes — everything local, user controls sync |
| Privacy | Project names visible to server | Zero content capture. Stats auto-sync (opt-out). Milestones require explicit publish |

---

## Head-to-Head Comparison

| Dimension | Approach 1: Recommendations | Approach 2: Community | Approach 3: Local-First MCP |
|-----------|----------------------------|----------------------|---------------------------|
| **Trust** | Low | High | Highest — local-first + crypto verification |
| **Content creation** | Platform writes everything | Users create | Auto-generated from real data |
| **Virality** | None | High | Very High — "This is how I UseAI" + demos |
| **Maintenance** | Brutal | Low | None — passive collection |
| **Data moat** | Weak | Medium | Strong — verified usage + build portfolios |
| **Cold start** | Need content first | Need users first | Passive — installs generate data |
| **Server cost** | High (scraping) | Medium | Near zero (daily sync only) |
| **Privacy** | N/A | Self-reported | Architecture-enforced, zero network during use |
| **Authenticity** | N/A | None | Ed25519 signed chain + verification tiers |
| **Defensibility** | Low | Medium | High |

---

## Final Decision: Approach 3 Is the Product

Approach 3 subsumes the best parts of Approaches 1 and 2:

- **From Approach 1:** Tool intelligence comes from real MCP usage data (no scraping needed)
- **From Approach 2:** Beautiful shareable visuals and Remotion videos built into profile/share system
- **Unique to Approach 3:** Local-first architecture, Ed25519 signed chain, session seals, verified builds, zero network during coding

**What we're building:**

```
Install MCP → Use your AI tools normally
                    ↓
              Everything recorded LOCALLY (zero network)
              Hash chain signed with Ed25519
              Sessions sealed on completion
                    ↓
              Stats auto-sync daily (background, opt-out via config)
              User publishes selected milestones + showcases
                    ↓
              "This is how I UseAI" — share profile + builds
              Verification tier: 🟢 Verified / 🟡 Unverified
              Leaderboard ranking + streak
                    ↓
              Developer credential for hiring
              B2B tool intelligence from aggregated data
```

---

## Implementation Priority

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| **Phase 1** | MCP server + CLI + API | MCP with chain signing (done), CLI with auto-sync daemon + `publish` + `stats` + `status`, API with auth + sync endpoint |
| **Phase 2** | Public web + profiles | useai.dev landing page, `/@username` profiles, activity heatmaps |
| **Phase 3** | Leaderboard + sharing | Global leaderboard, "This is how I UseAI" card generation, social sharing |
| **Phase 4** | Local web UI + showcases | `useai serve`, milestone review, post composer, image/video uploads |
| **Phase 5** | Remotion + premium | Animated profile videos, verified badges, premium analytics, B2B dashboards |

**Already done:**
- MCP server built and published to npm (`@devness/useai` + `useai-dev`)
- 3 MCP tools implemented (session_start, heartbeat, session_end with integrated milestones); milestone, attach, stats, and local_data moved to CLI or folded in
- Ed25519 keystore with AES-256-GCM encryption
- Signed hash chain (JSONL, append-only)
- Session seals
- Local-first storage at `~/.useai/data/`
- Transparency dashboard

---

## Monetization Strategy

| Revenue Stream | Source | Timeline |
|----------------|--------|----------|
| **Freemium subscriptions** | Premium profile features, detailed analytics, extended history | Month 4+ |
| **B2B tool intelligence** | Dashboard for AI tool companies showing adoption, trends, tool pairings | Month 8+ |
| **Affiliate commissions** | When users click tools in profiles and sign up | Month 3+ |
| **Verified profiles** | "Verified AI Developer" badge for premium members | Month 6+ |
| **Job board** | Companies hiring AI-native developers from useai.dev profiles | Month 10+ |
| **Data reports** | "State of AI Dev Tools Q1 2026" sold to VCs, tool companies | Month 12+ |

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Privacy backlash | High | Low | Local-first architecture — MCP makes zero network calls. Auto-sync is opt-out (`useai config --no-sync`). Only anonymized stats sync; milestones require explicit publish. Radical transparency via `useai status` dashboard |
| AI generates milestone with proprietary details | High | Medium | Strong privacy rules enforced at MCP level: no project names, file names, API endpoints, database names, or company names allowed in milestone descriptions. Generic descriptions only (e.g., "Implemented user authentication"). User also reviews before CLI publish |
| MCP tool calling unreliable | Medium | High | Sessions inferred from heartbeat gaps, local storage as fallback |
| Leaderboard gaming | Medium | Medium | Ed25519 signed chain, verification tiers, statistical guardrails, multi-dimensional scoring |
| Chain tampering | Medium | Low | Ed25519 signing + encrypted keystore + verification tiers. Determined attackers can still tamper (local = their machine) but it's cryptographically hard and detectable |
| Enterprise blocking | Medium | Medium | 100% local by default — zero network. Enterprises can use without syncing |
| "More AI" isn't "better" | High | Medium | Frame as "proficiency" not "superiority." Build portfolio proves capability, not just hours |
| npm name conflict | Low | Happened | Published as @devness/useai + useai-dev alias |
| Competitor copies MCP approach | Medium | Low | First-mover + signed chain + verification system + network effects |
| Large chain files | Low | Medium | Per-session isolation keeps files small, JSONL append-only format, in-memory chain tip for O(1) appends |

---

## Key Metrics to Track

### Platform Health
- Daily Active MCP Installs (generating local data)
- Daily syncs received
- Milestones published per week
- Chain verification pass rate

### Engagement
- MCP install → 7-day retention (still generating data after 1 week)
- Sync rate (% of users who sync at least weekly)
- Milestone publish rate (% of milestones that get published)
- Showcase attach rate (% of published milestones with demos)

### Growth
- Organic signups from shared "This is how I UseAI" posts
- MCP install rate from profile pages
- Social media impressions from shared content
- Referral rate (users who invited others)

### Trust
- % of synced data that is 🟢 Verified
- Chain integrity pass rate
- User complaints about data accuracy

---

## Conclusion

useai.dev is a **verified developer portfolio for AI-assisted development** — powered by a local-first MCP server that makes zero network calls, signs every record with Ed25519, and gives the developer complete control over what gets published.

The architecture is built on three principles:

1. **Local-first:** Everything is stored on the developer's machine. The MCP server never touches the network. Stats auto-sync daily in the background; milestones publish only when the developer says so.

2. **Cryptographic integrity:** Every record is hash-chained and Ed25519 signed. Session seals capture the truth. Tampering is detectable at sync time. Verified data earns a green badge.

3. **Developer control:** Auto-sync is opt-out (`useai config --no-sync`). Manual-only milestone publishing. Full transparency dashboard via `useai status`. Export or delete everything at any time.

The product name doubles as the brand message: **"This is how I UseAI."**

The MCP server is already built, published to npm, and ready. Next step: build the CLI with auto-sync daemon, `publish`, `stats`, and `status` commands, then the API backend.
