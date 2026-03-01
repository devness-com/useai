import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
  manifest: '/site.webmanifest',
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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32-light.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16-light.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/x-icon" href="/favicon-light.ico" media="(prefers-color-scheme: light)" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-bg-base text-text-primary antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
