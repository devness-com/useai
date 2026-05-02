# Security

This document describes UseAI v3's cryptographic design, authentication model, and vulnerability reporting process.

## Ed25519 prompt Chain

Every prompt is part of a hash chain that provides tamper evidence, The chain operates at the prompt level -- there are no individual chain records for start, heartbeat, or end events. A prompt is sealed as one unit when `useai_end` is called.

### How It Works

1. **prompt sealed:** When `useai_end` is called, the entire prompt (all fields except `hash` and `signature`) is serialized to JSON
2. **Hashing:** `SHA-256(prompt_json + prev_hash)` produces the prompt's hash, linking it to the previous prompt
3. **Signing:** The hash is signed with your Ed25519 private key: `Ed25519_sign(hash, private_key)` (PKCS#8 DER format)
4. **Chaining:** The prompt's hash becomes the `prevHash` for the next prompt

This creates an append-only chain. If any prompt is modified, deleted, or reordered, the hash chain breaks and verification fails.

### prompt Structure

```typescript
interface prompt {
  promptId: string;
  connectionId: string;
  client: string;
  taskType: string;
  title: string;
  startedAt: string; // ISO 8601
  endedAt: string; // ISO 8601
  durationMs: number;
  milestones: Milestone[];
  languages?: string[];
  evaluation?: promptEvaluation;
  prevHash: string; // Hash of the previous prompt
  hash: string; // SHA-256(JSON(all_fields_except_hash_signature) + prevHash)
  signature: string; // Ed25519 signature of hash, base64-encoded
  sealVerification?: string; // Cloud seal verification signature (see below)
  // ... additional optional fields
}
```

### Verification

Verification checks two things for each prompt:

1. **Hash integrity:** Recompute `SHA-256(JSON(prompt_without_hash_and_signature) + prevHash)` and compare to the stored `hash`
2. **Signature validity:** Verify the Ed25519 signature over the hash using the public key (SPKI DER format)

Chain verification walks the full sequence and confirms each prompt's `prevHash` matches the previous prompt's `hash`.

## Seal Verification

Seal verification is a cloud-based mechanism that proves a prompt was sealed at a specific point in time. It is the primary mechanism used to determine which prompts count towards the leaderboard.

### How It Works

1. **Client request:** At `useai_end`, the client sends `POST /api/seal` with `{ promptId, timestamp }` to the cloud API. This happens before the local hash is computed, so the seal verification signature is included in the hashed prompt data.
2. **Timestamp validation:** The server checks that the timestamp is within 60 seconds of the current server time. If not, the request is rejected.
3. **Signature generation:** The server generates a random 32-byte key, computes `bcrypt(timestamp + randomKey, cost=10)`, and stores the result.
4. **Storage:** The server stores `{ promptId, randomKey, hash }` in the `seal_verifications` table. A prompt can only be seal-verified once -- duplicate requests are rejected.
5. **Response:** The bcrypt hash is returned to the client as the `signature`.
6. **Client stores:** The client stores the returned signature as the `sealVerification` field on the prompt, which is then included in the hash chain computation.

### What Seal Verification Proves

- The prompt was sealed within 60 seconds of the server's clock
- The prompt ID was seen by the server at that time
- The seal can only happen once per prompt (the server rejects duplicates)

### What Seal Verification Does Not Prove

- It does not validate the prompt's contents, duration, milestones, or evaluation data
- It does not verify the Ed25519 signature or hash chain integrity
- It does not confirm the prompt was actually worked on by a human
- A prompt can be sealed locally without seal verification (if the cloud is unreachable, the prompt is still saved -- it just won't have a `sealVerification` field)

### Leaderboard Impact

Only seal-verified prompts count towards the leaderboard. prompts without a `sealVerification` field are excluded from leaderboard calculations. This prevents backdating prompts or submitting fabricated historical data, since the cloud must witness the seal in real time.

## Key Management

### Key Generation

On first use, UseAI generates an Ed25519 key pair stored in `~/.useai/keystore.json`:

- **Private key:** Generated in PKCS#8 DER format, base64-encoded, stored as plaintext in the file
- **Public key:** Stored as base64-encoded SPKI DER

The keystore file contains:

```json
{
  "publicKey": "base64-encoded SPKI DER public key",
  "privateKey": "base64-encoded PKCS#8 DER private key",
  "createdAt": "ISO timestamp"
}
```

### What Protects the Key

The keystore file is written with permissions `0600` (read/write for the owning user only). Filesystem permissions are the at-rest boundary; the private key itself is not encrypted on disk.

**Why no encryption layer.** The MCP daemon needs the key in cleartext at runtime to sign sealed sessions. Any encryption key would have to be reachable by the daemon — which means any other process running as the same user can reach it too. An "encryption" key colocated with the file it decrypts adds no real protection beyond filesystem permissions; it only adds confusion about what the keystore promises. Real at-rest protection would require OS-level secret storage (macOS Keychain, libsecret, DPAPI) and is not part of the current design.

**What this means in practice:**

- Other users on a shared machine cannot read the key (`0600`).
- Any process running as your user can read the key. This includes the daemon itself, malware running under your account, and anything else with read access to your home directory. Treat your home directory as the trust boundary.
- Backups and sync tools (Time Machine, iCloud Drive, Dropbox, rsync) that capture `~/.useai/keystore.json` capture the key. Use encrypted backup volumes if this matters to you.
- Moving `keystore.json` between machines now works, since there is no machine-specific encryption key.

### Key Registration

You can register your public key with the server (`useai.dev`). This allows the server to verify that synced prompts were signed by your key.

### No Key Rotation

There is no key rotation mechanism. If your keystore is compromised, generate a new one by deleting `~/.useai/keystore.json` and restarting the MCP server. This breaks chain continuity with previously signed prompts.

## Verification Tiers

When prompts are synced to the server, they receive a verification tier:

- **`verified`** -- The user has registered a public key with the server
- **`unverified`** -- No public key registered; signatures cannot be validated server-side

**Honest caveat:** Verification tiers indicate whether a public key exists on the server, but seal verification (described above) is the primary integrity mechanism for the leaderboard. The verification tier alone does not mean the server has validated the Ed25519 signatures on individual prompts. Local verification (checking chain integrity on your machine) works fully.

## Authentication

### Login Flow

UseAI uses OTP (one-time password) authentication:

1. User requests OTP via email at `useai.dev`
2. User enters OTP in CLI (`useai login`)
3. Server returns a JWT token
4. Token is stored locally in `~/.useai/config.json`

### What's Stored

- **JWT token** in `~/.useai/config.json` (used for sync and seal verification API calls)
- **No passwords** -- OTP-only authentication
- **No OAuth tokens** -- UseAI does not connect to GitHub, Google, or other providers

### Token Expiry

JWT tokens have a server-defined expiry. When expired, you'll need to re-authenticate with `useai login`.

## Data Storage

All user data lives in `~/.useai/`:

- **prompts:** `~/.useai/data/YYYY-MM-DD.jsonl` (one file per day, one JSON line per prompt)
- **Config:** `~/.useai/config.json`
- **Keystore:** `~/.useai/keystore.json`
- **PID file:** `~/.useai/daemon.pid`
- **Logs:** `~/.useai/daemon.log`

prompt data is stored locally first and synced to the cloud on a configurable schedule. The cloud stores prompts in a PostgreSQL database.

## Vulnerability Reporting

If you discover a security vulnerability in UseAI, please report it responsibly:

- **Email:** security@useai.dev
- **GitHub:** Open a private security advisory at [github.com/devness-com/useai/security](https://github.com/devness-com/useai/security)

Please do not file public issues for security vulnerabilities. We aim to acknowledge reports within 48 hours and provide a fix timeline within 7 days.
