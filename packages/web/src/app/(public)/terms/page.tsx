import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-12">

        {/* Page Header */}
        <div className="mb-16 max-w-3xl">
          <div className="text-[10px] font-mono tracking-widest text-accent mb-3 border-l-2 border-accent pl-2">LEGAL</div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-text-primary mb-4">
            Terms of <span className="gradient-text-accent">Service</span>
          </h1>
          <p className="text-xs text-text-muted font-mono">
            Last updated: February 2026 &middot; Effective immediately
          </p>
        </div>

        {/* Content */}
        <div className="space-y-16">

          {/* Section 1 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">01</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Acceptance of Terms</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                By accessing or using UseAI (the &ldquo;Service&rdquo;), including the website at useai.dev,
                the MCP server, CLI tools, dashboard, and any related services operated by Devness Network
                (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), you agree to be bound by these
                Terms of Service (&ldquo;Terms&rdquo;).
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                If you do not agree to these Terms, do not use the Service. We may update these Terms
                from time to time. Continued use of the Service after changes constitutes acceptance
                of the updated Terms.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">02</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Service Description</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                UseAI is a privacy-first MCP (Model Context Protocol) server that tracks AI-assisted
                development workflow metrics. The Service includes:
              </p>
              <ul className="space-y-1.5 text-sm text-text-muted ml-4 mb-3">
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> <span><span className="text-text-primary">MCP Server</span> — locally-installed software that records AI coding session metadata</span></li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> <span><span className="text-text-primary">CLI Tool</span> — command-line interface for viewing stats, managing settings, and syncing data</span></li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> <span><span className="text-text-primary">Dashboard</span> — local and cloud-hosted analytics interface</span></li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> <span><span className="text-text-primary">Website</span> — useai.dev, including public profiles, leaderboards, and documentation</span></li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> <span><span className="text-text-primary">Cloud API</span> — optional sync and storage service for session data</span></li>
              </ul>
              <p className="text-sm text-text-muted leading-relaxed">
                The MCP server and CLI are open source under the MIT license. The cloud API and website
                backend are proprietary.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">03</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Account Registration</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                You may use the MCP server and CLI without creating an account. An account is required
                only for cloud features such as syncing data, public profiles, and leaderboards.
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                When creating an account, you agree to provide accurate information and keep your
                account credentials secure. You are responsible for all activity under your account.
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                We use OTP (one-time password) authentication via email. No passwords are stored.
                You may delete your account at any time by contacting us.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">04</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Acceptable Use</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                You agree to use the Service lawfully and responsibly. You shall not:
              </p>
              <ul className="space-y-1.5 text-sm text-text-muted ml-4">
                <li className="flex items-start gap-2"><span className="text-error shrink-0">&times;</span> Manipulate or fabricate session data to inflate metrics, scores, or leaderboard rankings</li>
                <li className="flex items-start gap-2"><span className="text-error shrink-0">&times;</span> Attempt to impersonate other users or misrepresent your identity</li>
                <li className="flex items-start gap-2"><span className="text-error shrink-0">&times;</span> Use automated systems to generate artificial session activity</li>
                <li className="flex items-start gap-2"><span className="text-error shrink-0">&times;</span> Reverse engineer, decompile, or attempt to extract the source code of the cloud API</li>
                <li className="flex items-start gap-2"><span className="text-error shrink-0">&times;</span> Interfere with or disrupt the Service or servers</li>
                <li className="flex items-start gap-2"><span className="text-error shrink-0">&times;</span> Publish offensive, harmful, or misleading content through milestone titles or profile information</li>
                <li className="flex items-start gap-2"><span className="text-error shrink-0">&times;</span> Use the Service to violate any applicable law or regulation</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">05</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Data & Privacy</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                Your use of the Service is also governed by our{' '}
                <Link href="/privacy" className="text-accent hover:text-accent-bright border-b border-accent/30">
                  Privacy Policy
                </Link>
                , which describes what data is collected, how it&apos;s stored, and your rights regarding that data.
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                <span className="text-text-primary font-bold">Data ownership:</span> You retain ownership of all data
                generated by the MCP server on your machine. Session data stored locally in{' '}
                <code className="text-accent font-mono text-xs">~/.useai/</code> belongs to you and can be exported
                or deleted at any time.
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                <span className="text-text-primary font-bold">Synced data:</span> When you sync data to our servers,
                you grant us a license to store, process, and display that data in accordance with our Privacy Policy.
                This license is limited to operating the Service (e.g., displaying your public profile,
                computing leaderboard rankings, generating aggregate statistics).
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">06</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Open Source Components</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                The UseAI MCP server (<code className="text-accent font-mono text-xs">@devness/useai</code>) and CLI
                (<code className="text-accent font-mono text-xs">@devness/useai-cli</code>) are released under the{' '}
                <a
                  href="https://github.com/devness-com/useai/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-bright border-b border-accent/30"
                >
                  MIT License
                </a>
                . Your use of these components is governed by that license.
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                The cloud API, website, and admin dashboard are proprietary and subject to these Terms.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">07</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Intellectual Property</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                The UseAI name, logo, website design, and proprietary components are owned by Devness Network.
                You may not use our trademarks without prior written permission.
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                User-generated content (such as milestone titles and profile information) remains your property.
                By posting content publicly through the Service, you grant us a non-exclusive, worldwide license
                to display that content as part of the Service.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">08</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Disclaimers</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                The Service is provided <span className="text-text-primary font-bold">&ldquo;as is&rdquo;</span> and{' '}
                <span className="text-text-primary font-bold">&ldquo;as available&rdquo;</span> without warranties of any
                kind, either express or implied, including but not limited to implied warranties of merchantability,
                fitness for a particular purpose, and non-infringement.
              </p>
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                We do not guarantee that the Service will be uninterrupted, secure, or error-free.
                Session scores, AI Proficiency Scores, and leaderboard rankings are computed metrics and
                should not be relied upon as the sole measure of developer competence.
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                Cryptographic signatures provide tamper evidence, not absolute proof of AI usage.
                The verification system is designed to detect modification of records but cannot prevent
                fabrication of initial data.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">09</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Limitation of Liability</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                To the maximum extent permitted by law, Devness Network shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages, or any loss of
                profits or revenues, whether incurred directly or indirectly, or any loss of data,
                use, goodwill, or other intangible losses resulting from:
              </p>
              <ul className="space-y-1.5 text-sm text-text-muted ml-4">
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Your use of or inability to use the Service</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Any unauthorized access to or alteration of your data</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Any third-party conduct on the Service</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Any other matter relating to the Service</li>
              </ul>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">10</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Termination</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                You may stop using the Service at any time. You can uninstall the MCP server,
                delete your local data with <code className="text-accent font-mono text-xs">useai purge</code>,
                and request account deletion by contacting us.
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                We reserve the right to suspend or terminate your access to the Service if you violate
                these Terms, engage in abusive behavior, or if continued provision of the Service
                becomes impractical. We will make reasonable efforts to notify you before termination
                when feasible.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">11</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Changes to Terms</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed">
                We may modify these Terms at any time. Material changes will be communicated through
                the website or via email to registered users. Continued use of the Service after
                changes take effect constitutes acceptance. If you disagree with updated Terms,
                you should discontinue use of the Service.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">12</div>
              <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Contact</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
            </div>
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
              <p className="text-sm text-text-muted leading-relaxed mb-3">
                For questions about these Terms, contact us at:
              </p>
              <ul className="space-y-1.5 text-sm text-text-muted ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-accent shrink-0">&bull;</span>
                  Email:{' '}
                  <a href="mailto:legal@useai.dev" className="text-accent hover:text-accent-bright border-b border-accent/30">
                    legal@useai.dev
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent shrink-0">&bull;</span>
                  GitHub:{' '}
                  <a href="https://github.com/devness-com/useai/issues" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-bright border-b border-accent/30">
                    github.com/devness-com/useai
                  </a>
                </li>
              </ul>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
