# Security

This document describes UseAI's cryptographic design, authentication model, and vulnerability reporting process.

## Ed25519 Chain

Every session record is part of a hash chain that provides tamper evidence.

### How It Works

1. **Record creation:** Each record (session_start, heartbeat, session_end, session_seal) is serialized to JSON
2. **Hashing:** `SHA-256(record_json + prev_hash)` produces the record's hash, linking it to the previous record
3. **Signing:** The hash is signed with your Ed25519 private key: `Ed25519_sign(hash, private_key)`
4. **Chaining:** The record's hash becomes the `prev_hash` for the next record

This creates an append-only chain. If any record is modified, deleted, or reordered, the hash chain breaks and verification fails.

### Session Seal

When a session ends, a `session_seal` record captures summary data and two chain anchors:

- `chain_start_hash` -- hash of the first record in the session
- `chain_end_hash` -- hash of the last record
- `seal_signature` -- Ed25519 signature over the seal

The seal provides a compact, verifiable summary of the session without requiring the full chain.

### Chain Record Structure

```typescript
interface ChainRecord {
  id: string;                    // Random record ID (r_xxxxxxxxxxxx)
  type: 'session_start' | 'heartbeat' | 'session_end' | 'session_seal' | 'milestone';
  session_id: string;            // Links to the session
  timestamp: string;             // ISO 8601 timestamp
  data: Record<string, unknown>; // Type-specific payload
  prev_hash: string;             // Hash of the previous record
  hash: string;                  // SHA-256(JSON(core_fields) + prev_hash)
  signature: string;             // Ed25519 signature of hash, or "unsigned"
}
```

## Key Management

### Key Generation

On first use, UseAI generates an Ed25519 key pair:

- **Private key:** Encrypted with AES-256-GCM using a key derived from machine-specific entropy, stored in `~/.useai/keystore.json`
- **Public key:** Stored in PEM format in the same keystore file

The keystore file contains:
```json
{
  "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...",
  "encrypted_private_key": "hex-encoded ciphertext",
  "iv": "hex-encoded 12-byte IV",
  "tag": "hex-encoded GCM auth tag",
  "salt": "hex-encoded 32-byte salt",
  "created_at": "ISO timestamp"
}
```

### Key Registration

You can register your public key with the server (`useai.dev`). This allows the server to verify that synced sessions were signed by your key.

### No Key Rotation

There is currently no key rotation mechanism. If your keystore is compromised, generate a new one by deleting `~/.useai/keystore.json` and restarting the MCP server. Note: this breaks the chain continuity with previously signed records.

## Verification Tiers

When sessions are synced to the server, they receive a verification tier:

- **`verified`** -- The user has registered a public key with the server
- **`unverified`** -- No public key registered; signatures cannot be validated server-side

**Honest caveat:** The server currently stores the verification tier based on whether a public key exists, but does not actively validate individual seal signatures against the registered key during sync. Signature verification is planned but not yet implemented server-side. Local verification (checking chain integrity on your machine) works fully.

## Authentication

### Login Flow

UseAI uses OTP (one-time password) authentication:

1. User requests OTP via email at `useai.dev`
2. User enters OTP in CLI (`useai login`)
3. Server returns a JWT token
4. Token is stored locally in `~/.useai/config.json`

### What's Stored

- **JWT token** in `~/.useai/config.json` (used for sync API calls)
- **No passwords** -- OTP-only authentication
- **No OAuth tokens** -- UseAI does not connect to GitHub, Google, or other providers

### Token Expiry

JWT tokens have a server-defined expiry. When expired, you'll need to re-authenticate with `useai login`.

## Vulnerability Reporting

If you discover a security vulnerability in UseAI, please report it responsibly:

- **Email:** security@useai.dev
- **GitHub:** Open a private security advisory at [github.com/devness/useai/security](https://github.com/devness/useai/security)

Please do not file public issues for security vulnerabilities. We aim to acknowledge reports within 48 hours and provide a fix timeline within 7 days.
