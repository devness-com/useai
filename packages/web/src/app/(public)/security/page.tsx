import {
  Fingerprint,
  Link2,
  Key,
  ShieldCheck,
  AlertTriangle,
  Mail,
  Github,
  Lock,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const CHAIN_STEPS = [
  {
    step: 'Record',
    description: 'Each record (session_start, heartbeat, session_end, session_seal) is serialized to JSON.',
  },
  {
    step: 'Hash',
    description: 'SHA-256(record_json + prev_hash) produces the record\'s hash, linking it to the previous record.',
  },
  {
    step: 'Sign',
    description: 'The hash is signed with your Ed25519 private key: Ed25519_sign(hash, private_key).',
  },
  {
    step: 'Chain',
    description: 'The record\'s hash becomes the prev_hash for the next record, forming an append-only chain.',
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12">

        {/* Page Header */}
        <div className="mb-16 max-w-3xl">
          <div className="text-[10px] font-mono tracking-widest text-accent mb-3 border-l-2 border-accent pl-2">SECURITY</div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-text-primary mb-4">
            Security <span className="gradient-text-accent">Policy</span>
          </h1>
          <p className="text-sm sm:text-base text-text-muted leading-relaxed">
            UseAI&apos;s cryptographic design, authentication model, and vulnerability reporting process.
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  ED25519 CHAIN                                              */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">CRYPTO</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Ed25519 Hash Chain</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed">
              Every session record is part of a hash chain that provides tamper evidence. If any record
              is modified, deleted, or reordered, the hash chain breaks and verification fails.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {CHAIN_STEPS.map((item, idx) => (
              <div key={item.step} className="hud-border rounded-xl p-5 bg-bg-surface-1/80 relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono font-bold text-accent bg-[var(--accent-alpha)] px-2 py-0.5 rounded-md border border-accent/20">
                    0{idx + 1}
                  </span>
                  <h4 className="text-base font-bold text-text-primary">{item.step}</h4>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{item.description}</p>
                {idx < CHAIN_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-2.5 text-accent/40 text-lg">&rarr;</div>
                )}
              </div>
            ))}
          </div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <h4 className="text-sm font-bold text-text-primary mb-3">Session Seal</h4>
            <p className="text-xs text-text-muted leading-relaxed mb-3">
              When a session ends, a <code className="text-accent font-mono text-xs">session_seal</code> record
              captures summary data and two chain anchors:
            </p>
            <div className="bg-bg-surface-2 rounded-lg p-4 font-mono text-xs text-text-secondary space-y-1">
              <div><span className="text-accent">chain_start_hash</span> — hash of the first record in the session</div>
              <div><span className="text-accent">chain_end_hash</span> — hash of the last record</div>
              <div><span className="text-accent">seal_signature</span> — Ed25519 signature over the seal</div>
            </div>
            <p className="text-xs text-text-muted mt-3">
              The seal provides a compact, verifiable summary of the session without requiring the full chain.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  KEY MANAGEMENT                                             */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">KEYS</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Key Management</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 shrink-0">
                  <Key className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-mono font-bold text-sm text-text-primary">KEY GENERATION</h4>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                On first use, UseAI generates an Ed25519 key pair. The private key is encrypted with
                AES-256-GCM using machine-specific entropy and stored in{' '}
                <code className="text-accent font-mono text-xs">~/.useai/keystore.json</code>.
              </p>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-mono font-bold text-sm text-text-primary">KEY REGISTRATION</h4>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                You can register your public key with the server. This allows the server to verify
                that synced sessions were signed by your key, enabling the verified badge on your profile.
              </p>
            </div>
          </div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <h4 className="text-sm font-bold text-text-primary mb-3">Keystore Structure</h4>
            <div className="bg-bg-surface-2 rounded-lg p-4 font-mono text-xs text-text-secondary space-y-1">
              <div>{'{'}</div>
              <div className="ml-4"><span className="text-accent">&quot;public_key_pem&quot;</span>: <span className="text-text-muted">&quot;-----BEGIN PUBLIC KEY-----\\n...&quot;</span></div>
              <div className="ml-4"><span className="text-accent">&quot;encrypted_private_key&quot;</span>: <span className="text-text-muted">&quot;hex-encoded ciphertext&quot;</span></div>
              <div className="ml-4"><span className="text-accent">&quot;iv&quot;</span>: <span className="text-text-muted">&quot;hex-encoded 12-byte IV&quot;</span></div>
              <div className="ml-4"><span className="text-accent">&quot;tag&quot;</span>: <span className="text-text-muted">&quot;hex-encoded GCM auth tag&quot;</span></div>
              <div className="ml-4"><span className="text-accent">&quot;salt&quot;</span>: <span className="text-text-muted">&quot;hex-encoded 32-byte salt&quot;</span></div>
              <div className="ml-4"><span className="text-accent">&quot;created_at&quot;</span>: <span className="text-text-muted">&quot;ISO timestamp&quot;</span></div>
              <div>{'}'}</div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  VERIFICATION TIERS                                         */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">VERIFICATION</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Verification Tiers</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full bg-accent shrink-0" />
                <h4 className="font-mono font-bold text-sm text-text-primary">VERIFIED</h4>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                The user has registered a public key with the server. Ed25519 signatures are valid and
                the hash chain is intact.
              </p>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full bg-text-muted shrink-0" />
                <h4 className="font-mono font-bold text-sm text-text-primary">UNVERIFIED</h4>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                No public key registered. Signatures cannot be validated server-side. Could be from
                an older version or an unsigned session.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  AUTHENTICATION                                             */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">AUTH</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Authentication</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              UseAI uses OTP (one-time password) authentication:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {[
                { step: '01', title: 'Request OTP', description: 'User requests a one-time password via email at useai.dev' },
                { step: '02', title: 'Enter OTP', description: 'User enters the OTP in the CLI (useai login)' },
                { step: '03', title: 'JWT Token', description: 'Server returns a JWT token stored locally in ~/.useai/config.json' },
              ].map((item) => (
                <div key={item.step} className="bg-bg-surface-2 rounded-lg p-4">
                  <span className="text-xs font-mono font-bold text-accent">{item.step}</span>
                  <h4 className="text-sm font-bold text-text-primary mt-1 mb-1">{item.title}</h4>
                  <p className="text-xs text-text-muted">{item.description}</p>
                </div>
              ))}
            </div>
            <ul className="space-y-1.5 text-xs text-text-muted">
              <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> No passwords are stored — OTP-only authentication</li>
              <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> No OAuth tokens — UseAI does not connect to GitHub, Google, or other providers</li>
              <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> JWT tokens have server-defined expiry; re-authenticate with useai login when expired</li>
            </ul>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  VULNERABILITY REPORTING                                    */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">REPORT</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Vulnerability Reporting</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-8">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-streak shrink-0 mt-0.5" />
              <p className="text-sm text-text-muted leading-relaxed">
                If you discover a security vulnerability in UseAI, please report it responsibly.
                Do not file public issues for security vulnerabilities.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-bg-surface-2 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-accent" />
                  <h4 className="text-sm font-bold text-text-primary">Email</h4>
                </div>
                <a href="mailto:security@useai.dev" className="text-sm text-accent hover:text-accent-bright border-b border-accent/30">
                  security@useai.dev
                </a>
              </div>
              <div className="bg-bg-surface-2 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Github className="w-4 h-4 text-accent" />
                  <h4 className="text-sm font-bold text-text-primary">GitHub</h4>
                </div>
                <a
                  href="https://github.com/devness-com/useai/security"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:text-accent-bright border-b border-accent/30"
                >
                  Private security advisory
                </a>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-4">
              We aim to acknowledge reports within 48 hours and provide a fix timeline within 7 days.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
