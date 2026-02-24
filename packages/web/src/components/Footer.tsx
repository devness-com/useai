import Link from 'next/link';
import { Github, Terminal, Star, Mail } from 'lucide-react';
import { UseAILogo } from './UseAILogo';

const FOOTER_LINKS = {
  product: [
    { label: 'Features', href: '/#features' },
    { label: 'Explore', href: '/explore' },
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'Dashboard', href: '/dashboard' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security', href: '/security' },
  ],
  developers: [
    { label: 'GitHub', href: 'https://github.com/devness-com/useai', external: true },
    { label: 'npm Package', href: 'https://www.npmjs.com/package/@devness/useai', external: true },
    { label: 'Contributing', href: 'https://github.com/devness-com/useai/blob/main/CONTRIBUTING.md', external: true },
    { label: 'Report a Bug', href: 'https://github.com/devness-com/useai/issues', external: true },
  ],
};

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/50 bg-bg-surface-1">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12 mb-10 sm:mb-14">

          {/* Brand Column */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/">
              <UseAILogo className="h-4 sm:h-5 opacity-70 hover:opacity-100 transition-opacity mb-4" />
            </Link>
            <p className="text-xs text-text-muted leading-relaxed mb-4 max-w-[240px]">
              Privacy-first AI coding analytics. Track your sessions, prove your proficiency, own your data.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/devness-com/useai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-bg-surface-2 flex items-center justify-center text-text-muted hover:text-accent hover:bg-[var(--accent-alpha)] transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://www.npmjs.com/package/@devness/useai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-bg-surface-2 flex items-center justify-center text-text-muted hover:text-accent hover:bg-[var(--accent-alpha)] transition-colors"
                aria-label="npm"
              >
                <Terminal className="w-4 h-4" />
              </a>
              <a
                href="mailto:hello@useai.dev"
                className="w-8 h-8 rounded-lg bg-bg-surface-2 flex items-center justify-center text-text-muted hover:text-accent hover:bg-[var(--accent-alpha)] transition-colors"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-[10px] font-mono font-bold tracking-widest text-text-secondary uppercase mb-4">Product</h4>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-xs text-text-muted hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-[10px] font-mono font-bold tracking-widest text-text-secondary uppercase mb-4">Company</h4>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-xs text-text-muted hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Developer Links */}
          <div>
            <h4 className="text-[10px] font-mono font-bold tracking-widest text-text-secondary uppercase mb-4">Developers</h4>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.developers.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-text-muted hover:text-accent transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-muted font-mono tracking-widest">
              &copy; {new Date().getFullYear()} DEVNESS NETWORK
            </span>
            <span className="text-[10px] text-text-muted font-mono">&middot;</span>
            <span className="text-[10px] text-accent/70 font-mono tracking-widest">MIT LICENSE</span>
          </div>

          <a
            href="https://github.com/devness-com/useai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-[var(--accent-alpha)] text-[10px] sm:text-xs font-mono font-bold text-accent hover:bg-accent hover:text-bg-base transition-colors"
          >
            <Star className="w-3 h-3 fill-current" /> STAR ON GITHUB
          </a>
        </div>
      </div>
    </footer>
  );
}
