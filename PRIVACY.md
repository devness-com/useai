# Privacy & Data Transparency

UseAI is local-first by architecture. The MCP server writes to disk and makes zero network calls. Data only leaves your machine when you explicitly choose to sync.

This document describes every field UseAI captures, where it's stored, what happens when you sync, and what controls you have.

## What's Tracked

### Session Metadata

| Field | Description | Synced to cloud |
|-------|-------------|:---:|
| `session_id` | Random UUID identifying the session | Yes |
| `client` | Which AI tool (e.g. "claude", "cursor") | Yes |
| `task_type` | Category: coding, debugging, testing, planning, reviewing, documenting, learning, other | Yes |
| `model` | AI model ID (e.g. "claude-sonnet-4-6") | Yes |
| `started_at` | ISO timestamp when session began | Yes |
| `ended_at` | ISO timestamp when session ended | Yes |
| `duration_seconds` | Total session length in seconds | Yes |
| `heartbeat_count` | Number of keep-alive pings during the session | Yes |
| `record_count` | Number of chain records in the session | Yes |

### Project Context

| Field | Description | Synced to cloud |
|-------|-------------|:---:|
| `project` | Project name (typically the root directory name of the codebase) | Yes |
| `languages` | Programming languages used (e.g. ["typescript", "python"]) | Yes |
| `files_touched` | Count of files created or modified (number only, never file names) | Yes |

### Titles

UseAI captures two title fields with different privacy expectations:

| Field | Description | Synced to cloud | Publicly visible |
|-------|-------------|:---:|:---:|
| `title` | Generic public description with no project names or identifying details | Yes | Yes (on profile) |
| `private_title` | Detailed description that may include project names and specifics | Yes | No |

The MCP server instructions tell AI tools to keep `title` generic (e.g. "Fix authentication bug") while `private_title` can include specifics (e.g. "Fix JWT refresh in Acme login flow"). **Both fields are sent to the server when you sync.** Only `title` appears on public profiles.

### Evaluation Metrics

Self-assessed scores recorded at session end:

| Field | Description | Synced to cloud |
|-------|-------------|:---:|
| `evaluation.prompt_quality` | 1-5: clarity of the initial request | Yes |
| `evaluation.prompt_quality_reason` | Why this score was given + improvement tip | Yes |
| `evaluation.context_provided` | 1-5: did user provide files, errors, constraints? | Yes |
| `evaluation.context_provided_reason` | Why this score was given | Yes |
| `evaluation.task_outcome` | completed, partial, abandoned, or blocked | Yes |
| `evaluation.task_outcome_reason` | Why the task wasn't completed | Yes |
| `evaluation.iteration_count` | Number of user-to-AI turns | Yes |
| `evaluation.independence_level` | 1-5: how self-directed was the user? | Yes |
| `evaluation.independence_level_reason` | Why this score was given | Yes |
| `evaluation.scope_quality` | 1-5: was the task well-scoped? | Yes |
| `evaluation.scope_quality_reason` | Why this score was given | Yes |
| `evaluation.tools_leveraged` | Count of distinct AI capabilities used | Yes |

### Internal Fields

| Field | Description | Synced to cloud |
|-------|-------------|:---:|
| `conversation_id` | Opaque ID linking records to the same conversation | Yes |
| `conversation_index` | Sequence number within a conversation | Yes |
| `prompt_word_count` | Approximate word count of the user's initial prompt | Yes |

### Milestone Fields

Milestones describe individual accomplishments within a session:

| Field | Description | Synced to cloud | Publicly visible |
|-------|-------------|:---:|:---:|
| `id` | Random milestone ID | Yes | No |
| `session_id` | Links milestone to its session | Yes | No |
| `title` | Generic public description (no project names) | Yes | Yes |
| `private_title` | Detailed description (may include project names) | Yes | No |
| `project` | Project name | Yes | No |
| `category` | feature, bugfix, refactor, test, docs, setup, deployment, other | Yes | Yes |
| `complexity` | simple, medium, complex | Yes | Yes |
| `duration_minutes` | Estimated time for this milestone | Yes | No |
| `languages` | Languages used | Yes | No |
| `client` | AI tool used | Yes | No |
| `created_at` | Timestamp | Yes | Yes |
| `published` | Whether this milestone was published | Yes | No |
| `published_at` | When it was published | Yes | No |
| `chain_hash` | Hash linking this record to the chain | Yes | No |

### Cryptographic Fields

| Field | Description | Synced to cloud |
|-------|-------------|:---:|
| `chain_start_hash` | SHA-256 hash of the first record in the session | Yes |
| `chain_end_hash` | SHA-256 hash of the last record in the session | Yes |
| `seal_signature` | Ed25519 signature over the session seal | Yes |

These enable tamper evidence. See [SECURITY.md](SECURITY.md) for details.

## What's Never Tracked

UseAI never captures any of the following:

- **Your code** -- source code, diffs, patches, or snippets
- **Your prompts** -- what you ask the AI
- **AI responses** -- what the AI generates
- **File names or paths** -- only the count of files touched
- **Directory structure** -- no tree or layout information
- **Git history** -- no commits, branches, or diffs
- **Credentials** -- no API keys, tokens, passwords, or secrets
- **Screen content** -- no screenshots or terminal output

You can verify this by auditing the MCP tool handlers in [`packages/mcp/src/tools/`](packages/mcp/src/tools/).

## Where Data Lives Locally

All data is stored in `~/.useai/` on your machine:

```
~/.useai/
  keystore.json          # Ed25519 key pair (private key encrypted with AES-256-GCM)
  config.json            # Settings, auth token (if logged in), sync preferences
  daemon.pid             # PID of the background daemon (if running)
  daemon.log             # Daemon logs
  data/
    active/              # In-progress session chain records (JSONL files)
    sealed/              # Completed session chain records (JSONL files)
    sessions.json        # Array of SessionSeal objects (completed sessions)
    milestones.json      # Array of Milestone objects
```

All files are plain JSON or JSONL. You can inspect them with any text editor or `jq`.

## Cloud Sync (Opt-in)

If you never authenticate (`useai login`), the MCP server makes zero network calls and all data stays local. Cloud sync is entirely opt-in.

### What Happens When You Sync

When you run `useai sync`, two HTTP requests are made:

**1. `POST /api/sync`** -- sends the full `sessions.json` array:
```json
{
  "sessions": [
    {
      "session_id": "...",
      "conversation_id": "...",
      "conversation_index": 0,
      "client": "claude",
      "task_type": "coding",
      "languages": ["typescript"],
      "files_touched": 5,
      "project": "my-project",
      "title": "Fix authentication bug",
      "private_title": "Fix JWT refresh in Acme login flow",
      "prompt_word_count": 42,
      "model": "claude-sonnet-4-6",
      "evaluation": { "..." },
      "started_at": "2026-01-15T10:00:00Z",
      "ended_at": "2026-01-15T10:30:00Z",
      "duration_seconds": 1800,
      "heartbeat_count": 3,
      "record_count": 5,
      "chain_start_hash": "abc...",
      "chain_end_hash": "def...",
      "seal_signature": "..."
    }
  ]
}
```

**Important:** This sends full session records, not aggregates. Fields including `private_title` and `project` are included in the payload.

**2. `POST /api/publish`** -- sends the full `milestones.json` array:
```json
{
  "milestones": [
    {
      "id": "...",
      "session_id": "...",
      "title": "Fix authentication bug",
      "private_title": "Fix JWT refresh in Acme login flow",
      "project": "my-project",
      "category": "bugfix",
      "complexity": "medium",
      "duration_minutes": 30,
      "languages": ["typescript"],
      "client": "claude",
      "created_at": "2026-01-15T10:30:00Z",
      "published": true,
      "published_at": "2026-01-15T10:30:00Z",
      "chain_hash": "..."
    }
  ]
}
```

### Server-Side Storage

- **Database:** PostgreSQL
- **Sessions:** Stored individually with all fields shown above, including `private_title` and `project`
- **Daily aggregates:** Computed from sessions (total seconds, client/task_type/language breakdowns)
- **Deduplication:** Sessions are deduplicated by `session_id` -- syncing the same session twice won't create duplicates

### What's Publicly Visible

On your public profile (useai.dev/u/username), only:

- Public `title` (never `private_title`)
- `category` (bugfix, feature, etc.)
- `complexity` (simple, medium, complex)
- `created_at` date
- Aggregate stats: total hours, streak length, top languages

### What Admins Can See

The admin dashboard has access to the full session table, including `private_title`, `project`, evaluation scores, and all other synced fields. This is used for moderation (flagging inappropriate milestones) and system health monitoring.

### Data Retention

Synced data is currently stored indefinitely. There is no automatic expiration or TTL policy. A data deletion API is planned but not yet available.

## Leaderboard

The leaderboard at useai.dev ranks users by two dimensions:

- **Hours:** Total AI coding hours from synced daily aggregates
- **Streak:** Current consecutive days of activity

The leaderboard is recomputed nightly (midnight UTC). Only users who have synced at least once appear on it. The scope is global only. No code, titles, or session details are exposed through the leaderboard -- only username, display name, avatar, and scores.

## Your Controls

### Inspect all data locally
```bash
useai status              # Summary of what's stored
useai stats               # Streaks, hours, tools, languages
useai export              # Export all data
cat ~/.useai/data/sessions.json | jq   # Raw session data
```

### Delete data locally
```bash
useai purge               # Delete all local data
```

You can also delete individual JSONL files from `~/.useai/data/sealed/` or edit `sessions.json` directly.

### Never sync
Don't authenticate. The MCP server runs 100% locally and makes zero network calls unless you run `useai login` + `useai sync`.

### Server-side deletion
There is no server-side deletion API yet. This is planned. If you need data removed, contact support.

## Cryptographic Verification

Every session record is part of an Ed25519 signed hash chain. This provides tamper evidence -- if any record is modified or deleted, the chain breaks. See [SECURITY.md](SECURITY.md) for the full cryptographic design.

## Cloud Code Transparency

The UseAI MCP server, CLI, and all client-side code are open source and auditable.

The cloud API (useai.dev backend) is **not open source**. This means you cannot directly audit how the server processes your data after sync. To compensate:

- This document describes the server's behavior as accurately as possible, based on the actual implementation
- The sync payload sections above show exactly what leaves your machine
- The public profile section documents exactly what's exposed publicly
- We commit to keeping this document updated when server behavior changes

If you have questions about server-side data handling, open an issue or contact us.
