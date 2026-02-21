import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'UseAI — AI Proficiency Tracking for Developers',
  description:
    'Track your AI coding sessions across every tool. Measure prompt quality, task outcomes, and coding patterns. Privacy-first, cryptographically verified.',
  openGraph: {
    title: 'UseAI — AI Proficiency Tracking for Developers',
    description:
      'Track your AI coding sessions across every tool. Measure prompt quality, task outcomes, and coding patterns.',
    url: 'https://useai.dev',
    siteName: 'UseAI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UseAI — AI Proficiency Tracking for Developers',
    description:
      'Track your AI coding sessions across every tool. Measure prompt quality, task outcomes, and coding patterns.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-bg-base text-text-primary antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
