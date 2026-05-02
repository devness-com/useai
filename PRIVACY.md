# Privacy & Data Transparency

UseAI is local-first by architecture. The MCP server writes to disk and makes one network call per session (seal verification, explained below). Data only leaves your machine in bulk when you explicitly choose to sync.

This document describes every field UseAI captures, where it's stored, what happens when you sync, and what controls you have.

## What's Tracked

### Session Metadata

| Field | Description | Synced to cloud |
|-------|-------------|:---:|
| `promptId` | Random UUID identifying the session | Yes |
| `connectionId` | Opaque ID linking sessions from the same MCP connection | Yes |
| `client` | Which AI tool (e.g. "claude", "cursor") | Yes |
| `taskType` | Category of work (coding, debugging, testing, planning, reviewing, documenting, learning, deployment, devops, research, migration, design, data, security, configuration, code_review, investigation, infrastructure, analysis, ops, setup, refactoring, other) | Yes |
| `model` | AI model ID (e.g. "claude-sonnet-4-6") | Yes |
| `startedAt` | ISO timestamp when session began | Yes |
| `endedAt` | ISO timestamp when session ended | Yes |
| `durationMs` | Active session duration in milliseconds (idle time subtracted) | Yes (stored as seconds in cloud DB) |
| `activeSegments` | Array of `[isoStart, isoEnd]` pairs representing active time windows. Gaps between segments were idle periods (>5min without a heartbeat). | Yes |
| `promptImageCount` | Number of images attached to the prompt (count only, no image data) | Yes |

### Project Context

| Field | Description | Synced to cloud |
|-------|-------------|:---:|
| `project` | Project name (typically the root directory name of the codebase) | Yes |
| `languages` | Programming languages used (e.g. `["typescript", "python"]`) | Yes |
| `filesTouchedCount` | Count of files created or modified (number only, never file names) | Yes |

### Titles

UseAI captures two title fields:

| Field | Description | Synced to cloud | Visible to owner on cloud | Visible on public profile |
|-------|-------------|:---:|:---:|:---:|
| `title` | Generic description (e.g. "Fix authentication bug") | Yes | Yes | No |
| `privateTitle` | Detailed description (e.g. "Fix JWT refresh in Acme login flow") | Yes | Yes | No |

**Both fields are sent to the server when you sync.** Both are visible to you on your cloud dashboard. Neither appears on your public profile — public profiles show only aggregate statistics, charts, and badges, never individual titles.

### Evaluation Metrics

Self-assessed scores recorded at session end:

| Field | Description | Synced to cloud |
|-------|-------------|:---:|
| `evaluation.promptQuality` | 1-5: clarity of the initial request | Yes (always) |
| `evaluation.promptQualityReason` | Why this score was given + improvement tip | Controlled by setting |
| `evaluation.promptQualityIdeal` | What would make this score 5/5 | Controlled by setting |
| `evaluation.contextProvided` | 1-5: did user provide files, errors, constraints? | Yes (always) |
| `evaluation.contextProvidedReason` | Why this score was given | Controlled by setting |
| `evaluation.contextProvidedIdeal` | What would make this score 5/5 | Controlled by setting |
| `evaluation.taskOutcome` | completed, partial, abandoned, or blocked | Yes (always) |
| `evaluation.taskOutcomeReason` | Why the task wasn't completed | Controlled by setting |
| `evaluation.taskOutcomeIdeal` | What would have made the outcome better | Controlled by setting |
| `evaluation.iterationCount` | Number of times the user prompted for the same task | Yes (always) |
| `evaluation.independenceLevel` | 1-5: how self-directed was the user? | Yes (always) |
| `evaluation.independenceLevelReason` | Why this score was given | Controlled by setting |
| `evaluation.independenceLevelIdeal` | What would make this score 5/5 | Controlled by setting |
| `evaluation.scopeQuality` | 1-5: was the task well-scoped? | Yes (always) |
| `evaluation.scopeQualityReason` | Why this score was given | Controlled by setting |
| `evaluation.scopeQualityIdeal` | What would make this score 5/5 | Controlled by setting |
| `evaluation.toolsLeveraged` | Count of distinct AI capabilities used | Yes (always) |

**Evaluation reasons sync control:** The `sync.evaluationReasons` setting controls whether reason/ideal text fields are included during sync. Numeric scores are always synced. Options:
- `"none"` (default) -- only numeric scores and `taskOutcome` are synced, no reason or ideal text
- `"belowPerfect"` -- reasons and ideals are synced only for metrics scoring below 5/5 (or non-completed outcomes)
- `"all"` -- all reason and ideal text is synced

### Milestones

Milestones describe individual accomplishments within a session. They are embedded directly in the session object during sync (there is no separate publish endpoint).

| Field | Description | Synced to cloud | Visible to owner on cloud | Visible on public profile |
|-------|-------------|:---:|:---:|:---:|
| `id` | Random milestone ID | Yes | Yes | No |
| `title` | Generic description | Yes | Yes | No |
| `privateTitle` | Detailed description (may include project names) | Yes | Yes | No |
| `category` | feature, bugfix, refactor, testing, docs, etc. | Yes | Yes | No |
| `complexity` | simple, medium, or complex | Yes | Yes | No |

Milestones no longer have their own `project`, `languages`, `client`, `duration_minutes`, `duration_seconds`, or `chain_hash` fields -- those columns were dropped from the cloud database. Milestone context is inherited from the parent session.

### Cryptographic Fields

| Field | Description | Synced to cloud |
|-------|-------------|:---:|
| `prevHash` | SHA-256 hash of the previous record in the chain | Yes |
| `hash` | SHA-256 hash of this session record | Yes |
| `signature` | Ed25519 signature over the session seal | Yes |
| `sealVerification` | Cloud-issued bcrypt signature confirming real-time seal (see below) | Yes |

These enable tamper evidence. See [SECURITY.md](SECURITY.md) for details.

### Seal Verification

At `useai_end` time, the MCP server makes a single network call:

**`POST https://useai.dev/api/seal`** with `{ sessionId, timestamp }`.

The cloud server validates that the timestamp is within 60 seconds of the current time, generates a random key, computes a bcrypt hash of `timestamp + randomKey`, stores the random key and hash server-side, and returns the bcrypt hash as a `signature`. This signature is stored as `sealVerification` on the local session.

This proves the session was sealed in real time (not backdated). Sessions with seal verification are marked as verified on public profiles, and the leaderboard only counts seal-verified sessions.

**What the seal endpoint receives:** Only the `promptId` and the `endedAt` ISO timestamp. No session content, titles, evaluation data, or project information is sent to this endpoint. If you are authenticated, the auth token is included in the request header so the cloud can associate the seal with your account.

**If the call fails** (network error, timeout, server down), the session is still sealed locally -- it just won't have a `sealVerification` field. The call has a 5-second timeout and failures are silently ignored.

### Prompt Capture (Opt-in)

Two optional capture settings exist in `config.json`:

| Setting | Default | What it captures |
|---------|---------|-----------------|
| `capture.prompt` | `false` | The user's initial prompt text |
| `capture.promptImages` | `false` | Metadata about images attached to the prompt (AI-generated descriptions only, never the actual image binary data) |

When enabled, these fields are stored in local session files. The `prompt` field is **never synced to the cloud** -- it is stripped from the payload before sending. Prompt image metadata (`promptImages`) is also local-only.

## What's Never Tracked

UseAI never captures any of the following:

- **Your code** -- source code, diffs, patches, or snippets
- **AI responses** -- what the AI generates
- **File names or paths** -- only the count of files touched
- **Directory structure** -- no tree or layout information
- **Git history** -- no commits, branches, or diffs
- **Credentials** -- no API keys, tokens, passwords, or secrets
- **Screen content** -- no screenshots or terminal output
- **Image content** -- if prompt image capture is enabled, only AI-generated text descriptions are stored, never the actual image data

Your prompts are captured locally only if you explicitly enable `capture.prompt`, and they are never sent to the cloud even then.

You can verify this by auditing the MCP tool handlers in [`packages/mcp-server/src/mcp-tools/`](packages/mcp-server/src/mcp-tools/).

## Where Data Lives Locally

All data is stored in `~/.useai/` on your machine:

```
~/.useai/
  keystore.json          # Ed25519 key pair (file mode 0600; see SECURITY.md)
  config.json            # Settings, auth token (if logged in), sync preferences
  daemon.pid             # PID of the background daemon (if running)
  daemon.log             # Daemon logs
  sync-log.json          # Record of sync operations
  data/
    sealed/
      YYYY-MM-DD.jsonl   # Completed sessions for that date (one JSON object per line)
```

All files are plain JSON or JSONL. You can inspect them with any text editor or `jq`.

## Cloud Sync (Opt-in)

If you never authenticate (`useai login`), the only network call made is the seal verification POST described above (which sends only a session ID and timestamp). Cloud sync is entirely opt-in.

### What Happens When You Sync

When you run `useai sync` (or auto-sync triggers), one HTTP request is made:

**`POST /api/sync`** -- sends an array of per-date batch payloads:
```json
[
  {
    "date": "2026-04-23",
    "streakDays": 15,
    "sessions": [
      {
        "promptId": "abc-123",
        "connectionId": "conn-456",
        "client": "claude",
        "taskType": "coding",
        "title": "Fix authentication bug",
        "privateTitle": "Fix JWT refresh in Acme login flow",
        "project": "my-project",
        "model": "claude-sonnet-4-6",
        "startedAt": "2026-04-23T10:00:00Z",
        "endedAt": "2026-04-23T10:30:00Z",
        "durationMs": 1500000,
        "activeSegments": [
          ["2026-04-23T10:00:00Z", "2026-04-23T10:12:00Z"],
          ["2026-04-23T10:18:00Z", "2026-04-23T10:30:00Z"]
        ],
        "languages": ["typescript"],
        "filesTouchedCount": 5,
        "promptImageCount": 0,
        "evaluation": {
          "promptQuality": 4,
          "contextProvided": 5,
          "scopeQuality": 4,
          "independenceLevel": 5,
          "taskOutcome": "completed",
          "iterationCount": 1,
          "toolsLeveraged": 8
        },
        "milestones": [
          {
            "id": "mil_abc",
            "title": "Implemented auth flow",
            "privateTitle": "Added OAuth2 to UserService",
            "category": "feature",
            "complexity": "medium"
          }
        ],
        "prevHash": "abc...",
        "hash": "def...",
        "signature": "..."
      }
    ]
  }
]
```

**Important:** This sends full session records, not aggregates. Fields including `privateTitle` and `project` are included in the payload. The `prompt` field (your actual prompt text) is always stripped before sending, even if captured locally.

Evaluation reason/ideal text fields are included or excluded based on your `sync.evaluationReasons` setting (default: `"none"`, meaning only numeric scores are sent).

### Server-Side Storage

- **Database:** PostgreSQL
- **Sessions:** Stored individually with all synced fields. Duration is converted from milliseconds to seconds for storage. The `sessionId` field is used for deduplication -- syncing the same session twice won't create duplicates.
- **Milestones:** Extracted from sessions and stored in a separate table with `userId`, `sessionId`, `title`, `privateTitle`, `category`, `complexity`, and timestamps. Deduplicated by `(userId, sessionId, title)`.
- **Seal verifications:** Stored in a separate table with `sessionId`, `randomKey`, and `hash`.
- **Streaks:** Current and longest streaks are tracked per user.
- **Leaderboard:** Computed rankings stored with dimension, scope, rank, and score.
- **Badges:** Earned badges stored with category and award date.
- **No daily_syncs table:** Unlike v1, there is no separate daily aggregation table. Aggregates are computed on the fly from session data.

### What's Publicly Visible

On your public profile (useai.dev/u/username), only aggregate statistics are shown:

- **Clock time and AI time** -- total hours (clock time deduplicates overlapping sessions; AI time stacks parallel sessions)
- **AI multiplier** -- AI time divided by clock time
- **Total prompts** -- count of sessions including subagent prompts
- **Streak** -- current and longest consecutive days
- **Peak parallel** -- most concurrent sessions at once
- **Activity heatmap** -- daily hours over time (no titles or details)
- **AI proficiency bars** -- average prompt quality, context, scope, and independence scores (1-5)
- **Skill radar** -- pentagon chart with volume, quality, parallelism, consistency, and complexity axes
- **Complexity distribution** -- count of simple/medium/complex milestones
- **Language, tool, and task type breakdowns** -- donut charts showing proportions
- **Badges** -- earned achievements with category and award date
- **Verification status** -- whether >80% of sessions are seal-verified

**Not shown on public profiles:** Individual session titles (neither `title` nor `privateTitle`), milestone titles, project names, evaluation reasons/ideals, file counts, model names, or any session-level detail.

### What Admins Can See

The admin dashboard has access to the full session and milestone tables, including `privateTitle`, `project`, evaluation scores and reasons, and all other synced fields. This is used for moderation (flagging inappropriate content) and system health monitoring.

### Data Retention

Synced data is currently stored indefinitely. There is no automatic expiration or TTL policy. A data deletion API is planned but not yet available.

## Leaderboard

The leaderboard at useai.dev ranks users by multiple dimensions:

- **Hours:** Total AI coding hours
- **Streak:** Current consecutive days of activity

The leaderboard only counts **seal-verified sessions** -- sessions that received a `sealVerification` signature at seal time. This prevents backdating or fabricating session data. Only users who have synced at least once appear on the leaderboard. No code, titles, or session details are exposed through the leaderboard -- only username, display name, avatar, and scores.

### APS Score

The APS (AI Productivity Score) is a composite metric ranging from 0 to 1000, computed from five components:

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| Output | 25% | Volume of AI work (hours, sessions, milestones) |
| Efficiency | 25% | Session quality and parallelism |
| Prompt Quality | 20% | Average evaluation scores |
| Consistency | 15% | Regularity of activity over time |
| Breadth | 15% | Diversity of languages, tools, and task types |

## Your Controls

### Inspect all data locally
```bash
useai status              # Summary of what's stored
useai stats               # Streaks, hours, tools, languages
useai export              # Export all data
cat ~/.useai/data/sealed/2026-04-23.jsonl | jq   # Raw session data for a specific date
```

### Delete data locally
```bash
useai purge               # Delete all local data
```

You can also delete individual JSONL files from `~/.useai/data/sealed/` or remove specific lines from them.

### Control what's synced
In `config.json` under `sync`:
- `evaluationReasons`: `"none"` (default), `"belowPerfect"`, or `"all"` -- controls whether evaluation reason/ideal text is included in sync payloads

### Never sync
Don't authenticate. The MCP server runs locally and the only network call it makes is the seal verification POST (which sends only a session ID and timestamp, no content). If you want zero network calls, set `USEAI_API_URL` to a nonexistent address or block outbound requests to `useai.dev`.

### Server-side deletion
There is no server-side deletion API yet. This is planned. If you need data removed, contact support.

## Cryptographic Verification

Every session record is part of an Ed25519 signed hash chain. This provides tamper evidence -- if any record is modified or deleted, the chain breaks. See [SECURITY.md](SECURITY.md) for the full cryptographic design.

## Cloud Code Transparency

The UseAI MCP server, CLI, daemon, and all client-side code are open source and auditable.

The cloud API (useai.dev backend) is **not open source**. It lives in a separate private repository. This means you cannot directly audit how the server processes your data after sync. To compensate:

- This document describes the server's behavior as accurately as possible, based on the actual implementation
- The sync payload sections above show exactly what leaves your machine
- The public profile section documents exactly what's exposed publicly
- The seal verification section explains the only non-sync network call
- We commit to keeping this document updated when server behavior changes

If you have questions about server-side data handling, open an issue or contact us.
